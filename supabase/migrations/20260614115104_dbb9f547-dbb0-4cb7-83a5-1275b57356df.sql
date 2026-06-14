
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS schedule_cron TEXT;
ALTER TABLE public.ai_agents ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ;
