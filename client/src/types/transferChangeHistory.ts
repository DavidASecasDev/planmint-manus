export interface FieldChange {
  field: string;
  label: string;
  old_value: string | number | boolean | null;
  new_value: string | number | boolean | null;
}

export type ChangeType = 'created' | 'updated' | 'status_change' | 'items_updated';

export interface TransferChangeHistoryEntry {
  id: string;
  request_id: string;
  organization_id: string;
  change_type: ChangeType;
  changed_by_type: 'admin' | 'broker' | 'system';
  changed_by_id: string | null;
  changed_by_name: string | null;
  changes: FieldChange[];
  summary: string | null;
  created_at: string;
}
