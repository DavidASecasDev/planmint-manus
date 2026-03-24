
-- Create transfer_status_history table
CREATE TABLE IF NOT EXISTS public.transfer_status_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.transfer_requests(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  changed_by_type text NOT NULL DEFAULT 'system',
  changed_by_id uuid,
  changed_by_name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transfer_status_history ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can read/write their org's data
CREATE POLICY "Users can manage their org transfer status history"
  ON public.transfer_status_history
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_transfer_status_history_request_id
  ON public.transfer_status_history(request_id);
CREATE INDEX IF NOT EXISTS idx_transfer_status_history_org_id
  ON public.transfer_status_history(organization_id);


-- Create transfer_request_notes table
-- NOTE: Code uses broker_id + text columns (not author_type/author_id/content from old types)
CREATE TABLE IF NOT EXISTS public.transfer_request_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.transfer_requests(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  broker_id uuid REFERENCES public.transfer_brokers(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transfer_request_notes ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Users can manage their org transfer request notes"
  ON public.transfer_request_notes
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_transfer_request_notes_request_id
  ON public.transfer_request_notes(request_id);
CREATE INDEX IF NOT EXISTS idx_transfer_request_notes_org_id
  ON public.transfer_request_notes(organization_id);


-- Create vehicle_audits table
CREATE TABLE IF NOT EXISTS public.vehicle_audits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  auditor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  score numeric,
  notes text,
  findings jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vehicle_audits ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Users can manage their org vehicle audits"
  ON public.vehicle_audits
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_vehicle_audits_org_id
  ON public.vehicle_audits(organization_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_audits_vehicle_id
  ON public.vehicle_audits(vehicle_id);


-- Create task_comments table
CREATE TABLE IF NOT EXISTS public.task_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Users can manage task comments"
  ON public.task_comments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id
  ON public.task_comments(task_id);


-- Add missing columns to transfer_brokers
ALTER TABLE public.transfer_brokers
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS user_id uuid;
