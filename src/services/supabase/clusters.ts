import { supabase } from './client';
import type { ClusterableComplaint } from '../clustering/clusterDetector';
import type { ComplaintSupporterRow, EvidenceItem } from '../../types/database.types';

const CLOSED_STATUSES = '("Resolved","Closed")';

/** Open complaints of one institution (used while a citizen is filing). */
export async function getOpenComplaintsForInstitution(institutionId: string): Promise<ClusterableComplaint[]> {
  let { data, error } = await supabase
    .from('complaints')
    .select('id, complaint_number, institution_id, title, description, category, status, received_at, affected_count, merged_into, complainant_name, complainant_email')
    .eq('institution_id', institutionId)
    .is('merged_into', null)
    .not('status', 'in', CLOSED_STATUSES)
    .order('received_at', { ascending: false })
    .limit(300);

  if (error) {
    // Migration not applied yet (no merged_into / affected_count columns): retry without them
    const retry = await supabase
      .from('complaints')
      .select('id, complaint_number, institution_id, title, description, category, status, received_at, complainant_name, complainant_email')
      .eq('institution_id', institutionId)
      .not('status', 'in', CLOSED_STATUSES)
      .order('received_at', { ascending: false })
      .limit(300);
    if (retry.error) throw retry.error;
    data = retry.data as typeof data;
  }
  return (data || []) as unknown as ClusterableComplaint[];
}

/** All open complaints with institution names (officer cluster view). */
export async function getOpenComplaintsForClustering(): Promise<ClusterableComplaint[]> {
  const { data, error } = await supabase
    .from('complaints')
    .select('*, institution:institutions(institution_name, state)')
    .not('status', 'in', CLOSED_STATUSES)
    .order('received_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return ((data || []) as unknown as ClusterableComplaint[]).filter((c) => !c.merged_into);
}

export interface JoinPerson {
  name: string;
  email: string;
  phone: string;
  rollNo: string;
}

/** A citizen joins an existing complaint instead of filing a duplicate. Returns the new affected count. */
export async function joinComplaintCluster(
  complaintId: string,
  person: JoinPerson,
  statement: string,
  evidence: EvidenceItem[]
): Promise<number> {
  const { data, error } = await supabase.rpc('join_complaint_cluster', {
    p_complaint_id: complaintId,
    p_name: person.name,
    p_email: person.email || null,
    p_phone: person.phone || null,
    p_roll_no: person.rollNo || null,
    p_statement: statement || null,
    p_evidence: evidence,
  });
  if (error) throw error;
  return Number(data);
}

export async function getSupporters(complaintId: string): Promise<ComplaintSupporterRow[]> {
  const { data, error } = await supabase
    .from('complaint_supporters')
    .select('*')
    .eq('complaint_id', complaintId)
    .order('created_at', { ascending: true });
  if (error) {
    // Table does not exist yet -> behave as "no supporters"
    console.warn('Could not load supporters:', error.message);
    return [];
  }
  return (data || []) as ComplaintSupporterRow[];
}

/**
 * Officer action: fold several complaints into one mass case.
 * Each folded complaint becomes a "supporter" of the parent and is closed with a note.
 */
export async function mergeComplaintsIntoCase(
  parent: ClusterableComplaint,
  children: ClusterableComplaint[],
  authorId: string | null
): Promise<number> {
  let added = 0;
  for (const child of children) {
    const full = child as ClusterableComplaint & {
      complainant_phone?: string | null;
      student_roll_no?: string | null;
      evidence?: EvidenceItem[] | null;
    };

    const { error: supErr } = await supabase.from('complaint_supporters').insert({
      complaint_id: parent.id,
      name: full.complainant_name || 'Anonymous complainant',
      email: full.complainant_email || null,
      phone: full.complainant_phone || null,
      roll_no: full.student_roll_no || null,
      statement: `${full.title}\n${full.description}`.slice(0, 2000),
      evidence: full.evidence || [],
      source: 'merged',
      original_complaint_number: full.complaint_number,
    });
    if (supErr) throw supErr;

    const { error: updErr } = await supabase
      .from('complaints')
      .update({ status: 'Closed', merged_into: parent.id })
      .eq('id', full.id);
    if (updErr) throw updErr;

    if (authorId) {
      await supabase.from('complaint_updates').insert({
        complaint_id: full.id,
        author_id: authorId,
        update_text: `Merged into mass case ${parent.complaint_number}. This complainant is now counted among the affected persons of that case.`,
      });
    }
    added += Math.max(1, full.affected_count || 1);
  }

  const newCount = Math.max(1, parent.affected_count || 1) + added;
  const { error: parentErr } = await supabase.from('complaints').update({ affected_count: newCount }).eq('id', parent.id);
  if (parentErr) throw parentErr;

  if (authorId) {
    await supabase.from('complaint_updates').insert({
      complaint_id: parent.id,
      author_id: authorId,
      update_text: `Mass case formed: ${children.length} similar complaint(s) merged (${children.map((c) => c.complaint_number).join(', ')}). Total affected persons: ${newCount}.`,
    });
  }
  return newCount;
}
