-- Add missing columns to behaviour_patterns per architecture v5.5, Section 3.7
-- severity, recommendation, scan_id, is_active, first_seen_at

ALTER TABLE public.behaviour_patterns
  ADD COLUMN IF NOT EXISTS severity text DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS recommendation text,
  ADD COLUMN IF NOT EXISTS scan_id text,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz DEFAULT now();

-- Index for real-time pattern check (must be <30ms)
CREATE INDEX IF NOT EXISTS idx_patterns_user_active
  ON public.behaviour_patterns(user_id) WHERE is_active = true;
