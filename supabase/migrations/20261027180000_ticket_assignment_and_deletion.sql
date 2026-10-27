-- Migration: 20261027180000_ticket_assignment_and_deletion.sql
-- Description: Add assignment timestamps, resolution actor, and administrative soft deletion for reports and scan partner requests.

-- 1. Reports assignment & administrative deletion
ALTER TABLE public.reports 
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason text DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_reports_deleted_at ON public.reports(deleted_at);
CREATE INDEX IF NOT EXISTS idx_reports_assigned_to ON public.reports(assigned_to);

-- 2. Scan partner requests assignment & administrative deletion
ALTER TABLE public.scan_partner_requests
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason text DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_scan_partner_requests_deleted_at ON public.scan_partner_requests(deleted_at);
CREATE INDEX IF NOT EXISTS idx_scan_partner_requests_assigned_to ON public.scan_partner_requests(assigned_to);

-- 3. Audit log insert policy for staff/admins
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'audit_log' AND policyname = 'audit_staff_insert'
  ) THEN
    CREATE POLICY audit_staff_insert ON public.audit_log
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = actor_id);
  END IF;
END $$;

