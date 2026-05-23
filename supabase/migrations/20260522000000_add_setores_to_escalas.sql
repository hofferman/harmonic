CREATE TABLE public.setores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.membros_setores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  setor_id UUID NOT NULL REFERENCES public.setores(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (profile_id, setor_id)
);

ALTER TABLE public.escala_membros
  ADD COLUMN setor_id UUID REFERENCES public.setores(id);

INSERT INTO public.setores (nome)
VALUES ('Louvor'), ('Farol'), ('Acesso')
ON CONFLICT (nome) DO NOTHING;

UPDATE public.escala_membros em
SET setor_id = s.id
FROM public.setores s
WHERE s.nome = 'Louvor'
  AND em.setor_id IS NULL;

INSERT INTO public.membros_setores (profile_id, setor_id)
SELECT DISTINCT mf.profile_id, s.id
FROM public.membros_funcoes mf
JOIN public.setores s ON s.nome = 'Louvor'
ON CONFLICT (profile_id, setor_id) DO NOTHING;

INSERT INTO public.membros_setores (profile_id, setor_id)
SELECT DISTINCT em.profile_id, s.id
FROM public.escala_membros em
JOIN public.setores s ON s.nome = 'Louvor'
ON CONFLICT (profile_id, setor_id) DO NOTHING;

ALTER TABLE public.escala_membros
  ALTER COLUMN setor_id SET NOT NULL;

ALTER TABLE public.membros_setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view setores" ON public.setores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage setores" ON public.setores
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view member sectors" ON public.membros_setores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage member sectors" ON public.membros_setores
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.escala_membros
  ADD CONSTRAINT escala_membros_unique_profile_per_escala UNIQUE (escala_id, profile_id);
