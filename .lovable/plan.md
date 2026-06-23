# Plano evolutivo USE MODA PLM

## ✅ Concluído
- **Protótipos & Coleções 360°** — ciclo briefing→aprovação→OP→lançamento→carry-over fechado em `/colecao-360/$id`.
- **Lote & Passagens de setor** — `LotePassagensPanel` (dwell médio, SLA por setor, gargalo atual, peça mais parada) e split de OP no card de cada referência do lote.
- **Ocorrências & CAPA inteligente** — `OccurrencesParetoPanel` (top setores, top fornecedores, gate de produtos reincidentes) plugado na aba CAPA, em cima de `CapaEffectivenessPanel` + `CapaPanel`.
- **Sala de Guerra / Exec Dashboard** — `WarRoomPanel` (gargalos cross-módulo, push p/ mobile) agora encabeça `/executivo`, junto a `ExecutiveKpisPanel`, matriz Coleção×KPI e leitura "Vital Few" por IA.
- **Segurança** — `supplier_portal_tokens.token_hash` revogado para `authenticated`/`anon`.

## Próximas frentes possíveis
- Marketing × Comercial loop (sell-in/sell-out → próximo brief).
- IA conversacional contextual por persona (PCP, Marketing, Comercial, Direção).
- Almoxarifado: contagem cíclica orientada por giro/ABC + reserva por OP.
