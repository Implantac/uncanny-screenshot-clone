# Ficha Técnica Inteligente (Fase 2 do roadmap)

Evolução incremental sobre `tech_sheets` + `tech_sheet_versions` (já existem). Nada é reconstruído.

## O que muda

### 1. Aprovação assinada (rastreabilidade)
Hoje `tech_sheets.status='aprovada'` muda sem registrar quem/quando.

**Migration** adiciona em `public.tech_sheets`:
- `approved_by uuid` (FK lógica para auth.users)
- `approved_at timestamptz`
- `approval_note text` (motivo/observação opcional)

**Trigger** `tech_sheets_stamp_approval`:
- Quando `status` muda para `'aprovada'`: preenche `approved_by = auth.uid()`, `approved_at = now()`, snapshot automático em `tech_sheet_versions` (label = "Aprovação v{N}").
- Quando sai de `'aprovada'`: limpa os campos (revogação).
- Chama `log_audit('tech_sheet', id, 'approved'|'revoked', ...)`.

### 2. Diff visual entre versões
A serverFn `diffTechSheetVersions` já existe e retorna header/materials/operations/measurements com added/removed/changed. **Falta a UI.**

**Novo componente** `src/components/tech-sheet-version-diff-dialog.tsx`:
- Seletor "De versão" × "Para versão" (usa `listTechSheetVersions`).
- Tabs: Cabeçalho · Materiais · Operações · Medidas.
- Cada linha: badge verde "adicionado", vermelho "removido", âmbar "alterado" com `de → para` por campo.
- Acessível pelo botão "Comparar versões" no `tech-sheet-versions-drawer.tsx` já existente.

### 3. Selo de aprovação na ficha
Em `tech-sheet-drawer.tsx`, quando aprovada, mostrar:
- Badge "✓ Aprovada por {nome} · {data}" (lê `approved_by` via join com `profiles`).
- Tooltip com `approval_note`.

## Detalhes técnicos

- Migration única: `ALTER TABLE` + função/trigger + GRANTs já cobertos (tabela existente).
- Sem mudança de policy (ownership atual já cobre).
- Aproveita 100% de `diffTechSheetVersions`, `createTechSheetVersion`, `listTechSheetVersions` em `src/lib/tech-sheet-versions.functions.ts`.
- Snapshot na aprovação garante o princípio "snapshot imutável" do manifesto.

## Arquivos tocados
- **Migration nova** (tech_sheets approval columns + trigger)
- `src/components/tech-sheet-version-diff-dialog.tsx` (novo)
- `src/components/tech-sheet-versions-drawer.tsx` (botão "Comparar")
- `src/components/tech-sheet-drawer.tsx` (selo de aprovação)

## Fora deste passo (próximos blocos)
- Assinatura criptográfica / PDF assinado → quando integrar storage.
- Validação obrigatória por etapa (gates por bloco) → bloco separado.
- Status por componente (tecido pendente, aviamento ok) → bloco separado.
