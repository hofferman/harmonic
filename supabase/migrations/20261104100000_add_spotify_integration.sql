-- Spotify Integration Tables for Harmonic

-- Table to store the admin's Spotify tokens (only one record)
CREATE TABLE IF NOT EXISTS spotify_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    spotify_user_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure only one row exists
CREATE UNIQUE INDEX IF NOT EXISTS spotify_tokens_singleton ON spotify_tokens ((TRUE));

-- Table to link escalas with their Spotify/YouTube playlists
CREATE TABLE IF NOT EXISTS escala_playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escala_id UUID NOT NULL REFERENCES escalas(id) ON DELETE CASCADE,
    spotify_playlist_id TEXT,
    spotify_playlist_url TEXT,
    youtube_playlist_id TEXT,
    youtube_playlist_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(escala_id)
);

-- Enable RLS
ALTER TABLE spotify_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE escala_playlists ENABLE ROW LEVEL SECURITY;

-- RLS Policies for spotify_tokens (only admins can read/write)
CREATE POLICY "Admins can read spotify_tokens" ON spotify_tokens
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    );

CREATE POLICY "Admins can insert spotify_tokens" ON spotify_tokens
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    );

CREATE POLICY "Admins can update spotify_tokens" ON spotify_tokens
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    );

-- RLS Policies for escala_playlists (all authenticated users can read, only admins can write)
CREATE POLICY "Authenticated users can read escala_playlists" ON escala_playlists
    FOR SELECT TO authenticated
    USING (TRUE);

CREATE POLICY "Admins can insert escala_playlists" ON escala_playlists
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    );

CREATE POLICY "Admins can update escala_playlists" ON escala_playlists
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    );

CREATE POLICY "Admins can delete escala_playlists" ON escala_playlists
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur 
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_spotify_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_spotify_tokens_updated_at ON spotify_tokens;
CREATE TRIGGER update_spotify_tokens_updated_at
    BEFORE UPDATE ON spotify_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_spotify_updated_at();

DROP TRIGGER IF EXISTS update_escala_playlists_updated_at ON escala_playlists;
CREATE TRIGGER update_escala_playlists_updated_at
    BEFORE UPDATE ON escala_playlists
    FOR EACH ROW
    EXECUTE FUNCTION update_spotify_updated_at();
