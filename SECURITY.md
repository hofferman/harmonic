# Política de Segurança

## Reportar uma vulnerabilidade

**Não abra issue pública para falha de segurança.**

Use *Security → Report a vulnerability* no GitHub, ou contate o titular
diretamente. Retorno em até 72 horas.

Inclua: o que é a falha, como reproduzir, e o impacto que você enxerga.

## Escopo

Interessam especialmente:

- Falhas de RLS que permitam ler ou alterar dados de outra pessoa
- Escalada de privilégio de `membro` para `admin`
- Burlar autenticação
- Exposição de dados pessoais (telefone, e-mail)
- Injeção de SQL ou XSS

## Práticas do projeto

- Toda tabela tem RLS habilitada; acesso é validado no banco, não no frontend.
- O frontend usa apenas a chave anônima. `service_role` nunca vai ao cliente.
- A CI falha o PR se encontrar padrão de segredo no diff.
- Mudança de RLS deve ser declarada no PR, dizendo quem ganha ou perde acesso.

## Se um segredo vazar

Remover do commit **não basta** — o histórico do Git preserva. É preciso
rotacionar a credencial. Avise o titular imediatamente.
