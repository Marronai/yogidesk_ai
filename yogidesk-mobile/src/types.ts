export interface StaffMember {
  id: string;
  name: string | null;
  email: string | null;
  status: string;
}

export interface InboxChat {
  id: string;
  name?: string | null;
  patient_name?: string | null;
  phone?: string | null;
  patient_phone?: string | null;
  last_message?: string | null;
  updated_at?: string | null;
  assigned_staff_id?: string | null;
  assigned_agent_id?: string | null;
  ai_reply_active?: boolean;
  metadata?: { ai_reply_active?: boolean; ai_paused?: boolean; [key: string]: unknown } | null;
}
