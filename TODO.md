# TODO - correções para o projeto

## Objetivo

Passar por correções seguras (sem quebrar execução/Lovable) e reduzir warnings/erros de tooling.

## Checklist

- [x] Diagnóstico: rodar `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` e registrar falhas.
- [x] Corrigir CSRF warning no `src/start.ts` adicionando `csrfMiddleware` em `requestMiddleware`.
- [x] Atualizar `createServerFn().inputValidator(...)` para `validator(...)`.

- [x] Re-rodar `npm run build`, `npm run lint` e `npx vitest run`.

- [x] Publicar correções na `main` do GitHub.
