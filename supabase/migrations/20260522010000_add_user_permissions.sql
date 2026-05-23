CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  can_view_ordem_culto BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own permissions" ON public.user_permissions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can view all permissions" ON public.user_permissions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage permissions" ON public.user_permissions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.user_permissions (user_id, can_view_ordem_culto)
SELECT ur.user_id, false
FROM public.user_roles ur
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.has_ordem_culto_access(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR EXISTS (
      SELECT 1
      FROM public.user_permissions up
      WHERE up.user_id = _user_id
        AND up.can_view_ordem_culto = true
    )
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.email));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'membro');

  INSERT INTO public.user_permissions (user_id, can_view_ordem_culto)
  VALUES (NEW.id, false)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Authenticated users can view published ordens" ON public.ordens_culto;
CREATE POLICY "Users with permission can view published ordens" ON public.ordens_culto
  FOR SELECT TO authenticated USING (
    status = 'publicada'
    AND public.has_ordem_culto_access(auth.uid())
  );

DROP POLICY IF EXISTS "Authenticated users can view blocos of published ordens" ON public.ordem_culto_blocos;
CREATE POLICY "Users with permission can view blocos of published ordens" ON public.ordem_culto_blocos
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.ordens_culto oc
      WHERE oc.id = ordem_culto_id
        AND (
          public.has_role(auth.uid(), 'admin')
          OR (oc.status = 'publicada' AND public.has_ordem_culto_access(auth.uid()))
        )
    )
  );
