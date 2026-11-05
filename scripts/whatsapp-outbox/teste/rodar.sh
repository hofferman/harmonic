#!/bin/bash
# Teste local da fila de WhatsApp e das permissões de convite.
# Precisa de um PostgreSQL local (PGBIN) e Python com psycopg. Não usa o servidor real.
# Uso: PGBIN=/caminho/bin ./rodar.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$HERE/../../.."
PGBIN="${PGBIN:-/opt/homebrew/opt/postgresql@17/bin}"
PORTA="${PORTA:-55432}"
PY="${PY:-python3}"
PSQL="$PGBIN/psql -h 127.0.0.1 -p $PORTA -U postgres"

$PSQL -d postgres -qc "DROP DATABASE IF EXISTS harm" -c "CREATE DATABASE harm"
$PSQL -d harm -v ON_ERROR_STOP=1 -qf "$HERE/01_supabase_like.sql"
$PSQL -d harm -v ON_ERROR_STOP=1 -qf "$REPO/supabase/migrations/20261104000000_add_invitations.sql"
$PSQL -d harm -v ON_ERROR_STOP=1 -qf "$REPO/supabase/migrations/20261104010000_add_whatsapp_outbox.sql"
$PSQL -d harm -v ON_ERROR_STOP=1 -qf "$REPO/supabase/migrations/20261104020000_profiles_telefone_admin.sql"
$PSQL -d harm -f "$HERE/02_rls_grants.sql"
$PSQL -d harm -v ON_ERROR_STOP=1 -f "$HERE/03_validate_invitation.sql" >/dev/null

# Servidor fake da Evolution: responde 500 para números que terminam em 0000.
pkill -f fake_evolution.py 2>/dev/null || true
"$PY" "$HERE/fake_evolution.py" &
EVO_PID=$!
trap 'kill $EVO_PID 2>/dev/null || true' EXIT
sleep 1

$PSQL -d harm -qc "TRUNCATE public.whatsapp_outbox"
$PSQL -d harm -qc "INSERT INTO public.whatsapp_outbox (destino, mensagem) VALUES ('5511988311767','convite A'), ('5511900000000','convite B falha')"
export HARMONIC_DB_URL="postgresql://postgres@127.0.0.1:$PORTA/harm" EVOLUTION_API_KEY="CHAVE-TESTE" \
       EVOLUTION_URL="http://127.0.0.1:8099" MAX_TENTATIVAS=3
for _ in 1 2 3 4; do "$PY" "$REPO/scripts/whatsapp-outbox/enviar_fila.py"; done
$PSQL -d harm -c "SELECT destino, status, tentativas, enviado_at IS NOT NULL AS enviado FROM public.whatsapp_outbox ORDER BY created_at"
