-- Add ministro_id column to escala_musicas table
ALTER TABLE public.escala_musicas 
ADD COLUMN ministro_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_escala_musicas_ministro ON public.escala_musicas(ministro_id);