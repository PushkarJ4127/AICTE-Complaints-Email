// ============================================================================
// Database TypeScript Definitions
// AICTE Cross-Bureau Complaint Coordination Platform (SIH-26264)
// Matches Supabase PostgreSQL Schema exactly
// ============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'Administrator' | 'Bureau Officer' | 'Cross-Department Reviewer';

export type ComplaintPriority = 'Normal' | 'High' | 'Urgent';

export type ComplaintStatus =
  | 'Received'
  | 'Under Review'
  | 'In Progress'
  | 'On Hold'
  | 'Resolved'
  | 'Closed';

export type NotificationType =
  | 'assignment'
  | 'status_change'
  | 'update'
  | 'administrative';

export type AuditActionType =
  | 'CREATE'
  | 'STATUS_CHANGE'
  | 'ASSIGNMENT_CHANGE'
  | 'UPDATE_ADDED'
  | 'ADMIN_ACTION';

export type AuditEntityType =
  | 'complaint'
  | 'assignment'
  | 'profile'
  | 'department'
  | 'institution';

export type DepartmentRow = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  full_name: string;
  department_id: string | null;
  role: UserRole;
  designation: string | null;
  contact_number: string | null;
  created_at: string;
  updated_at: string;
};

export type InstitutionRow = {
  id: string;
  institution_name: string;
  aicte_permanent_id: string | null;
  address: string | null;
  state: string;
  district: string | null;
  institution_type: string | null;
  created_at: string;
  updated_at: string;
};

export type ComplaintRow = {
  id: string;
  complaint_number: string;
  institution_id: string;
  title: string;
  description: string;
  category: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  assigned_department_id: string;
  assigned_officer_id: string | null;
  received_at: string;
  due_at: string | null;
  resolved_at: string | null;
  created_by: string | null;
  complainant_name: string | null;
  complainant_email: string | null;
  complainant_phone: string | null;
  complainant_type: string | null;
  student_roll_no: string | null;
  source_portal?: 'CPGRAMS' | 'CSS' | null;
  external_reference_id?: string | null;
  // Mass-complaint clusters, multilingual intake, evidence (migration 20261026000001)
  affected_count?: number;
  merged_into?: string | null;
  original_language?: string | null;
  original_text?: string | null;
  evidence?: EvidenceItem[] | null;
  created_at: string;
  updated_at: string;
};

export type EvidenceFlag = {
  code: 'amount_mismatch' | 'date_issue' | 'name_mismatch' | 'institution_mismatch' | 'unreadable' | 'not_checked';
  severity: 'high' | 'medium' | 'low';
  message: string;
};

export type EvidenceItem = {
  file_name: string;
  mime_type: string;
  size: number;
  storage_path?: string | null;
  document_type?: string | null;
  extracted: {
    amounts: number[];
    primary_amount: number | null;
    dates: string[];
    payer_name?: string | null;
    institution_name?: string | null;
    receipt_number?: string | null;
    summary?: string | null;
  };
  claimed_amounts: number[];
  flags: EvidenceFlag[];
  verdict: 'consistent' | 'mismatch' | 'unverified';
  checked_by: 'gemini' | 'text-parser' | 'none';
};

export type ComplaintSupporterRow = {
  id: string;
  complaint_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  roll_no: string | null;
  statement: string | null;
  evidence: EvidenceItem[] | null;
  source: 'joined' | 'merged';
  original_complaint_number: string | null;
  created_at: string;
};

export type ComplaintUpdateRow = {
  id: string;
  complaint_id: string;
  author_id: string;
  update_text: string;
  created_at: string;
};

export type ComplaintAssignmentRow = {
  id: string;
  complaint_id: string;
  department_id: string;
  officer_id: string | null;
  assigned_by: string;
  assigned_at: string;
  ended_at: string | null;
};

export type NotificationRow = {
  id: string;
  recipient_id: string;
  complaint_id: string | null;
  notification_type: NotificationType;
  message: string;
  is_read: boolean;
  created_at: string;
};

export type AuditLogRow = {
  id: string;
  actor_id: string | null;
  action_type: AuditActionType;
  entity_type: AuditEntityType;
  entity_id: string;
  details: Json;
  created_at: string;
};

export interface Database {
  public: {
    Tables: {
      departments: {
        Row: DepartmentRow;
        Insert: {
          id?: string;
          name: string;
          code: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: {
          id: string;
          full_name: string;
          department_id?: string | null;
          role?: UserRole;
          designation?: string | null;
          contact_number?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          department_id?: string | null;
          role?: UserRole;
          designation?: string | null;
          contact_number?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      institutions: {
        Row: InstitutionRow;
        Insert: {
          id?: string;
          institution_name: string;
          aicte_permanent_id?: string | null;
          address?: string | null;
          state: string;
          district?: string | null;
          institution_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          institution_name?: string;
          aicte_permanent_id?: string | null;
          address?: string | null;
          state?: string;
          district?: string | null;
          institution_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      complaints: {
        Row: ComplaintRow;
        Insert: {
          id?: string;
          complaint_number?: string;
          institution_id: string;
          title: string;
          description: string;
          category: string;
          priority?: ComplaintPriority;
          status?: ComplaintStatus;
          assigned_department_id: string;
          assigned_officer_id?: string | null;
          received_at?: string;
          due_at?: string | null;
          resolved_at?: string | null;
          created_by?: string | null;
          complainant_name?: string | null;
          complainant_email?: string | null;
          complainant_phone?: string | null;
          complainant_type?: string | null;
          student_roll_no?: string | null;
          source_portal?: 'CPGRAMS' | 'CSS' | null;
          external_reference_id?: string | null;
          affected_count?: number;
          merged_into?: string | null;
          original_language?: string | null;
          original_text?: string | null;
          evidence?: EvidenceItem[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          complaint_number?: string;
          institution_id?: string;
          title?: string;
          description?: string;
          category?: string;
          priority?: ComplaintPriority;
          status?: ComplaintStatus;
          assigned_department_id?: string;
          assigned_officer_id?: string | null;
          received_at?: string;
          due_at?: string | null;
          resolved_at?: string | null;
          created_by?: string | null;
          complainant_name?: string | null;
          complainant_email?: string | null;
          complainant_phone?: string | null;
          complainant_type?: string | null;
          student_roll_no?: string | null;
          source_portal?: 'CPGRAMS' | 'CSS' | null;
          external_reference_id?: string | null;
          affected_count?: number;
          merged_into?: string | null;
          original_language?: string | null;
          original_text?: string | null;
          evidence?: EvidenceItem[] | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      complaint_supporters: {
        Row: ComplaintSupporterRow;
        Insert: {
          id?: string;
          complaint_id: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          roll_no?: string | null;
          statement?: string | null;
          evidence?: EvidenceItem[] | null;
          source?: 'joined' | 'merged';
          original_complaint_number?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          statement?: string | null;
          evidence?: EvidenceItem[] | null;
        };
        Relationships: [];
      };
      complaint_updates: {
        Row: ComplaintUpdateRow;
        Insert: {
          id?: string;
          complaint_id: string;
          author_id: string;
          update_text: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          complaint_id?: string;
          author_id?: string;
          update_text?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      complaint_assignments: {
        Row: ComplaintAssignmentRow;
        Insert: {
          id?: string;
          complaint_id: string;
          department_id: string;
          officer_id?: string | null;
          assigned_by: string;
          assigned_at?: string;
          ended_at?: string | null;
        };
        Update: {
          id?: string;
          complaint_id?: string;
          department_id?: string;
          officer_id?: string | null;
          assigned_by?: string;
          assigned_at?: string;
          ended_at?: string | null;
        };
        Relationships: [];
      };
      notifications: {
        Row: NotificationRow;
        Insert: {
          id?: string;
          recipient_id: string;
          complaint_id?: string | null;
          notification_type: NotificationType;
          message: string;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipient_id?: string;
          complaint_id?: string | null;
          notification_type?: NotificationType;
          message?: string;
          is_read?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLogRow;
        Insert: {
          id?: string;
          actor_id?: string | null;
          action_type: AuditActionType;
          entity_type: AuditEntityType;
          entity_id: string;
          details?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          action_type?: AuditActionType;
          entity_type?: AuditEntityType;
          entity_id?: string;
          details?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      join_complaint_cluster: {
        Args: {
          p_complaint_id: string;
          p_name: string;
          p_email: string | null;
          p_phone: string | null;
          p_roll_no: string | null;
          p_statement: string | null;
          p_evidence?: EvidenceItem[] | null;
        };
        Returns: number;
      };
      ingest_external_complaint: {
        Args: {
          p_source_portal: string;
          p_external_reference_id: string;
          p_institution_id: string;
          p_title: string;
          p_description: string;
          p_category: string;
          p_priority: string;
          p_complainant_name?: string | null;
          p_complainant_email?: string | null;
          p_complainant_phone?: string | null;
          p_complainant_type?: string | null;
          p_student_roll_no?: string | null;
        };
        Returns: ComplaintRow[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Joined types for frontend display
export type ComplaintWithRelations = ComplaintRow & {
  institution?: InstitutionRow;
  department?: DepartmentRow;
  assigned_officer?: ProfileRow | null;
  creator?: ProfileRow;
};

export type ComplaintUpdateWithAuthor = ComplaintUpdateRow & {
  author?: ProfileRow;
};

export type AssignmentWithRelations = ComplaintAssignmentRow & {
  department?: DepartmentRow;
  officer?: ProfileRow | null;
  assigner?: ProfileRow;
};

export type AuditLogWithActor = AuditLogRow & {
  actor?: ProfileRow | null;
};
