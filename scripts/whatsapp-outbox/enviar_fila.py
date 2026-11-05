#!/usr/bin/env python3
"""Envia a fila public.whatsapp_outbox pela Evolution API.

Roda no host do VPS (a Evolution só escuta em 127.0.0.1:8080). Executado a cada
minuto pelo systemd timer harmonic-outbox.timer. Configuração por variáveis de
ambiente, em /etc/harmonic-outbox.env no servidor (nunca no repositório).

Cada lote roda em uma transação com FOR UPDATE SKIP LOCKED. Se o processo cair
no meio, a transação volta e a mensagem continua pendente. Se a Evolution aceitou
a mensagem e o processo caiu antes do commit, ela pode ser enviada de novo.
"""

import json
import os
import sys
import urllib.request

import psycopg

DB_URL = os.environ["HARMONIC_DB_URL"]
EVO_URL = os.environ.get("EVOLUTION_URL", "http://127.0.0.1:8080").rstrip("/")
EVO_KEY = os.environ["EVOLUTION_API_KEY"]
INSTANCIA = os.environ.get("EVOLUTION_INSTANCE", "harmonic")
MAX_TENTATIVAS = int(os.environ.get("MAX_TENTATIVAS", "3"))
LOTE = int(os.environ.get("LOTE", "10"))
DELAY_MS = 1200  # atraso entre envios, o mesmo usado pelo aviso de escala


def enviar(destino: str, texto: str) -> None:
    corpo = json.dumps({"number": destino, "text": texto, "delay": DELAY_MS}).encode()
    req = urllib.request.Request(
        f"{EVO_URL}/message/sendText/{INSTANCIA}",
        data=corpo,
        method="POST",
        headers={"Content-Type": "application/json", "apikey": EVO_KEY},
    )
    # urlopen levanta HTTPError para 4xx/5xx, então status fora de 2xx não passa.
    with urllib.request.urlopen(req, timeout=30) as resp:
        if not 200 <= resp.status < 300:
            raise RuntimeError(f"HTTP {resp.status}")


def main() -> int:
    enviados = 0
    falhas = 0
    with psycopg.connect(DB_URL) as conn:
        with conn.transaction():
            linhas = conn.execute(
                """
                SELECT id, destino, mensagem, tentativas
                FROM public.whatsapp_outbox
                WHERE status = 'pendente'
                ORDER BY created_at
                LIMIT %s
                FOR UPDATE SKIP LOCKED
                """,
                (LOTE,),
            ).fetchall()

            for id_, destino, mensagem, tentativas in linhas:
                tentativa = tentativas + 1
                try:
                    enviar(destino, mensagem)
                    conn.execute(
                        """
                        UPDATE public.whatsapp_outbox
                        SET status = 'enviado', enviado_at = now(), tentativas = %s, erro = NULL
                        WHERE id = %s
                        """,
                        (tentativa, id_),
                    )
                    enviados += 1
                except Exception as exc:  # falha de rede ou da Evolution: conta a tentativa
                    status = "falhou" if tentativa >= MAX_TENTATIVAS else "pendente"
                    conn.execute(
                        """
                        UPDATE public.whatsapp_outbox
                        SET status = %s, tentativas = %s, erro = %s
                        WHERE id = %s
                        """,
                        (status, tentativa, str(exc)[:500], id_),
                    )
                    falhas += 1

    # Sem telefone nem texto no log: só contagens e ids.
    print(f"fila: {len(linhas)} lidas, {enviados} enviadas, {falhas} com erro", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
