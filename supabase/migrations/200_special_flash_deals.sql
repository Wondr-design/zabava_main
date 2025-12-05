-- Create flash_deals table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.flash_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id text REFERENCES public.partners(id) ON DELETE CASCADE,
  title text NOT NULL,
  name text, -- legacy, use title instead
  description text,
  status text NOT NULL DEFAULT 'draft',
  discount_percent integer,
  discount_amount numeric,
  valid_from timestamptz,
  valid_until timestamptz,
  valid_days text[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS flash_deals_partner_id_idx ON public.flash_deals (partner_id);
CREATE INDEX IF NOT EXISTS flash_deals_is_active_idx ON public.flash_deals (is_active);
CREATE INDEX IF NOT EXISTS flash_deals_status_idx ON public.flash_deals (status);

-- Add columns to existing flash_deals table to support unified deal model
ALTER TABLE public.flash_deals
  ADD COLUMN IF NOT EXISTS deal_type text NOT NULL DEFAULT 'flash',
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS price_override_czk numeric,
  ADD COLUMN IF NOT EXISTS bonus_points_override integer,
  ADD COLUMN IF NOT EXISTS usage_limit_daily integer,
  ADD COLUMN IF NOT EXISTS auto_expire boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS send_reminders boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS audience text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS city text;

ALTER TABLE public.flash_deals
  ADD CONSTRAINT flash_deals_slug_unique UNIQUE (slug);

-- Track per-deal media assets (images, videos, banners)
CREATE TABLE IF NOT EXISTS public.deal_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.flash_deals (id) ON DELETE CASCADE,
  media_type text NOT NULL,
  url text NOT NULL,
  alt_text text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deal_media_deal_id_idx ON public.deal_media (deal_id);

-- Aggregate usage statistics for deals (cached counters)
CREATE TABLE IF NOT EXISTS public.deal_usage_stats (
  deal_id uuid PRIMARY KEY REFERENCES public.flash_deals (id) ON DELETE CASCADE,
  qr_generated integer NOT NULL DEFAULT 0,
  qr_scanned integer NOT NULL DEFAULT 0,
  qr_rejected integer NOT NULL DEFAULT 0,
  commission_czk numeric NOT NULL DEFAULT 0,
  bonus_awarded integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Reminder queue to coordinate with n8n
CREATE TABLE IF NOT EXISTS public.deal_reminder_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.flash_deals (id) ON DELETE CASCADE,
  qr_id uuid,
  user_email text,
  reminder_type text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  last_attempt_at timestamptz,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deal_reminder_queue_status_idx
  ON public.deal_reminder_queue (status, scheduled_at);

CREATE INDEX IF NOT EXISTS deal_reminder_queue_deal_idx
  ON public.deal_reminder_queue (deal_id);
