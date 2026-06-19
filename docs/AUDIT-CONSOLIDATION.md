# Auditoria de Consolidação — USE MODA PLM

> Foco: Coleção → Produto → Piloto → Ficha → PCP → Produção → Marketing.
> Tudo fora desse fluxo é candidato a esconder, mesclar ou marcar como ERP-mirror.

## Telas redundantes (candidatas a merge)

| Mantém                                                                                                   | Funde / Esconde                                 | Motivo                                     |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------ |
| `/pcp-kanban`                                                                                            | `/pcp` (lista plana)                            | Kanban já mostra tudo + drag-drop          |
| `/control-tower`                                                                                         | `/stock-health`, `/replenishment`               | Mesmas métricas de cobertura e necessidade |
| `/colecao-360`                                                                                           | `/colecoes` (lista CRUD)                        | 360 é a tela rica; lista vira drawer       |
| `/marketing`                                                                                             | `/campaigns`, `/influencers`, `/influencer-roi` | Marketing Intelligence consolida em abas   |
| `/financeiro`, `/cashflow`, `/fpa`, `/margem`, `/profitability`                                          | TODOS marcados como ERP-mirror                  | PLM não cria nem edita financeiro          |
| `/clientes`, `/representantes`, `/comercial`, `/omnichannel`, `/sales-performance`, `/geo-sales`, `/b2b` | TODOS marcados como ERP-mirror                  | CRM/Vendas é do ERP                        |
| `/almoxarifado`, `/movimentacoes`, `/compras`, `/pedidos-compra`                                         | ERP-mirror (somente leitura)                    | Estoque/Compras vive no ERP                |

## Telas órfãs (sem entrada clara no fluxo)

- `/mobile` — placeholder; só faz sentido com PWA real. **Esconder.**
- `/data-lake` — sem datasource definido. **Esconder até integrar.**
- `/twin-factory`, `/closed-loop` — conceito; sem CRUD. **Mover para roadmap.**
- `/fashion-gpt`, `/use-ai` — duplicam `/intel-hub` + agentes. **Fundir em /intel-hub.**

## Fluxo canônico (o que o menu deve refletir)

```
1. CRIAR        Coleções · Produtos · Materiais · CAD
2. DESENVOLVER  Designer Workspace · Pilotos · Fit Sessions · Aprovações · Ficha Técnica
3. ENGENHARIA   Variantes · Target Costing · Sourcing · RFQ
4. PCP          PCP Kanban · Stages · Capacidade · Centro de Corte · Lotes · Pacotes
5. PRODUÇÃO     Produção do Dia · Terceirizados · Inspeções · Qualidade
6. RASTREAR     Cadeia 360 · DPP · Sustentabilidade
7. MARKETING    Marketing Intelligence · Campanhas · Influencers · ROI · Showroom
8. INTELIGÊNCIA Command Center · Intel Hub · BI · Trends
9. ERP MIRROR   Vendas · Compras · Estoque · Financeiro (somente leitura)
```

## Próximos passos

1. Marcar `hidden: true` nas órfãs em `src/lib/modules.ts`.
2. Fundir `/pcp` → redirect para `/pcp-kanban`.
3. Marcar todo o grupo Financeiro/CRM como `source: "erp-mirror"` para receber o badge ERP no menu.
4. Recriar `/marketing` como hub com abas internas (Campanhas, Influencers, ROI, Sell-out, Showroom).
