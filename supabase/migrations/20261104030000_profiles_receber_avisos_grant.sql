-- Toggle de avisos de escala (Membros) grava profiles.receber_avisos.
-- A migration 20261104020000 já pode ter sido aplicada sem esse campo no GRANT,
-- então esta migration garante a coluna e o privilégio de forma idempotente.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS receber_avisos BOOLEAN NOT NULL DEFAULT true;
GRANT UPDATE (receber_avisos) ON public.profiles TO authenticated;
