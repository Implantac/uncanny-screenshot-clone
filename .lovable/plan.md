# Plano evolutivo USE MODA PLM

## ✅ Concluído
- **Protótipos & Coleções 360°** — ciclo briefing→aprovação→OP→lançamento→carry-over fechado em `/colecao-360/$id` com 7 abas, deep-link a partir do protótipo, filtro por coleção em `/prototipos` e CTA sell-through→carry-over.
- **Lote & Passagens de setor** — `LotePassagensPanel` agrega `production_stage_log`, mostra dwell médio por setor, gargalo atual, SLA realizado vs configurado (`pcp_stages.sla_stuck_days`) e peça mais parada; split de OP exposto direto no card de cada OP do lote.
- **Segurança** — `token_hash` de `supplier_portal_tokens` revogado para `authenticated`/`anon` (só `service_role` lê).

## Próximas frentes
1. **Ocorrências & CAPA inteligente** — causa raiz, Pareto setor/fornecedor, efetividade CAPA, gate de reincidência.
2. **Sala de Guerra / Exec Dashboard** — torre executiva: SLA coleção, gargalo global, risco financeiro, decisões registradas.
