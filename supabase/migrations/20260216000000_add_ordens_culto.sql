-- Create ordens_culto table
CREATE TABLE public.ordens_culto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  titulo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'publicada')),
  escala_id UUID REFERENCES public.escalas(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ordem_culto_blocos table
CREATE TABLE public.ordem_culto_blocos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_culto_id UUID NOT NULL REFERENCES public.ordens_culto(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('abertura', 'louvor', 'oracao_oferta', 'avisos', 'pregacao', 'encerramento', 'especial')),
  ordem INTEGER NOT NULL DEFAULT 0,
  conteudo JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_ordens_culto_data ON public.ordens_culto(data);
CREATE INDEX idx_ordens_culto_escala ON public.ordens_culto(escala_id);
CREATE INDEX idx_ordem_culto_blocos_ordem ON public.ordem_culto_blocos(ordem_culto_id, ordem);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.ordens_culto
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Enable RLS
ALTER TABLE public.ordens_culto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordem_culto_blocos ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ordens_culto
CREATE POLICY "Admins can do everything with ordens_culto" ON public.ordens_culto
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view published ordens" ON public.ordens_culto
  FOR SELECT TO authenticated USING (status = 'publicada');

-- RLS Policies for ordem_culto_blocos
CREATE POLICY "Admins can manage ordem blocos" ON public.ordem_culto_blocos
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view blocos of published ordens" ON public.ordem_culto_blocos
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.ordens_culto oc
      WHERE oc.id = ordem_culto_id AND (oc.status = 'publicada' OR public.has_role(auth.uid(), 'admin'))
    )
  );
