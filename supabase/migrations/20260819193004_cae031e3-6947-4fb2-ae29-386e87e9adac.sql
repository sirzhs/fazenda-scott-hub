CREATE TABLE public.app_settings (
  user_id uuid NOT NULL PRIMARY KEY DEFAULT auth.uid(),
  discord_webhook_url text,
  notify_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own settings" ON public.app_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.discord_imports (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  line_hash text NOT NULL,
  raw_line text NOT NULL,
  kind text NOT NULL,
  target_table text,
  target_id uuid,
  amount numeric,
  quantity numeric,
  item text,
  actor text,
  logged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, line_hash)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discord_imports TO authenticated;
GRANT ALL ON public.discord_imports TO service_role;
ALTER TABLE public.discord_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own discord imports" ON public.discord_imports FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);