# Como contribuir

Projeto proprietário (veja `LICENSE`). Contribuições são aceitas apenas de
pessoas autorizadas pelo titular e, ao enviar código, você cede os direitos
patrimoniais sobre ele.

## Fluxo de branches

```
main          produção — protegida, só recebe merge via PR
develop       integração — base das features
feat/<nome>   funcionalidade nova
fix/<nome>    correção
hotfix/<nome> correção urgente, sai de main
```

Nunca commite direto na `main`.

```bash
git switch develop && git pull
git switch -c feat/aviso-whatsapp
# ... trabalho ...
git push -u origin feat/aviso-whatsapp
```

## Mensagens de commit

Padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/) —
é o que alimenta as notas de release e o versionamento.

```
feat:     funcionalidade nova          → sobe MINOR (0.2.0)
fix:      correção de bug              → sobe PATCH (0.1.1)
docs:     documentação
refactor: refatoração sem mudar efeito
perf:     desempenho
test:     testes
chore:    build, deps, configuração
```

Mudança incompatível: use `!` (ex.: `feat!: trocar formato da escala`) e
descreva o impacto no corpo. Sobe MAJOR.

Exemplos reais deste projeto:

```
feat(membros): cadastro de WhatsApp para aviso de escala
fix(escalas): corrigir ordem do repertório começando em zero
chore(ci): adicionar verificação de segredos
```

## Antes de abrir o PR

```bash
npm run lint          # ainda há dívida no código legado
npx tsc --noEmit -p tsconfig.app.json
npm run build         # este precisa passar
```

## Pull Request

- Preencha o template (preenchido automaticamente).
- PR pequeno é revisado rápido; PR gigante trava.
- A CI precisa estar verde para fazer merge.
- Use **Squash and merge** — mantém a `main` legível.

## Segredos

Nunca commite `.env`, chave de serviço, senha ou token. A CI tem um job que
procura esses padrões e falha o PR. Se um segredo vazar, avise imediatamente:
não basta remover no commit seguinte, a credencial precisa ser rotacionada.

## Versões

Seguimos [SemVer](https://semver.org/lang/pt-BR/): `MAJOR.MINOR.PATCH`.

Para publicar:

```bash
npm version minor -m "chore(release): v%s"
git push --follow-tags
```

A tag dispara o workflow de release, que gera o pacote e as notas.
