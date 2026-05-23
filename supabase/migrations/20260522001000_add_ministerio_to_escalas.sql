ALTER TABLE public.escalas
  ADD COLUMN setor_id UUID REFERENCES public.setores(id);

UPDATE public.escalas e
SET setor_id = s.id
FROM public.setores s
WHERE s.nome = 'Louvor'
  AND e.setor_id IS NULL;

ALTER TABLE public.escalas
  ALTER COLUMN setor_id SET NOT NULL;
