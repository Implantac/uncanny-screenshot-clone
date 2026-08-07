# TODO — Tarefa 3.2 RBAC por role (conclusão)

## Status: ✅ Concluído

### Etapas
- [x] **1. Product Workspace** `_app.produto.$id.tsx`
  - [x] Importar `useUserRole` + `canEditDraft/Materials/Measurements/Costs`
  - [x] Calcular flags granulares de permissão (com gate de owner + statusUnlocked)
  - [x] Aplicar nos panels BOM/BOP/Medidas/Custos e no `FichaDocument`
- [x] **2. Ficha Técnica** `_app.ficha-tecnica.tsx`
  - [x] Importar `canApproveSheet`
  - [x] `CostsPanel` usar `canEditCostsBlock` em vez de `canEdit`
  - [x] `ApproveTechSheetButton` usar `canApproveSheet(roles)` em vez de `isOwner`
- [x] **3. ApprovalMultiStage** `approval-multi-stage.tsx`
  - [x] Aplicar `canApproveSheet`/role nas decisões de etapas
- [x] **4. Verificação**
  - [x] `npx prettier --write` nos arquivos alterados
  - [x] `npx tsc --noEmit` sem novos erros
- [x] **5. Documentação**
  - [x] Atualizar checkboxes em `PLANO-MELHORIAS-POS-REVISAO.md` (§3.2)
  - [x] Atualizar `TODO.md`
