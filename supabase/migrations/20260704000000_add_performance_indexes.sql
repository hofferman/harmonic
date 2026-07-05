-- Performance indexes for the main Harmonic screens.
-- These match the filters and ordering used by the React app and RLS helper
-- functions. Existing primary keys and unique constraints already cover some
-- lookups, so this migration avoids duplicating those.

-- Escalas list and dashboard: upcoming/past schedules ordered by date, often
-- segmented by ministry.
CREATE INDEX IF NOT EXISTS idx_escalas_data_id
  ON public.escalas (data, id);

CREATE INDEX IF NOT EXISTS idx_escalas_setor_data
  ON public.escalas (setor_id, data);

-- Member assignments: user dashboard, RLS membership checks, and schedule
-- detail ordered by role/ministry.
CREATE INDEX IF NOT EXISTS idx_escala_membros_profile_escala
  ON public.escala_membros (profile_id, escala_id);

CREATE INDEX IF NOT EXISTS idx_escala_membros_escala_funcao
  ON public.escala_membros (escala_id, funcao_na_escala);

CREATE INDEX IF NOT EXISTS idx_escala_membros_setor_profile
  ON public.escala_membros (setor_id, profile_id);

-- Schedule songs: detail pages order by song order; the editor also looks up
-- the last time each song was used.
CREATE INDEX IF NOT EXISTS idx_escala_musicas_escala_ordem
  ON public.escala_musicas (escala_id, ordem);

CREATE INDEX IF NOT EXISTS idx_escala_musicas_musica_created_at
  ON public.escala_musicas (musica_id, created_at DESC);

-- Member setup screens: list a member's functions and reverse-look up ministry
-- membership without relying only on the unique (profile_id, setor_id) index.
CREATE INDEX IF NOT EXISTS idx_membros_funcoes_profile
  ON public.membros_funcoes (profile_id);

CREATE INDEX IF NOT EXISTS idx_membros_setores_setor_profile
  ON public.membros_setores (setor_id, profile_id);

-- Music and people lists are displayed alphabetically.
CREATE INDEX IF NOT EXISTS idx_profiles_nome
  ON public.profiles (nome);

CREATE INDEX IF NOT EXISTS idx_musicas_titulo
  ON public.musicas (titulo);

-- Ordem de culto list and RLS checks. idx_ordens_culto_data and
-- idx_ordens_culto_escala already exist, but status + data is better for the
-- published-orders path used by non-admin users.
CREATE INDEX IF NOT EXISTS idx_ordens_culto_status_data
  ON public.ordens_culto (status, data);
