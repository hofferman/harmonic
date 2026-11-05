-- Remove a tabela de tokens do Spotify. A integração foi removida do código.
-- Não remove escala_playlists.spotify_playlist_id / spotify_playlist_url: são links já
-- criados, e a tabela também serve ao YouTube. Não remove a função update_spotify_updated_at:
-- o trigger de escala_playlists ainda a usa.
-- Destrutivo: só aplicar depois de aprovação. Os tokens do Spotify são perdidos.
DROP TABLE IF EXISTS public.spotify_tokens;
