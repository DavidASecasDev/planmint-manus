export interface TransferStatusHistoryEntry {
  id: string;
  request_id: string;
  organization_id: string;
  previous_status: string | null;
  new_status: string;
  changed_by_type: 'admin' | 'broker' | 'system';
  changed_by_id: string | null;
  changed_by_name: string | null;
  note: string | null;
  created_at: string;
}
