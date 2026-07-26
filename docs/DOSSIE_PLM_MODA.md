# Dossiê Mestre: PLM para Confecção/Moda (2024–2026)

> Documento de referência técnica para uso como memória permanente de projeto. Compilado a partir de fornecedores líderes (Centric, Lectra/Gerber, Bamboo Rose, Backbone, PTC, Coats Digital), literatura acadêmica de engenharia têxtil (UTFPR, IFSC) e fontes regulatórias (UE/ESPR).

---

## 1. Definição e escopo do PLM de moda

**PLM (Product Lifecycle Management)** de moda é a plataforma e o conjunto de processos que gerenciam o ciclo de vida de uma peça de vestuário desde a ideia (trend/moodboard) até a descontinuação, centralizando dados de design, ficha técnica, custo, fornecedor, qualidade e sustentabilidade em um único "single source of truth" (fonte única da verdade) [Centric Software](https://www.centricsoftware.com/pt-pt/fashion-apparel).

**Diferenças vs. PLM industrial genérico (indústria discreta/manufatura pesada):**
- **Sazonalidade extrema**: coleções (2, 4, 6 ou "drops" contínuos) substituem o conceito de produto de ciclo longo; um "SKU" de moda pode viver 8-16 semanas no ponto de venda.
- **Explosão combinatória de variantes**: mesma modelagem gera dezenas de SKUs por cor x tamanho x estampa x grade, algo raro em PLM de máquinas/eletrônicos.
- **Criatividade não estruturada + rigor industrial**: o processo nasce subjetivo (moodboard, croqui, tendência) e precisa convergir para uma ficha técnica objetiva e mensurável.
- **Fit/corpo humano**: variável antropométrica (tabela de medidas, grade, prova em manequim/fit model) não existe em PLM de bens duros.
- **Matéria-prima viva**: tecido tem variação de lote, encolhimento, tingimento, gramatura — exige tolerância e AQL específicos.
- **Cadeia fragmentada e terceirizada**: facção, lavanderia, bordado e silk são frequentemente subcontratados, exigindo rastreabilidade multi-fornecedor.
- **Ciclo comercial acoplado**: sell-in/sell-out e giro de estoque retroalimentam o desenvolvimento da próxima coleção (loop de aprendizado), diferente de PLM de produto industrial com ciclos de anos.

PLMs genéricos (Windchill, Teamcenter) tratam BOM de engenharia estática; PLM de moda precisa de **BOM colorway-aware**, calendário de coleção, biblioteca de tendências e integração nativa com CAD 2D/3D de moda (Gerber AccuMark, CLO3D, Browzwear) [Lectra](https://www.lectra.com/en/fashion/products/gerber-yunique-plm).

---

## 2. Fluxo canônico (7–10 fases)

1. **Pesquisa/Trend** — cool hunting, relatórios de tendência (WGSN, Heuritech), análise de vendas históricas.
2. **Design/Moodboard** — croqui, paleta de cor, referências, briefing de coleção.
3. **Desenvolvimento** — escolha de tecido/aviamento, primeira modelagem, protótipo conceitual.
4. **Ficha Técnica (Tech Pack)** — documento mestre de especificação (ver seção 3).
5. **Piloto/Prototipagem** — 1ª amostra física, ajuste de modelagem e costura.
6. **Aprovação/Fit** — sessão de prova (fit session) em manequim ou fit model; PP Sample (Pre-Production Sample); gate de aprovação.
7. **Sourcing/Sampling** — cotação de matéria-prima e fornecedores, amostras de referência (salesman sample), negociação de preço.
8. **PCP (Planejamento e Controle da Produção)** — programação de corte, capacidade, ordens de produção (cut ticket).
9. **Produção** — corte, bordado/silk, costura, lavanderia, acabamento, embalagem.
10. **Qualidade** — inspeção por lote (AQL), auditoria final.
11. **Comercial** — showroom, catálogo, distribuição, sell-in para varejo/franquias.
12. **Sell-through** — monitoramento de giro em loja (sell-out), curva ABC.
13. **Loop de aprendizado** — dados de sell-through retroalimentam o próximo ciclo de trend/design, fechando o círculo do PLM.

Este fluxo é o "backbone" de todo PLM de moda comercial (Centric, PLM365, Backbone) e mapeia diretamente para os módulos de calendário de coleção, biblioteca de materiais, tech pack digital e portal de fornecedores dessas plataformas.

---

## 3. Ficha Técnica (Tech Pack) — anatomia completa

O Tech Pack é o "contrato técnico" entre design, desenvolvimento, fornecedor e fábrica. Estrutura padrão de mercado:

- **Capa/Header**: nome/código do modelo, coleção, temporada, estilista responsável, data, versão (revision control), status (draft/aprovado/liberado).
- **Croqui técnico (flat sketch)**: desenho plano frente/costas com detalhes de costura, sem estilização artística.
- **Tabela de medidas e grade (Spec Sheet / Measurement Chart)**: pontos de medida (PDM) com tolerância (± cm), por tamanho (P/M/G ou numérico), base de grade.
- **BOM (Bill of Materials)** — materiais: tecido principal, forro, entretela, aviamentos.
- **BOP (Bill of Process/Operations)** — sequência de operações de costura e tempos.
- **Silk/Estampa/Bordado**: arte-final, posicionamento (placement), Pantone, tipo de aplicação (sublimação, DTF, bordado computadorizado), ficha de arte separada.
- **Aviamentos**: botão, zíper, ilhós, elástico, cadarço — com referência de fornecedor e código.
- **Acabamento**: tipo de barra, acabamento de lavanderia (estonagem, amaciante), passadoria.
- **Embalagem**: dobra, saco plástico, cartela, hangtag, código de barras.
- **Etiqueta**: composição têxtil, instruções de cuidado, tamanho, país de origem, compliance (INMETRO no Brasil).
- **Versionamento e aprovação por gates**: cada revisão do tech pack (Rev A, B, C) deve ser aprovada em um "gate" (design → fit → produção) com trilha de auditoria — este é o principal ganho de um PLM digital vs. planilhas Excel, pois elimina "qual é a versão certa" na fábrica.

---

## 4. BOM vs. BOP

- **BOM (Bill of Materials)** = **lista de materiais/insumos**: o "o quê" — tecido, forro, aviamento, embalagem, com quantidade, unidade de consumo, fornecedor e custo unitário. Ex.: 1,20 m de malha 100% algodão por unidade P, 1 zíper 20cm, 4 botões.
- **BOP (Bill of Process/Operations)** = **lista de operações/sequência de fabricação**: o "como" — cada operação de costura (ex.: pesponto, fechamento de ombro, aplicação de gola), máquina requerida, tempo padrão (SAM/SMV), e ordem no fluxo de costura.
- **Relação com custo**: BOM alimenta o **custo de matéria-prima** (CMP); BOP alimenta o **custo de mão de obra** (CMO) via tempo-padrão x custo-hora. Custo total da peça = CMP + CMO + overhead + margem.
- **Consumo, perda e encolhimento**: o BOM real de produção difere do BOM teórico por: (a) **perda de encaixe** no corte (tecido não aproveitado no marker/plano de corte, tipicamente 5-15%), (b) **encolhimento** pós-lavagem/tingimento (exige teste de encolhimento antes de definir consumo final), (c) **quebra de aviamento** (defeitos, perdas no processo). Um bom PLM/PCP recalcula consumo real x teórico para ajustar custo-padrão vs. custo real (ver KPI seção 13).

---

## 5. PCP têxtil — setores, capacidade e gargalos

**Setores reais da cadeia de confecção** (conforme literatura de engenharia têxtil, UTFPR/IFSC):
- **Compras**: aquisição de tecido e aviamento, geralmente com lead time crítico (30-90 dias para tecido importado).
- **Corte**: encaixe (marker making), enfesto (layering do tecido em múltiplas camadas), corte propriamente dito; lote de corte gera o "cut ticket" (ordem de corte) — unidade básica de rastreabilidade do PCP.
- **Bordado**: célula com máquinas multi-cabeça, gargalo comum por tempo de setup de matriz.
- **Silk/Estampa**: silk manual, rotativa, digital (DTF/sublimação); gargalo por tempo de secagem/cura.
- **Costura**: organizada em células ou linha reta; unidade de capacidade = peças/hora por operador ou por célula.
- **Lavanderia**: processo em batelada (lote), gargalo por capacidade de máquina de lavar industrial e tempo de secagem.
- **Acabamento**: revisão, passadoria, etiquetagem.
- **Expedição**: conferência final, embalagem para distribuição.

**Lote como unidade de PCP**: diferente de manufatura discreta unitária, a confecção programa por **lote de corte** (ex.: 500 peças de um mesmo modelo/cor), que atravessa os setores como um bloco, permitindo rastreabilidade e alocação de capacidade por célula.

**Terceirização (facção)**: é comum enviar etapas (especialmente costura e bordado) para facções externas; o PCP precisa gerenciar **capacidade externa** com prazos de retorno e controle de qualidade de entrada.

**Capacidade por célula e gargalos típicos**: gargalos mais frequentes citados na literatura são (1) tempo de setup em bordado/silk, (2) dependência de matéria-prima com lead time longo, (3) capacidade de lavanderia subdimensionada, (4) variabilidade de produtividade em facções terceirizadas.

**APS/MRP aplicado à moda**: sistemas de **APS (Advanced Planning & Scheduling)** e **MRP** adaptados para moda precisam lidar com múltiplos códigos de cor/tamanho por modelo e replanejamento rápido por causa de repique (reorder) de itens de giro rápido — diferente do MRP clássico de manufatura com demanda mais estável [RZ Sistemas PCP Confecção](https://www.rzsistemas.com.br/pcp-confeccao/).

---

## 6. Qualidade em confecção

- **AQL (Acceptable Quality Level)**: norma de amostragem estatística (baseada na ISO 2859 / ANSI-ASQ Z1.4) usada para inspeção por lote — define tamanho de amostra e número máximo de defeitos aceitável (ex.: AQL 2.5 para defeitos maiores, comum em vestuário) [Algo Bert Fashion Guide](https://algobertfashion.com/pt/guia-de-controlo-da-qualidade-do-vestuario/).
- **Inspeção por lote**: pode ocorrer em 3 pontos — durante produção (DPI - During Production Inspection), pré-embarque (PSI - Pre-Shipment Inspection), e final (FRI - Final Random Inspection).
- **Defeitos típicos**:
  - *Costura*: pesponto torto, pontos pulados, aviamento mal fixado, medida fora de tolerância.
  - *Tingimento*: manchas, diferença de tonalidade entre lotes (partida de cor), sangramento de cor.
  - *Medida*: fora da tabela de grade (tolerância excedida).
  - *Silk/estampa*: descolamento, posicionamento incorreto, cor fora do Pantone aprovado.
- **CAPA (Corrective and Preventive Action)**: processo formal de tratamento de não-conformidade — ação corretiva imediata (retrabalho/reprovação de lote) + ação preventiva (ajuste de processo/fornecedor) para evitar recorrência.
- **FPY (First Pass Yield)**: percentual de peças aprovadas na primeira inspeção sem retrabalho — indicador central de eficiência de qualidade.
- **Causa raiz**: normalmente investigada via 5 Porquês ou diagrama de Ishikawa, cruzando dados de fornecedor, lote de tecido, operador e máquina — ganho real quando o PLM conecta o histórico de fornecedor/material ao registro de defeito.

---

## 7. Sourcing & fornecedores

- **Score de fornecedor**: avaliação multi-critério (qualidade/FPY, prazo/OTIF, preço, capacidade, compliance social/ambiental), usada para priorizar alocação de pedidos.
- **RFQ (Request for Quotation)**: processo formal de cotação com múltiplos fornecedores a partir do tech pack e BOM, comparando preço, MOQ (quantidade mínima) e lead time.
- **Target costing**: a marca define o preço-alvo de venda e "trabalha de trás para frente" o custo-alvo de fábrica (target cost) que o sourcing deve atingir — inverso do "cost-plus" tradicional.
- **Cost breakdown de peça de vestuário** (estrutura típica): matéria-prima (tecido ~40-50%), aviamentos (~5-10%), mão de obra/CMT (Cut-Make-Trim, ~15-25%), overhead de fábrica, frete/logística, margem do fornecedor, impostos — a soma compõe o FOB, e depois markup do varejo (2,5x-4x FOB é comum em moda).

---

## 8. Coleção e sell-through

- **Mix de coleção**: balanceamento entre itens "básicos" (giro constante), "moda" (alto risco/alto giro em janela curta) e "vitrine" (baixo giro, alto valor de imagem).
- **Curva ABC**: classificação de SKUs por contribuição de faturamento/margem (A = 20% dos itens gerando 80% do resultado) — usada para decisão de reposição.
- **Sell-in vs. sell-out**: sell-in = venda da marca para o varejo/franquia; sell-out = venda do varejo para o consumidor final. Divergência entre os dois é sinal de excesso de estoque no canal.
- **ROI de coleção**: receita gerada / investimento em desenvolvimento + produção + marketing daquela coleção; PLM que rastreia custo real por SKU permite calcular ROI por modelo, não só por coleção agregada.
- **Decisão repetir/repaginar/descontinuar**: baseada em sell-through nas primeiras 4-8 semanas — repetir (reorder do mesmo modelo), repaginar (nova cor/estampa sobre a mesma modelagem aprovada — "carry-over"), ou descontinuar (liquidar e não repor).

---

## 9. Marketing de moda ligado ao PLM

- **Campanhas por produto/coleção**: o calendário de marketing deve estar sincronizado ao calendário de PLM (data de liberação do tech pack final → data de produção de conteúdo/fotografia → data de lançamento de campanha).
- **Influencer ROI**: métricas de conversão (cupom/link por influenciador) cruzadas com sell-through do SKU divulgado — PLMs mais avançados e plataformas de PIM/DAM integradas permitem rastrear qual produto teve maior impulso por ativação.
- **Showroom**: apresentação física/digital (showroom virtual 3D) da coleção para compradores antes da produção em massa — decisão de sell-in acontece aqui, retroalimentando quantidade de produção real.
- **Loop com desenvolvimento**: feedback de compradores no showroom (pré-venda) e de sell-through em loja deve retornar como input estruturado para o briefing da próxima coleção — esse é o elo que fecha o ciclo do PLM com o comercial.

---

## 10. Sustentabilidade & compliance

- **DPP (Digital Product Passport)**: exigência da UE no âmbito do **ESPR (Ecodesign for Sustainable Products Regulation)**, com ato delegado específico para têxteis em preparação; previsão de entrada em vigor **a partir de 2027**, exigindo que cada peça tenha um identificador digital (QR code/RFID) com dados de composição, origem, reciclabilidade e pegada ambiental acessíveis em toda a cadeia [Regen Studio](https://www.regenstudio.world/pt/blog/espr-textile-delegated-act/), [SGS Portugal](https://www.sgs.com/pt-pt/noticias/2026/04/a-promessa-do-passaporte-digital-de-produto-na-industria-textil-sustentavel), [DPPro](https://dppro.eu/pt/blog/passaporte-digital-produto-textil-rastreabilidade-materiais).
- **Rastreabilidade de cadeia**: exige mapeamento "farm/fibra to fashion" — do fornecedor de fibra até a confecção — algo que só é viável em escala com PLM conectado a sourcing e fornecedores via portal digital.
- **ESG**: marcas de moda cada vez mais reportam indicadores ambientais/sociais por coleção (uso de água, emissões, condições de trabalho em facções), pressionadas por varejo europeu e por fundos de investimento.
- **Materiais certificados**: GOTS (orgânico), OEKO-TEX, Better Cotton, reciclado certificado (GRS) — o BOM do PLM deve registrar certificação por lote de matéria-prima para suportar o DPP.

---

## 11. Principais players de PLM de moda

| Player | Pontos fortes | Pontos fracos / observações |
|---|---|---|
| **Centric PLM (Centric Software)** | Líder de mercado em marcas grandes/globais; forte em analytics de coleção, matriz de sortimento, IA generativa para tendências | Implantação mais cara e longa; overkill para pequenas confecções |
| **PLM365 (baseado em Microsoft 365/Dynamics)** | Custo-benefício, rápido de implantar, familiar para quem já usa ecossistema Microsoft | Menos maduro em recursos avançados de 3D/analytics vs. Centric |
| **Lectra (Kubix Link) / Gerber Yunique PLM** | Forte integração com CAD/CAM de moda (AccuMark, Diamino), bom para quem já usa Lectra/Gerber no chão de fábrica [Lectra](https://www.lectra.com/en/fashion/products/gerber-yunique-plm) | Ecossistema mais fechado ao stack Lectra |
| **Bamboo Rose** | Forte em sourcing/marketplace de fornecedores B2B, bom para varejo com sourcing global complexo | Menos foco em design/CAD nativo |
| **Backbone** | Nativo em nuvem, UX moderna, forte em colaboração com fornecedores em tempo real | Base de clientes menor, ecossistema de integrações ainda em expansão |
| **PTC FlexPLM** | Robustez de PLM corporativo (herdado da Windchill), bom para grandes retailers com múltiplas categorias (moda + outros) | Curva de aprendizado maior, menos "fashion-native" que Centric |
| **Coats Digital (Fastreact/GSD/Traceability)** | Forte em produtividade de costura (SMV/BOP), rastreabilidade de matéria-prima ligada à Coats (fio) | Foco mais em manufatura/BOP do que em design/coleção |

**Tendência de mercado**: consolidação via aquisições (Lectra adquiriu Gerber Technology e Kubix Link), avanço de módulos de IA generativa e sustentabilidade/DPP embutidos nativamente nas plataformas, e forte movimento para SaaS/nuvem multi-tenant.

---

## 12. Tendências 2025–2026

- **IA generativa em design**: geração automática de variações de estampa, colorway e até croqui a partir de prompts, acelerando a fase de moodboard/desenvolvimento (recursos já anunciados por Centric e concorrentes).
- **3D/CLO3D e Browzwear**: modelagem e prova virtual 3D substituindo parte das amostras físicas — reduz tempo e custo de piloto/fit, com "avatar" digital simulando caimento do tecido.
- **Gêmeo digital de produto (Digital Twin)**: réplica digital completa do produto (tech pack + modelo 3D + dados de material) usada para simulação de custo, sustentabilidade e vendas antes da produção física.
- **Virtual sampling**: amostra 100% digital usada em showroom/venda antecipada, reduzindo amostras físicas (economia de tempo, tecido e frete internacional).
- **Cadeia conectada ERP ↔ PLM ↔ PDM ↔ MES**: integração ponta a ponta — PLM cuida do ciclo de desenvolvimento/design, PDM gerencia dados técnicos/CAD, MES executa e monitora o chão de fábrica em tempo real, e ERP consolida custo, estoque e financeiro; a integração nativa (via APIs) é o principal diferencial competitivo citado pelos fornecedores em 2025.

---

## 13. KPIs que importam

- **Time-to-market (TTM)**: tempo do briefing de coleção até a disponibilidade em loja; meta de referência em fast fashion pode ser de poucas semanas, em moda tradicional 6-9 meses.
- **Taxa de aprovação de piloto**: % de protótipos aprovados na primeira fit session (sem retrabalho) — indica maturidade do processo de desenvolvimento.
- **Aderência ficha técnica vs. produção real**: % de peças produzidas dentro da tolerância especificada no tech pack (medida, cor, aviamento).
- **Custo real vs. custo padrão**: desvio entre BOM/BOP teóricos e custo realizado (impacto direto de perda de encaixe, encolhimento, retrabalho).
- **OTIF (On Time In Full)**: % de pedidos entregues no prazo e na quantidade completa — indicador-chave de performance de fornecedor/PCP.
- **Sell-through em 4/8/12 semanas**: % do estoque inicial vendido nesses marcos temporais — dispara decisão de reposição, markdown ou descontinuação.
- **FPY (First Pass Yield)** e **taxa de defeito por AQL**: já descritos na seção 6, usados como KPI corrente de qualidade.

---

## 14. Erros comuns em implantação de PLM de moda no Brasil

1. **Digitalizar o caos**: migrar planilhas Excel desorganizadas "as is" para o PLM sem antes padronizar nomenclatura de tech pack, BOM e códigos de fornecedor.
2. **Subestimar a resistência cultural do time de criação**: estilistas acostumados a processos informais resistem a preencher campos estruturados; falta de treinamento gera dados incompletos.
3. **Não integrar com o ERP/ficha de custo já existente**, criando dois sistemas de verdade (double entry) e desconfiança nos dados.
4. **Ignorar a realidade de terceirização/facção**: implantar PLM sem prever acesso (portal) para fornecedores externos e facções, perdendo rastreabilidade justamente na etapa mais fragmentada.
5. **Escolher plataforma pelo nome/porte da marca-referência**, sem avaliar aderência ao tamanho e complexidade real da operação (PMEs comprando PLM de nível de multinacional, ou o oposto).
6. **Não definir "gates" de aprovação claros**, mantendo aprovações informais por WhatsApp/e-mail paralelas ao sistema.
7. **Falta de dono de processo (governança)**: sem um responsável formal por manter o PLM atualizado, o sistema é abandonado após poucos meses ("shelfware").
8. **Não medir ROI/KPI antes-depois**: implantações sem baseline de TTM, FPY ou aderência de ficha não conseguem comprovar valor e perdem patrocínio interno.
9. **Negligenciar sustentabilidade/DPP desde já**: tratar rastreabilidade como "problema futuro" quando o DPP europeu (2027) já pressiona cadeias que exportam ou fornecem a marcas globais.

---

## 15. Glossário essencial

1. **Tech Pack** — ficha técnica completa da peça.
2. **Spec Sheet** — tabela de medidas e especificações dimensionais.
3. **Fit Session** — reunião de prova/ajuste da peça em manequim ou fit model.
4. **Sample** — amostra física de qualquer estágio do desenvolvimento.
5. **Salesman Sample** — amostra usada para vendas/showroom.
6. **PP Sample (Pre-Production Sample)** — amostra final antes de liberar produção em série.
7. **TOP (Top of Production)** — amostra retirada do início da produção em massa para confirmação de conformidade.
8. **WIP (Work in Progress)** — peças em processo dentro da fábrica.
9. **Cut Ticket** — ordem/ficha de corte de um lote.
10. **Marker** — plano de corte/encaixe das peças do molde sobre o tecido.
11. **Encaixe** — otimização do posicionamento das peças do molde no tecido para reduzir perda.
12. **Enfesto** — ato de sobrepor camadas de tecido antes do corte.
13. **Piquê** — tipo de malha com textura em relevo.
14. **BOM (Bill of Materials)** — lista de materiais.
15. **BOP (Bill of Process/Operations)** — lista de operações de fabricação.
16. **SAM/SMV (Standard Allowed Minute/Standard Minute Value)** — tempo padrão de uma operação de costura.
17. **AQL (Acceptable Quality Level)** — nível de qualidade aceitável em inspeção por amostragem.
18. **CAPA** — ação corretiva e preventiva.
19. **FPY (First Pass Yield)** — taxa de aprovação na primeira inspeção.
20. **OTIF (On Time In Full)** — entrega no prazo e quantidade completa.
21. **RFQ (Request for Quotation)** — solicitação de cotação.
22. **MOQ (Minimum Order Quantity)** — quantidade mínima de pedido.
23. **Target Costing** — definição de custo-alvo a partir do preço de venda desejado.
24. **CMT (Cut-Make-Trim)** — modelo de contratação de fábrica só para corte/costura/acabamento.
25. **FOB (Free on Board)** — preço da mercadoria posta a bordo, sem frete internacional.
26. **Sell-in** — venda da marca para o canal/varejo.
27. **Sell-out** — venda do varejo para o consumidor final.
28. **Sell-through** — percentual do estoque vendido em determinado período.
29. **Curva ABC** — classificação de produtos por relevância de faturamento/margem.
30. **Carry-over** — item repetido de coleção anterior, geralmente repaginado.
31. **Reorder/Repique** — reposição de um modelo de bom giro.
32. **Markdown** — desconto para liquidar estoque de baixo giro.
33. **Colorway** — variação de cor de um mesmo modelo.
34. **Grade** — conjunto de tamanhos derivados de um tamanho base (grade de numeração).
35. **PDM (Ponto de Medida)** — ponto específico medido na peça (ex.: busto, cintura).
36. **Moodboard** — painel visual de referências de tendência/estilo.
37. **Croqui** — desenho técnico ou artístico da peça.
38. **Flat Sketch** — desenho técnico plano, sem estilização.
39. **Trend Forecasting** — previsão de tendências de moda.
40. **PIM (Product Information Management)** — gestão de informação de produto para canais de venda.
41. **DAM (Digital Asset Management)** — gestão de ativos digitais (fotos, vídeos).
42. **PDM (Product Data Management)** — gestão de dados técnicos/CAD, correlato ao PLM.
43. **MES (Manufacturing Execution System)** — sistema de execução e monitoramento de chão de fábrica.
44. **APS (Advanced Planning and Scheduling)** — sistema avançado de planejamento e sequenciamento.
45. **MRP (Material Requirements Planning)** — planejamento de necessidade de materiais.
46. **Facção** — oficina terceirizada de costura.
47. **Lote** — unidade de produção/inspeção (conjunto de peças produzidas juntas).
48. **Estonagem** — processo de lavanderia para efeito desbotado/amaciado em denim.
49. **Ilhós** — aviamento de furo reforçado (metal).
50. **Cadarço** — fita/cordão têxtil usado como aviamento.
51. **Digital Twin (Gêmeo Digital)** — réplica digital do produto/processo para simulação.
52. **DPP (Digital Product Passport)** — passaporte digital de produto, exigência regulatória da UE.
53. **ESPR** — Ecodesign for Sustainable Products Regulation (regulamento europeu de ecodesign).
54. **GOTS/OEKO-TEX/GRS** — certificações de matéria-prima orgânica, segurança têxtil e material reciclado.
55. **Virtual Sampling** — amostra 100% digital/3D sem produção física.
56. **Showroom** — espaço de apresentação da coleção a compradores.

---

### Fontes principais
- Centric Software — https://www.centricsoftware.com/pt-pt/fashion-apparel
- Lectra / Gerber Yunique PLM — https://www.lectra.com/en/fashion/products/gerber-yunique-plm
- Lectra Kubix Link PLM — https://www.lectra.com/en/fashion/products/kubix-link-plm
- Regen Studio (ESPR têxtil/DPP) — https://www.regenstudio.world/pt/blog/espr-textile-delegated-act/
- SGS Portugal (DPP têxtil) — https://www.sgs.com/pt-pt/noticias/2026/04/a-promessa-do-passaporte-digital-de-produto-na-industria-textil-sustentavel
- DPPro (rastreabilidade têxtil DPP) — https://dppro.eu/pt/blog/passaporte-digital-produto-textil-rastreabilidade-materiais
- UTFPR — PCP de uma Indústria de Confecção — http://riut.utfpr.edu.br/jspui/bitstream/1/5722/1/AP_COENT_2016_1_04.pdf
- RZ Sistemas — PCP Confecção — https://www.rzsistemas.com.br/pcp-confeccao/
- Blog Costurando Sucesso — Implementando PCP na Confecção — https://blog.costurandosucesso.com/2024/06/18/implementando-um-setor-de-pcp-na-confeccao-de-roupas/
- Algo Bert Fashion — Guia de Controlo de Qualidade do Vestuário (AQL) — https://algobertfashion.com/pt/guia-de-controlo-da-qualidade-do-vestuario/
