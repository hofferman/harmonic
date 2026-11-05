# Fila de WhatsApp do Harmonic

Convites (e no futuro avisos) entram na tabela `public.whatsapp_outbox` pela Edge Function
`send-whatsapp-invitation`. Este script lê a fila e envia pela Evolution API, que só escuta
em `127.0.0.1:8080` no VPS.

## Instalação no servidor (feita pelo Deployer ou pelo Gabriel)

1. Aplicar a migration `20261104010000_add_whatsapp_outbox.sql`.
2. `pip install "psycopg[binary]"` no Python do host.
3. Copiar `harmonic-outbox.env.example` para `/etc/harmonic-outbox.env`, `chmod 600`, e preencher.
4. Copiar esta pasta para `/opt/harmonic/scripts/whatsapp-outbox/`.
5. Copiar `harmonic-outbox.service` e `harmonic-outbox.timer` para `/etc/systemd/system/`.
6. `systemctl daemon-reload && systemctl enable --now harmonic-outbox.timer`.
7. Conferir: `journalctl -u harmonic-outbox.service -n 20`.

## Teste local

`teste/rodar.sh` sobe um banco de teste com as migrations, roda as checagens de permissão
(`02_rls_grants.sql`, `03_validate_invitation.sql`) e envia a fila contra um servidor fake da Evolution
(`fake_evolution.py`). Requer PostgreSQL local e Python com `psycopg`.

## Limites

- Entrega de hora em hora: até 1 minuto de atraso.
- Se a Evolution aceitar e o processo cair antes do commit, a mensagem pode ser enviada de novo.
- A tela de Membros não mostra se a mensagem já saiu. Para conferir, consulte `whatsapp_outbox`.
