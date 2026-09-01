BEGIN;

CREATE INDEX IF NOT EXISTS external_api_idempotency_transfer_idx
  ON public.external_api_idempotency (transfer_request_id)
  WHERE transfer_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS external_api_webhooks_created_by_idx
  ON public.external_api_webhooks (created_by)
  WHERE created_by IS NOT NULL;

COMMIT;
