/**
 * Mass-complaint (cluster) detector.
 *
 * Idea: if many people at ONE college complain about the SAME thing
 * (e.g. 50 students, same illegal fee), AICTE should handle it as ONE case
 * that says "50 students affected", not 50 separate cases.
 *
 * Two complaints are "the same issue" when they are about the same institution,
 * both still open, close in time, and their text / category / money amount agree.
 * Connected complaints are grouped (union-find) into a cluster.
 */
import { parseAmounts } from '../evidence/amounts';

export interface ClusterableComplaint {
  id: string;
  complaint_number: string;
  institution_id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  received_at: string;
  affected_count?: number | null;
  merged_into?: string | null;
  complainant_name?: string | null;
  complainant_email?: string | null;
  institution?: { institution_name?: string | null; state?: string | null } | null;
}

export interface PairSignals {
  text_similarity: number; // 0..1
  same_category: boolean;
  shared_amount: number | null;
  shared_terms: string[];
  days_apart: number;
}

export interface ComplaintCluster {
  id: string;
  institution_id: string;
  institution_name: string;
  category: string;
  members: ClusterableComplaint[];
  parent: ClusterableComplaint; // earliest complaint, becomes the "mass case"
  total_affected: number;
  shared_amount: number | null;
  shared_terms: string[];
  avg_similarity: number; // 0..1
  first_at: string;
  last_at: string;
  burst: boolean; // most complaints arrived within 14 days
  severity: 'Watch' | 'High' | 'Critical';
}

export interface ClusterOptions {
  /** Minimum score (0..1) for two complaints to count as the same issue. */
  linkThreshold?: number;
  /** Minimum number of complaints to call it a cluster. */
  minSize?: number;
  /** Only link complaints received within this many days of each other. */
  windowDays?: number;
}

export const DEFAULT_CLUSTER_OPTIONS: Required<ClusterOptions> = {
  linkThreshold: 0.42,
  minSize: 3,
  windowDays: 90,
};

const CLOSED = new Set(['Resolved', 'Closed']);

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'by', 'for', 'from', 'has', 'have', 'had', 'he', 'she',
  'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the', 'to', 'was', 'were', 'will', 'with', 'this', 'our',
  'my', 'we', 'they', 'their', 'them', 'i', 'me', 'us', 'you', 'your', 'not', 'no', 'but', 'so', 'if', 'than',
  'student', 'students', 'complaint', 'institution', 'college', 'aicte', 'regarding', 'against', 'please',
  'required', 'action', 'dated', 'also', 'which', 'when', 'what', 'who', 'all', 'any', 'been', 'being', 'due',
  'rs', 'inr', 'rupees', 'year', 'sir', 'madam', 'kindly', 'request', 'issue', 'demanded', 'demand', 'asked',
]);

function tokens(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t) && !/^\d+$/.test(t));
}

/** Remembers a readable word for each stem so the UI can show "certificates", not "certificat". */
const DISPLAY_WORD = new Map<string, string>();

function stem(t: string): string {
  // very light stemming so "charged" / "charges" / "charge" line up
  let out = t;
  for (const suf of ['ing', 'ed', 'es', 's']) {
    if (out.endsWith(suf) && out.length - suf.length >= 3) {
      out = out.slice(0, -suf.length);
      break;
    }
  }
  if (out.endsWith('e') && out.length > 3) out = out.slice(0, -1);
  if (!DISPLAY_WORD.has(out) || t.length < (DISPLAY_WORD.get(out) as string).length) DISPLAY_WORD.set(out, t);
  return out;
}

function termSet(c: Pick<ClusterableComplaint, 'title' | 'description'>): Set<string> {
  return new Set(tokens(`${c.title} ${c.title} ${c.description}`).map(stem));
}

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000;
}

type Scorable = Pick<ClusterableComplaint, 'institution_id' | 'title' | 'description' | 'category' | 'received_at'>;

export function pairSignals(a: Scorable, b: Scorable): PairSignals {
  const ta = termSet(a);
  const tb = termSet(b);
  const shared: string[] = [];
  ta.forEach((t) => {
    if (tb.has(t)) shared.push(t);
  });
  const union = ta.size + tb.size - shared.length;
  const jaccard = union === 0 ? 0 : shared.length / union;
  const overlap = Math.min(ta.size, tb.size) === 0 ? 0 : shared.length / Math.min(ta.size, tb.size);
  // Blend: short complaints are judged by overlap, long ones by Jaccard
  const text_similarity = 0.5 * jaccard + 0.5 * overlap;

  const amountsA = parseAmounts(`${a.title} ${a.description}`);
  const amountsB = parseAmounts(`${b.title} ${b.description}`);
  const shared_amount =
    amountsA.find((x) => amountsB.some((y) => Math.abs(x - y) <= Math.max(1, 0.01 * Math.max(x, y)))) ?? null;

  return {
    text_similarity,
    same_category: a.category === b.category,
    shared_amount,
    shared_terms: shared.slice(0, 8),
    days_apart: daysBetween(a.received_at, b.received_at),
  };
}

export function pairScore(s: PairSignals): number {
  // text 55%, same category 25%, same money amount 20%
  return 0.55 * s.text_similarity + 0.25 * (s.same_category ? 1 : 0) + 0.2 * (s.shared_amount !== null ? 1 : 0);
}

/** Can this complaint be grouped at all? */
function isOpenRoot(c: ClusterableComplaint): boolean {
  return !CLOSED.has(c.status) && !c.merged_into;
}

// ---------------------------------------------------------------------------
// Union-find
// ---------------------------------------------------------------------------
class DisjointSet {
  private parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }
  union(a: number, b: number) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[rb] = ra;
  }
}

function severityFor(total: number): ComplaintCluster['severity'] {
  if (total >= 25) return 'Critical';
  if (total >= 8) return 'High';
  return 'Watch';
}

export function detectClusters(
  complaints: ClusterableComplaint[],
  options: ClusterOptions = {}
): ComplaintCluster[] {
  const opt = { ...DEFAULT_CLUSTER_OPTIONS, ...options };
  const open = complaints.filter(isOpenRoot);

  // Group by institution first (blocking) so we never compare across colleges
  const byInstitution = new Map<string, ClusterableComplaint[]>();
  for (const c of open) {
    const list = byInstitution.get(c.institution_id) || [];
    list.push(c);
    byInstitution.set(c.institution_id, list);
  }

  const clusters: ComplaintCluster[] = [];

  byInstitution.forEach((list, institutionId) => {
    const ds = new DisjointSet(list.length);
    const linkScores: number[][] = list.map(() => []);

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const sig = pairSignals(list[i], list[j]);
        if (sig.days_apart > opt.windowDays) continue;
        const score = pairScore(sig);
        if (score >= opt.linkThreshold) {
          ds.union(i, j);
          linkScores[i].push(score);
          linkScores[j].push(score);
        }
      }
    }

    const groups = new Map<number, number[]>();
    list.forEach((_, idx) => {
      const root = ds.find(idx);
      const g = groups.get(root) || [];
      g.push(idx);
      groups.set(root, g);
    });

    groups.forEach((idxs) => {
      if (idxs.length < opt.minSize) return;
      const members = idxs
        .map((i) => list[i])
        .sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime());
      const parent = members[0];

      // Most common category and the terms/amount that most members share
      const catCount = new Map<string, number>();
      members.forEach((m) => catCount.set(m.category, (catCount.get(m.category) || 0) + 1));
      const category = Array.from(catCount.entries()).sort((a, b) => b[1] - a[1])[0][0];

      const termCount = new Map<string, number>();
      members.forEach((m) => termSet(m).forEach((t) => termCount.set(t, (termCount.get(t) || 0) + 1)));
      const shared_terms = Array.from(termCount.entries())
        .filter(([, n]) => n >= Math.max(2, Math.ceil(members.length * 0.5)))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([t]) => DISPLAY_WORD.get(t) || t);

      const amountCount = new Map<number, number>();
      members.forEach((m) =>
        parseAmounts(`${m.title} ${m.description}`).forEach((v) => amountCount.set(v, (amountCount.get(v) || 0) + 1))
      );
      const topAmount = Array.from(amountCount.entries()).sort((a, b) => b[1] - a[1])[0];
      const shared_amount = topAmount && topAmount[1] >= Math.max(2, Math.ceil(members.length * 0.5)) ? topAmount[0] : null;

      const scores = idxs.flatMap((i) => linkScores[i]);
      const avg_similarity = scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : 0;

      const first_at = members[0].received_at;
      const last_at = members[members.length - 1].received_at;
      const total_affected = members.reduce((s, m) => s + Math.max(1, m.affected_count || 1), 0);
      const withinTwoWeeks = members.filter((m) => daysBetween(m.received_at, first_at) <= 14).length;

      clusters.push({
        id: `${institutionId}:${parent.id}`,
        institution_id: institutionId,
        institution_name: parent.institution?.institution_name || 'Unknown institution',
        category,
        members,
        parent,
        total_affected,
        shared_amount,
        shared_terms,
        avg_similarity,
        first_at,
        last_at,
        burst: withinTwoWeeks / members.length >= 0.6,
        severity: severityFor(total_affected),
      });
    });
  });

  return clusters.sort((a, b) => b.total_affected - a.total_affected);
}

// ---------------------------------------------------------------------------
// "Is someone already complaining about this?" - used while a citizen files
// ---------------------------------------------------------------------------
export interface SimilarCase {
  complaint: ClusterableComplaint;
  score: number; // 0..1
  signals: PairSignals;
}

export function findSimilarOpenCases(
  draft: Scorable,
  existing: ClusterableComplaint[],
  threshold = 0.4,
  limit = 3
): SimilarCase[] {
  return existing
    .filter((c) => c.institution_id === draft.institution_id && isOpenRoot(c))
    .map((c) => {
      const signals = pairSignals(draft, c);
      return { complaint: c, signals, score: pairScore(signals) };
    })
    .filter((r) => r.score >= threshold && r.signals.days_apart <= DEFAULT_CLUSTER_OPTIONS.windowDays)
    .sort((a, b) => b.score - a.score || (b.complaint.affected_count || 1) - (a.complaint.affected_count || 1))
    .slice(0, limit);
}
