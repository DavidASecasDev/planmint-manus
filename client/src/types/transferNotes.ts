export interface TransferRequestNote {
  id: string;
  request_id: string;
  organization_id: string;
  broker_id: string | null;
  author_name: string;
  text: string;
  created_at: string;
}
