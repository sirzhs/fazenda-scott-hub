CREATE TABLE public.animals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  category text NOT NULL,
  purchased numeric NOT NULL DEFAULT 0,
  slaughtered numeric NOT NULL DEFAULT 0,
  unit_value numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.animals TO authenticated;
GRANT ALL ON public.animals TO service_role;

ALTER TABLE public.animals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own animals"
ON public.animals FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);