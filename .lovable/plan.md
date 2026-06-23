# Plano evolutivo USE MODA PLM

## ✅ Concluído
- **Protótipos & Coleções 360°** — ciclo briefing→aprovação→OP→lançamento→carry-over fechado em `/colecao-360/$id`.
- **Lote & Passagens de setor** — `LotePassagensPanel` (dwell médio, SLA por setor, gargalo atual, peça mais parada) e split de OP no card de cada referência do lote.
- **Ocorrências & CAPA inteligente** — `OccurrencesParetoPanel` (top setores, top fornecedores, gate de produtos reincidentes) plugado na aba CAPA, em cima de `CapaEffectivenessPanel` + `CapaPanel`.
- **Sala de Guerra / Exec Dashboard** — `WarRoomPanel` (gargalos cross-módulo, push p/ mobile) agora encabeça `/executivo`, junto a `ExecutiveKpisPanel`, matriz Coleção×KPI e leitura "Vital Few" por IA.
- **Segurança** — `supplier_portal_tokens.token_hash` revogado para `authenticated`/`anon`.
- **Reserva de material por OP** — tabela `material_reservations` + view `inventory_items_available` (saldo líquido das reservas). Trigger ao aprovar OP gera reservas a partir da ficha aprovada (consumo × perda × qtd). Cancelar libera; concluir consome; saída de estoque vinculada à OP abate a reserva. Painel "Materiais necessários" do lote agora mostra disponível líquido e quanto já está reservado para o próprio lote.
- **Módulo 18 — Central de Alertas Inteligentes** — rota `/alertas` agrega sinais já existentes (estoque crítico, OP atrasada, OP parada > SLA do estágio, CAPA aberta/vencida, protótipo paralisado, marketing) em um único inbox priorizado por severidade (crítica/alta/média/baixa) com explicação "por que está aqui" e ações em 1 clique (Ir para · Adiar 7d · Resolver). Reusa `alert_dismissals` e o sino existente; sino ganhou rodapé "Ver Central completa →". Sem novas tabelas.

## Próximas frentes possíveis
- Marketing × Comercial loop fino (closed-loop existe — falta hook automático no próximo brief).
- IA conversacional contextual: aprofundar persona-aware (já temos copilot + ai-coordinator).
- Almoxarifado: contagem cíclica ABC já existe — falta amarrar plano de contagem ao calendário.

