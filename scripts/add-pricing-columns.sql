ALTER TABLE public.transfer_requests ADD COLUMN IF NOT EXISTS pricing_mode TEXT DEFAULT 'zone_tariff';
ALTER TABLE public.transfer_items ADD COLUMN IF NOT EXISTS provider_cost NUMERIC DEFAULT NULL;