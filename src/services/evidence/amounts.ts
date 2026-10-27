/**
 * Pure helpers (no network, no React) used by evidence checking and cluster detection:
 *  - find money amounts in free text, in English and Indian languages
 *  - parse simple receipt text
 *  - compare what a receipt says with what the complaint claims
 */
import type { EvidenceFlag, EvidenceItem } from '../../types/database.types';

// ---------------------------------------------------------------------------
// Digits: convert Devanagari, Bengali, Tamil ... digits to 0-9
// ---------------------------------------------------------------------------
const DIGIT_ZERO_CODEPOINTS = [
  0x0966, // Devanagari
  0x09e6, // Bengali
  0x0a66, // Gurmukhi
  0x0ae6, // Gujarati
  0x0b66, // Odia
  0x0be6, // Tamil
  0x0c66, // Telugu
  0x0ce6, // Kannada
  0x0d66, // Malayalam
];

export function normalizeDigits(text: string): string {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number;
    let replaced = false;
    for (const zero of DIGIT_ZERO_CODEPOINTS) {
      if (cp >= zero && cp <= zero + 9) {
        out += String(cp - zero);
        replaced = true;
        break;
      }
    }
    if (!replaced) out += ch;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Amount extraction
// ---------------------------------------------------------------------------
const CUR =
  '(?:₹|rs\\.?|inr|rupees?|rupaye|रु\\.?|रुपये|रुपए|रुपयों|ரூ\\.?|ரூபாய்|రూ\\.?|రూపాయలు|টাকা|રૂ\\.?|ರೂ\\.?|രൂപ)';
const NUM = '\\d{1,3}(?:,\\d{2,3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?';
const UNIT =
  '(?:lakhs?|lacs?|crores?|thousand|k|लाख|करोड़|करोड|हजार|हज़ार)(?![\\p{L}])';

const RE_CUR_FIRST = new RegExp(`(?<![\\p{L}])${CUR}\\s*(${NUM})(?:\\s*(${UNIT}))?`, 'giu');
const RE_CUR_LAST = new RegExp(`(${NUM})(?:\\s*(${UNIT}))?\\s*(?:${CUR}(?![\\p{L}])|/-)`, 'giu');
const RE_UNIT_ONLY = new RegExp(`(${NUM})\\s*(lakhs?|lacs?|crores?|लाख|करोड़|करोड)(?![\\p{L}])`, 'giu');

function unitMultiplier(unit?: string): number {
  if (!unit) return 1;
  const u = unit.toLowerCase();
  if (u.startsWith('lakh') || u.startsWith('lac') || u === 'लाख') return 100000;
  if (u.startsWith('crore') || u.startsWith('करोड')) return 10000000;
  if (u === 'k' || u === 'thousand' || u.startsWith('हज')) return 1000;
  return 1;
}

function toNumber(raw: string): number {
  return Number(raw.replace(/,/g, ''));
}

/** Find rupee amounts in text. Returns unique values, e.g. [120000, 90000]. */
export function parseAmounts(input: string): number[] {
  const text = normalizeDigits(input || '');
  const found = new Set<number>();

  const collect = (re: RegExp, numIdx: number, unitIdx: number) => {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const value = toNumber(m[numIdx]) * unitMultiplier(m[unitIdx]);
      if (Number.isFinite(value) && value >= 1) found.add(Math.round(value * 100) / 100);
    }
  };

  collect(RE_CUR_FIRST, 1, 2);
  collect(RE_CUR_LAST, 1, 2);
  collect(RE_UNIT_ONLY, 1, 2);
  return Array.from(found);
}

export function formatINR(value: number): string {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function amountsMatch(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(1, 0.01 * Math.max(a, b));
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function iso(y: number, m: number, d: number): string | null {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Find dates in text and return them as YYYY-MM-DD. Numeric dates are read day-first (India). */
export function parseDates(input: string): string[] {
  const text = normalizeDigits(input || '');
  const out = new Set<string>();

  let m: RegExpExecArray | null;
  const dmy = /\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})\b/g;
  while ((m = dmy.exec(text)) !== null) {
    const v = iso(Number(m[3]), Number(m[2]), Number(m[1]));
    if (v) out.add(v);
  }
  const ymd = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g;
  while ((m = ymd.exec(text)) !== null) {
    const v = iso(Number(m[1]), Number(m[2]), Number(m[3]));
    if (v) out.add(v);
  }
  const dMonY = /\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/g;
  while ((m = dMonY.exec(text)) !== null) {
    const mon = MONTHS[m[2].slice(0, 4).toLowerCase()] || MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mon) {
      const v = iso(Number(m[3]), mon, Number(m[1]));
      if (v) out.add(v);
    }
  }
  const monDY = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/g;
  while ((m = monDY.exec(text)) !== null) {
    const mon = MONTHS[m[1].slice(0, 4).toLowerCase()] || MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mon) {
      const v = iso(Number(m[3]), mon, Number(m[2]));
      if (v) out.add(v);
    }
  }
  return Array.from(out).sort();
}

// ---------------------------------------------------------------------------
// Receipt text parser (for .txt / .csv receipts and as a fallback)
// ---------------------------------------------------------------------------
export type ExtractedFields = EvidenceItem['extracted'];

export function emptyExtraction(): ExtractedFields {
  return { amounts: [], primary_amount: null, dates: [], payer_name: null, institution_name: null, receipt_number: null, summary: null };
}

export function parseReceiptText(raw: string): ExtractedFields {
  const text = normalizeDigits(raw || '');
  const result = emptyExtraction();

  const amounts = new Set<number>(parseAmounts(text));
  let primary: number | null = null;

  // Lines such as "Total Amount Paid: 90,000" (no currency symbol needed)
  const keyed = new RegExp(
    `(total|amount\\s*paid|paid|net\\s*amount|amount|fees?\\s*paid|received|payable)[^\\n\\d₹]{0,30}(?:₹|rs\\.?|inr)?\\s*(${NUM})`,
    'gi'
  );
  let m: RegExpExecArray | null;
  while ((m = keyed.exec(text)) !== null) {
    const v = toNumber(m[2]);
    if (v >= 1) {
      amounts.add(v);
      if (/total|paid|net/i.test(m[1]) && primary === null) primary = v;
    }
  }

  const list = Array.from(amounts).sort((a, b) => b - a);
  result.amounts = list;
  result.primary_amount = primary ?? (list.length ? list[0] : null);
  result.dates = parseDates(text);

  const name = text.match(/(?:received\s+from|student\s+name|name\s+of\s+(?:the\s+)?student|payer|name)\s*[:\-]\s*([^\n,]{3,60})/i);
  if (name) result.payer_name = name[1].trim();

  const inst = text.match(/^\s*(.*(?:college|institute|university|polytechnic|school of)[^\n]{0,60})$/im);
  if (inst) result.institution_name = inst[1].trim();

  const rec = text.match(/(?:receipt|voucher|txn|transaction|ref(?:erence)?)\s*(?:no\.?|number|id|#)\s*[:\-]?\s*((?=[A-Z0-9\-/]*\d)[A-Z0-9][A-Z0-9\-/]{3,25})/i);
  if (rec) result.receipt_number = rec[1];

  result.summary = text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 2).join(' · ').slice(0, 160) || null;
  return result;
}

// ---------------------------------------------------------------------------
// The check itself: what the document says vs what the complaint says
// ---------------------------------------------------------------------------
export interface EvidenceContext {
  claimedText: string;
  complainantName?: string;
  institutionName?: string;
  now?: Date;
}

const NAME_NOISE = new Set(['mr', 'mrs', 'ms', 'dr', 'shri', 'smt', 'sri', 'kumari', 'km', 'master', 'the', 'of', 'and']);
const INSTITUTION_NOISE = new Set([
  'college', 'institute', 'institution', 'of', 'and', 'the', 'engineering', 'technology', 'technical',
  'management', 'sciences', 'science', 'education', 'university', 'school', 'studies', 'advanced', 'national',
  'pharmaceutical', 'polytechnic', 'for', 'in', 'research', 'academy', 'campus',
]);

function words(s: string, noise: Set<string>): string[] {
  return (s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !noise.has(w));
}

function sharesWord(a: string[], b: string[]): boolean {
  const set = new Set(a);
  return b.some((w) => set.has(w));
}

export function evaluateEvidence(
  fileMeta: Pick<EvidenceItem, 'file_name' | 'mime_type' | 'size' | 'storage_path' | 'document_type'>,
  extracted: ExtractedFields,
  checkedBy: EvidenceItem['checked_by'],
  ctx: EvidenceContext
): EvidenceItem {
  const flags: EvidenceFlag[] = [];
  const claimed = parseAmounts(ctx.claimedText);
  const now = ctx.now ?? new Date();
  const docAmounts = extracted.amounts.length
    ? extracted.amounts
    : extracted.primary_amount !== null
    ? [extracted.primary_amount]
    : [];

  if (checkedBy === 'none') {
    flags.push({
      code: 'not_checked',
      severity: 'low',
      message: 'This file could not be read automatically (AI key not configured). It is attached for the officer to verify manually.',
    });
  } else {
    // 1. Amounts
    if (docAmounts.length === 0) {
      flags.push({
        code: 'unreadable',
        severity: 'medium',
        message: 'No amount could be read from this document. It may be blurred, cropped or not a receipt.',
      });
    } else if (claimed.length === 0) {
      flags.push({
        code: 'amount_mismatch',
        severity: 'low',
        message: `Document shows ${docAmounts.map(formatINR).join(', ')}, but no amount was written in the complaint to compare with.`,
      });
    } else {
      const direct = claimed.some((c) => docAmounts.some((d) => amountsMatch(c, d)));
      const sumOfDocs = docAmounts.length > 1 && claimed.some((c) => amountsMatch(c, docAmounts.reduce((s, x) => s + x, 0)));
      if (!direct && !sumOfDocs) {
        const ref = extracted.primary_amount ?? docAmounts[0];
        const closest = claimed.reduce((best, c) => (Math.abs(c - ref) < Math.abs(best - ref) ? c : best), claimed[0]);
        flags.push({
          code: 'amount_mismatch',
          severity: 'high',
          message: `Receipt shows ${formatINR(ref)} but the complaint says ${formatINR(closest)} (difference ${formatINR(Math.abs(closest - ref))}).`,
        });
      }
    }

    // 2. Dates
    const today = now.getTime();
    for (const d of extracted.dates) {
      const t = new Date(d + 'T00:00:00').getTime();
      if (Number.isNaN(t)) continue;
      if (t > today + 24 * 3600 * 1000) {
        flags.push({ code: 'date_issue', severity: 'high', message: `Document is dated ${d}, which is in the future.` });
        break;
      }
      if (today - t > 3 * 365 * 24 * 3600 * 1000) {
        flags.push({ code: 'date_issue', severity: 'medium', message: `Document is dated ${d}, more than 3 years ago.` });
        break;
      }
    }

    // 3. Name on document vs complainant
    if (extracted.payer_name && ctx.complainantName) {
      const a = words(extracted.payer_name, NAME_NOISE);
      const b = words(ctx.complainantName, NAME_NOISE);
      if (a.length && b.length && !sharesWord(a, b)) {
        flags.push({
          code: 'name_mismatch',
          severity: 'medium',
          message: `Name on document is "${extracted.payer_name}" but the complainant is "${ctx.complainantName}" (a parent or guardian may have paid).`,
        });
      }
    }

    // 4. Institution on document vs selected institution
    if (extracted.institution_name && ctx.institutionName) {
      const a = words(extracted.institution_name, INSTITUTION_NOISE);
      const b = words(ctx.institutionName, INSTITUTION_NOISE);
      if (a.length && b.length && !sharesWord(a, b)) {
        flags.push({
          code: 'institution_mismatch',
          severity: 'medium',
          message: `Document is from "${extracted.institution_name}" but the complaint is against "${ctx.institutionName}".`,
        });
      }
    }
  }

  const hasProblem = flags.some((f) => f.severity === 'high' || (f.severity === 'medium' && f.code !== 'not_checked'));
  const verdict: EvidenceItem['verdict'] =
    checkedBy === 'none' ? 'unverified' : hasProblem ? 'mismatch' : 'consistent';

  return {
    ...fileMeta,
    extracted,
    claimed_amounts: claimed,
    flags,
    verdict,
    checked_by: checkedBy,
  };
}
