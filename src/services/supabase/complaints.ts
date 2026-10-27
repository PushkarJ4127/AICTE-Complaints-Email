import { supabase, isSupabaseConfigured } from './client';
import type {
  ComplaintPriority,
  ComplaintStatus,
  ComplaintWithRelations,
  ComplaintUpdateWithAuthor,
  AssignmentWithRelations,
  AuditLogWithActor,
  EvidenceItem,
  Database
} from '../../types/database.types';

export type NewComplaintInput = {
  institution_id: string;
  title: string;
  description: string;
  category: string;
  priority: ComplaintPriority;
  assigned_department_id: string;
  assigned_officer_id?: string | null;
  due_at?: string | null;
  received_at?: string;
  created_by?: string | null;
  complainant_name?: string | null;
  complainant_email?: string | null;
  complainant_phone?: string | null;
  complainant_type?: string | null;
  student_roll_no?: string | null;
  source_portal?: 'CPGRAMS' | 'CSS' | null;
  external_reference_id?: string | null;
  original_language?: string | null;
  original_text?: string | null;
  evidence?: EvidenceItem[];
};

export interface ComplaintFilterOptions {
  search?: string;
  departmentId?: string;
  status?: ComplaintStatus | 'ALL';
  priority?: ComplaintPriority | 'ALL';
  sortBy?: 'recent' | 'due_date' | 'priority';
  page?: number;
  pageSize?: number;
}

export async function getComplaints(options: ComplaintFilterOptions = {}): Promise<{
  data: ComplaintWithRelations[];
  count: number;
}> {
  const {
    search,
    departmentId,
    status,
    priority,
    sortBy = 'recent',
    page = 1,
    pageSize = 20,
  } = options;

  let query = supabase
    .from('complaints')
    .select(`
      *,
      institution:institutions(*),
      department:departments(*),
      assigned_officer:profiles!complaints_assigned_officer_id_fkey(*),
      creator:profiles!complaints_created_by_fkey(*)
    `, { count: 'exact' });

  // Filtering
  if (departmentId && departmentId !== 'ALL') {
    query = query.eq('assigned_department_id', departmentId);
  }

  if (status && status !== 'ALL') {
    query = query.eq('status', status);
  }

  if (priority && priority !== 'ALL') {
    query = query.eq('priority', priority);
  }

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`complaint_number.ilike.${term},title.ilike.${term},description.ilike.${term}`);
  }

  // Sorting
  if (sortBy === 'due_date') {
    query = query.order('due_at', { ascending: true, nullsFirst: false });
  } else if (sortBy === 'priority') {
    query = query.order('priority', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  // Pagination
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    console.error('Error fetching complaints:', error.message);
    throw error;
  }

  return {
    data: (data as unknown as ComplaintWithRelations[]) || [],
    count: count || 0,
  };
}

export async function getComplaintById(id: string): Promise<ComplaintWithRelations | null> {
  const { data, error } = await supabase
    .from('complaints')
    .select(`
      *,
      institution:institutions(*),
      department:departments(*),
      assigned_officer:profiles!complaints_assigned_officer_id_fkey(*),
      creator:profiles!complaints_created_by_fkey(*)
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error(`Error fetching complaint ${id}:`, error.message);
    return null;
  }

  return data as unknown as ComplaintWithRelations;
}

export async function getComplaintByNumberOrId(identifier: string): Promise<ComplaintWithRelations | null> {
  // Normalize input: strip surrounding spaces and spaces around hyphens (e.g. "AICTE - 2026 - 01001" -> "AICTE-2026-01001")
  const clean = identifier.trim().replace(/\s*-\s*/g, '-');
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean);

  let query = supabase
    .from('complaints')
    .select(`
      *,
      institution:institutions(*),
      department:departments(*),
      assigned_officer:profiles!complaints_assigned_officer_id_fkey(*),
      creator:profiles!complaints_created_by_fkey(*)
    `);

  if (isUuid) {
    query = query.or(`id.eq.${clean},complaint_number.ilike.${clean}`);
  } else {
    query = query.ilike('complaint_number', clean);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error(`Error looking up complaint "${clean}":`, error.message);
    return null;
  }

  return data as unknown as ComplaintWithRelations;
}

export async function createComplaint(payload: NewComplaintInput): Promise<Database['public']['Tables']['complaints']['Row']> {
  const insertData: Database['public']['Tables']['complaints']['Insert'] = {
    institution_id: payload.institution_id,
    title: payload.title,
    description: payload.description,
    category: payload.category,
    priority: payload.priority,
    status: 'Received',
    assigned_department_id: payload.assigned_department_id,
    assigned_officer_id: payload.assigned_officer_id || null,
    due_at: payload.due_at || null,
    received_at: payload.received_at || new Date().toISOString(),
    created_by: payload.created_by || null,
    complainant_name: payload.complainant_name || null,
    complainant_email: payload.complainant_email || null,
    complainant_phone: payload.complainant_phone || null,
    complainant_type: payload.complainant_type || null,
    student_roll_no: payload.student_roll_no || null,
    ...(payload.source_portal ? { source_portal: payload.source_portal } : {}),
    ...(payload.external_reference_id ? { external_reference_id: payload.external_reference_id } : {}),
  };

  // New columns (migration 20261026000001). Only sent when used, and if the
  // database has not been migrated yet we retry without them so filing never breaks.
  const hasNewFields = Boolean(payload.original_text || payload.original_language || (payload.evidence && payload.evidence.length));
  const withNew: Database['public']['Tables']['complaints']['Insert'] = hasNewFields
    ? {
        ...insertData,
        original_language: payload.original_language || null,
        original_text: payload.original_text || null,
        evidence: payload.evidence || [],
      }
    : insertData;

  let { data, error } = await supabase.from('complaints').insert(withNew).select().single();

  if (error && hasNewFields && /original_language|original_text|evidence|column|schema cache/i.test(error.message)) {
    console.warn('Database is missing the new columns, saving without them:', error.message);
    ({ data, error } = await supabase.from('complaints').insert(insertData).select().single());
  }

  if (error) {
    console.error('Error creating complaint:', error.message);
    throw error;
  }

  if (!data) {
    throw new Error('Supabase did not return the newly created complaint.');
  }

  return data as Database['public']['Tables']['complaints']['Row'];
}

export type ExternalPortalSource = 'CPGRAMS' | 'CSS';

export interface ExternalIntakePayload {
  source: ExternalPortalSource;
  externalReferenceId: string;
  institutionId: string;
  title: string;
  description: string;
  category: string;
  priority: ComplaintPriority;
  complainantName: string;
  complainantEmail: string;
  complainantPhone: string;
  complainantType: string;
  studentRollNo?: string;
}

export interface ExternalStreamItem {
  source: ExternalPortalSource;
  externalReferenceId: string;
  internalComplaintNumber: string;
  complaintId: string;
  institutionName: string;
  category: string;
  assignedCell: string;
  submittedAt: string;
}

const EXTERNAL_STREAM_STORAGE_KEY = 'aicte_external_stream_history';

/**
 * Local stream history only powers the convenience feed on the intake page.
 * The authoritative record is always the shared Supabase `complaints` row.
 */
export function getExternalStreamHistory(): ExternalStreamItem[] {
  try {
    const raw = localStorage.getItem(EXTERNAL_STREAM_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function rememberExternalStreamItem(item: ExternalStreamItem): void {
  try {
    const history = getExternalStreamHistory().filter(
      (saved) => saved.externalReferenceId !== item.externalReferenceId,
    );
    localStorage.setItem(EXTERNAL_STREAM_STORAGE_KEY, JSON.stringify([item, ...history].slice(0, 100)));
    // Dashboard tabs listening to this event can refresh promptly; the DB remains authoritative.
    window.dispatchEvent(new CustomEvent('aicte_complaints_updated'));
  } catch (error) {
    console.warn('Could not cache external intake history:', error);
  }
}

/**
 * Ingest a CPGRAMS/CSS submission into the same public.complaints table used by
 * the AICTE dashboard. This deliberately fails closed when Supabase is missing
 * instead of telling the citizen that a local-only submission was registered.
 */
export async function ingestExternalComplaint(payload: ExternalIntakePayload): Promise<Database['public']['Tables']['complaints']['Row']> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Shared backend is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env, then restart the server.',
    );
  }

  const title = payload.title.trim();
  const description = payload.description.trim();
  if (!title || !description || !payload.institutionId || !payload.externalReferenceId.trim()) {
    throw new Error('Institution, external reference, subject, and description are required.');
  }

  const [{ data: institution, error: institutionError }, { data: department, error: departmentError }] = await Promise.all([
    supabase
      .from('institutions')
      .select('id, institution_name')
      .eq('id', payload.institutionId)
      .single(),
    supabase
      .from('departments')
      .select('id, name, code')
      .eq('code', 'PGRC')
      .single(),
  ]);

  if (institutionError || !institution) {
    throw new Error(`The selected institution was not found in the shared database. ${institutionError?.message || ''}`.trim());
  }
  if (departmentError || !department) {
    throw new Error(`The PGRC department is missing from the shared database. Apply the AICTE seed/migration SQL first. ${departmentError?.message || ''}`.trim());
  }

  const { data, error } = await supabase
    .rpc('ingest_external_complaint', {
      p_source_portal: payload.source,
      p_external_reference_id: payload.externalReferenceId.trim(),
      p_institution_id: payload.institutionId,
      p_title: title,
      p_description: description,
      p_category: payload.category.trim() || 'General Grievance',
      p_priority: payload.priority,
      p_complainant_name: payload.complainantName.trim() || null,
      p_complainant_email: payload.complainantEmail.trim().toLowerCase() || null,
      p_complainant_phone: payload.complainantPhone.trim() || null,
      p_complainant_type: payload.complainantType || 'Student',
      p_student_roll_no: payload.studentRollNo?.trim() || null,
    })
    .single();

  if (error) {
    if (/ingest_external_complaint|function|schema cache/i.test(error.message)) {
      throw new Error('The shared database needs the secure intake migration. Run 20261024000001_public_grievance_portal.sql from the latest project ZIP, then retry.');
    }
    if (/row-level security|permission denied|violates row-level/i.test(error.message)) {
      throw new Error('Supabase blocked the external grievance intake. Verify that the secure ingest_external_complaint RPC migration was applied successfully.');
    }
    throw new Error(`Could not write grievance to the shared database: ${error.message}`);
  }
  if (!data) throw new Error('Supabase did not return the newly created grievance.');
  const created = data as Database['public']['Tables']['complaints']['Row'];

  const item: ExternalStreamItem = {
    source: payload.source,
    externalReferenceId: payload.externalReferenceId.trim(),
    internalComplaintNumber: created.complaint_number,
    complaintId: created.id,
    institutionName: institution.institution_name,
    category: created.category,
    assignedCell: department.code,
    submittedAt: created.created_at,
  };
  rememberExternalStreamItem(item);
  return created;
}

export async function updateComplaintStatus(
  id: string,
  newStatus: ComplaintStatus
): Promise<void> {
  const { error } = await supabase
    .from('complaints')
    .update({ status: newStatus })
    .eq('id', id);

  if (error) {
    console.error(`Error updating status for complaint ${id}:`, error.message);
    throw error;
  }
}

export async function updateComplaintAssignment(
  id: string,
  departmentId: string,
  officerId: string | null
): Promise<void> {
  const { error } = await supabase
    .from('complaints')
    .update({
      assigned_department_id: departmentId,
      assigned_officer_id: officerId,
    })
    .eq('id', id);

  if (error) {
    console.error(`Error updating assignment for complaint ${id}:`, error.message);
    throw error;
  }
}

export async function getComplaintUpdates(complaintId: string): Promise<ComplaintUpdateWithAuthor[]> {
  const { data, error } = await supabase
    .from('complaint_updates')
    .select(`
      *,
      author:profiles(*)
    `)
    .eq('complaint_id', complaintId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error(`Error fetching updates for complaint ${complaintId}:`, error.message);
    throw error;
  }

  return (data as unknown as ComplaintUpdateWithAuthor[]) || [];
}

export async function addComplaintUpdate(
  complaintId: string,
  authorId: string,
  updateText: string
): Promise<void> {
  const { error } = await supabase
    .from('complaint_updates')
    .insert({
      complaint_id: complaintId,
      author_id: authorId,
      update_text: updateText,
    });

  if (error) {
    console.error(`Error adding update to complaint ${complaintId}:`, error.message);
    throw error;
  }
}

export async function getComplaintAssignments(complaintId: string): Promise<AssignmentWithRelations[]> {
  const { data, error } = await supabase
    .from('complaint_assignments')
    .select(`
      *,
      department:departments(*),
      officer:profiles!complaint_assignments_officer_id_fkey(*),
      assigner:profiles!complaint_assignments_assigned_by_fkey(*)
    `)
    .eq('complaint_id', complaintId)
    .order('assigned_at', { ascending: false });

  if (error) {
    console.error(`Error fetching assignments for complaint ${complaintId}:`, error.message);
    throw error;
  }

  return (data as unknown as AssignmentWithRelations[]) || [];
}

export async function getComplaintAuditHistory(complaintId: string): Promise<AuditLogWithActor[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select(`
      *,
      actor:profiles(*)
    `)
    .eq('entity_id', complaintId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(`Error fetching audit history for complaint ${complaintId}:`, error.message);
    throw error;
  }

  return (data as unknown as AuditLogWithActor[]) || [];
}
