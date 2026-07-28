# Análise PLM — Visão do Designer de Moda

## Sobre o avaliador

Especialista em PLM para moda (Audaces, CLO 3D, Browzwear, Gerber AccuMark, Lectra Modaris) com experiência em coordenação de produto e engenharia têxtil.

---

## 1. Resumo do Projeto

O sistema já possui uma base técnica sólida com arquitetura moderna (TanStack Router + Supabase + React Query). A abordagem "Product Workspace" com abas é correta para o mercado. No entanto, da perspectiva de **designer de moda**, existem lacunas significativas na fluidez do fluxo criativo e na conexão entre conceito e execução.

---

## 2. Análise Detalhada por Área

### 2.1 Criação de Produto (Wizard) — ❌ Crítico

**Estado atual:** Wizard de 4 passos com campos genéricos (nome, SKU, coleção, categoria, cores, tamanhos).

**Problemas:**
- **Sem inspiração:** Designer não consegue anexar imagens de referência durante a criação — apenas URL de imagem
- **Sem silhueta/corpo:** Não há campo para tipo de silhueta (justo, reto, evasê, godê, envelope, etc.)
- **Sem campo de "ocasião":** Dia/noite, casual/formal, trabalho/lazer — essencial para a coleção
- **SKU automático ignora convenção:** SKU deveria seguir `{coleção}-{categoria}-{sequencial}` (ex.: `AV25-VST-001`)
- **Sem campo de "tecido sugerido":** Designer quer registrar "Crepe Seda" ou "Malha Algodão 30.1" antes da ficha técnica

**Sugestões:**
1. Adicionar upload de imagem de referência direto no wizard
2. Adicionar campo "Silhueta" com opções visuais (ícones)
3. Adicionar campo "Ocasião de uso"
4. Melhorar regra de SKU para usar coleção + categoria + numeração
5. Adicionar campo "Tecido sugerido" (texto livre, não vinculado à biblioteca)

### 2.2 Product Workspace — ⚠️ Melhorável

**Estado atual:** Abas com Overview, Ficha Técnica, BOM, Processo, Medidas, Custos, Protótipos, PCP, Marketing, BI, Timeline.

**Problemas:**
- **11 abas é excessivo para um designer** — criação/produto deveria ter no máximo 5-6 abas para o perfil "criação"
- **Informação de custo aparece sem markup/margem** — designer precisa entender se o produto é viável rapidamente
- **Timeline de collab está separada** — deveria estar unificada na aba principal
- **Grade de tamanhos está colapsada** — designer precisa ver rápido se o sizing está correto
- **Sem "notas do designer"** — sem campo de livre anotação visível sempre

**Sugestões:**
1. Criar **perfil de visualização por cargo** (abas colapsáveis): Designer vê 5 abas, engenheiro vê 9, gestor vê todas
2. Adicionar chip fixo de "Viabilidade" no cabeçalho: markup ≥ 55% = verde, entre 40-55% = amarelo, < 40% = vermelho
3. Unificar ProductTimeline + ProductTimelineCollab + TimelineFeed em uma única timeline
4. Expandir grade de tamanhos por padrão quando há dados
5. Adicionar campo "Notas do designer" persistente tipo post-it no topo

### 2.3 Ficha Técnica — ✅ Bom, mas pode melhorar

**Estado atual:** Editor completo com abas de materiais, operações, medidas, consumo, custos, documentos e IA.

**Problemas:**
- **Sem preview de ficha técnica** — não há visualização impressa (PDF preview) antes de exportar
- **Sem grade de medidas por tamanho** — medidas são texto livre, não tabela PP-P-M-G-GG
- **Sem campo de "margem de costura"** — essencial para o corte
- **Sem vinculação de desenho técnico (flat sketch)** — não há espaço para o desenho técnico da peça

**Sugestões:**
1. Adicionar preview PDF da ficha técnica antes da exportação
2. Criar componente `MeasurementGradeTable` com colunas PP/P/M/G/GG + tolerância por ponto de medida
3. Adicionar campo "Margem de costura (cm)" por operação
4. Adicionar slot para flat sketch (imagem vetorial ou raster) no topo da ficha
5. Adicionar geração automática de composição têxtil para etiqueta (ex.: "100% Algodão" ou "92% Poliéster 8% Elastano")

### 2.4 Protótipo — ⚠️ Funcional, mas sem fluidez

**Estado atual:** Cards com progressão em etapas (em_producao → fitting → ajuste → aprovado).

**Problemas:**
- **Sem data de previsão de entrega do piloto** — designer não sabe quando vai receber a peça
- **Sem checklist de fitting** — não há campos estruturados para prova (encaixe, caimento, comprimento, conforto)
- **Sem fotos comparativas** — não dá para comparar "antes vs depois" do ajuste
- **Sem status "em trânsito"** — não há visibilidade se o piloto está no fornecedor, no laboratório ou a caminho

**Sugestões:**
1. Adicionar campo "Previsão de entrega" no card de protótipo
2. Criar `FitChecklistPanel` com: encaixe, caimento, comprimento, conforto, movimento
3. Adicionar slider de fotos comparativas (antes/depois) no ajuste
4. Adicionar estágios "em_transito" e "recebido" no fluxo de prototipagem

### 2.5 Grade de Tamanhos — ⚠️ Subutilizada

**Estado atual:** `ProductSizeGridCard` expansível com distribuição percentual, sem integração com a ficha técnica.

**Problemas:**
- **Grade não vinculada às medidas da ficha técnica** — não há cascade da grade para as medidas por tamanho
- **Distribuição sugerida é fixa** — não considera dados históricos de venda por categoria
- **Sem regras de salto (jump rules)** — para grade de numeração (36-38-40-42) não há indicação de steps

**Sugestões:**
1. Vincular grade de tamanhos às medidas da ficha técnica (gerar colunas PP/P/M/G automaticamente)
2. Conectar distribuição sugerida ao histórico de vendas (RPC de analytics)
3. Adicionar campo "Jump rule" na grade (ex.: "step 2" para numeração par)

### 2.6 Biblioteca de Materiais — ✅ Boa base

**Estado atual:** Material picker dialog com busca, filtro por tipo, e `MaterialLibrarySyncPanel` para sincronização.

**Sugestões:**
1. Adicionar visualização em **grid com swatch de cor/tecido** (não só lista)
2. Adicionar campo "fornecedor preferencial" no material
3. Adicionar alerta de "material em falta" (estoque ≤ 0) na hora da pickagem

### 2.7 Preço — ⚠️ Sem informação de markup

**Estado atual:** `ProductPriceSuggestionCard` mostra preço sugerido, mas não há cálculo de markup visível no card do cabeçalho.

**Sugestões:**
1. Adicionar badge de "Markup" no cabeçalho do produto (ex.: markup 2.8x)
2. Mostrar preço de venda sugerido vs real no mesmo card
3. Adicionar "margem mínima aceitável" configurável por categoria

### 2.8 Mobile — ❌ Não avaliado

Não foi possível avaliar a versão mobile. PLM de moda precisa ser funcional no celular para:
- Aprovação rápida de protótipos
- Consulta de ficha técnica no chão de fábrica
- Registro de ajustes com foto

---

## 3. Checklist de Melhorias Prioritárias

| Prioridade | Melhoria | Impacto | Esforço |
|------------|----------|---------|---------|
| 🔴 P0 | Vincular grade de tamanhos às medidas da ficha técnica | Alto | 3 dias |
| 🔴 P0 | Criar perfil de visualização por cargo (abas contextuais) | Alto | 2 dias |
| 🔴 P0 | Adicionar preview PDF da ficha técnica | Alto | 4 dias |
| 🟡 P1 | Adicionar checklist de fitting no protótipo | Alto | 2 dias |
| 🟡 P1 | Melhorar wizard com silhueta + ocasião + tecido sugerido | Médio | 2 dias |
| 🟡 P1 | Adicionar "notas do designer" persistente no workspace | Médio | 1 dia |
| 🟡 P1 | Badge de viabilidade (markup) no cabeçalho do produto | Médio | 1 dia |
| 🟢 P2 | Fotos comparativas antes/depois no ajuste | Médio | 2 dias |
| 🟢 P2 | Grade visual de materiais (grid com swatches) | Baixo | 2 dias |
| 🟢 P2 | Regra de SKU por coleção + categoria + sequencial | Baixo | 1 dia |
| 🟢 P2 | "Em trânsito" no fluxo de protótipo | Baixo | 1 dia |

---

## 4. Conclusão

O sistema tem **arquitetura excelente** e cobre bem a parte de engenharia de produto (BOM, BOP, custos). A maior lacuna está na **experiência do designer de moda** — o fluxo criativo ainda é muito "engenheirizado" e poderia ser mais visual e intuitivo.

**Três recomendações estratégicas:**

1. **Perfil de visualização:** Um designer não precisa ver PCP, BI ou Custos no dia a dia. Permitir colapsar abas por perfil reduz atrito cognitivo.

2. **Integração conceito → execução:** Desde a criação, o designer deveria poder registrar: imagem de referência, silhueta, tecido sugerido, ocasião — e esses dados deveriam fluir automaticamente para ficha técnica.

3. **Prototipagem visual:** O fitting é o momento mais crítico do PLM de moda. Um checklist estruturado com fotos comparativas e timeline de transporte reduz drasticamente retrabalho.

O produto está no caminho certo — falta apenas um **layer de design thinking** sobre a estrutura de engenharia já consolidada.

