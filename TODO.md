# TODO - correções para o projeto

## Objetivo

Passar por correções seguras (sem quebrar execução/Lovable) e reduzir warnings/erros de tooling.

## Checklist

- [x] Diagnóstico: rodar `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` e registrar falhas.
- [ ] Corrigir CSRF warning no `src/start.ts` adicionando `csrfMiddleware` em `requestMiddleware`.
- [x] Atualizar `createServerFn().inputValidator(...)` para `validator(...)` (parcial — revisado em `src/lib/*.functions.ts` iniciais).

- [ ] Re-rodar `npm run build` (lint pode continuar falhando por regra `no-explicit-any`).

- [ ] Criar branch `blackboxai/` e preparar commit para GitHub.
