# TODO - Melhoria no Cadastro de Produto

## Objetivo
Integrar Ficha Técnica (materiais + operações) e Ficha de Custos diretamente no wizard de criação de produto.

## Tarefas

- [x] 1. Analisar código atual (ProductCreationWizard, TechSheet panels, ProductCostCockpit)
- [x] 2. Criar plano de melhoria e obter aprovação

### Implementação

- [x] 3. Adicionar Step "Custos" entre "Ficha Técnica" e "Revisão" no WIZARD_STEPS
- [x] 4. Adicionar estados para materiais, operações, preço de venda e overhead
- [x] 5. Substituir Step 2 (Ficha Técnica) - placeholder → formulários inline editáveis:
  - [x] 5a. Tabela de Materiais (nome, unidade, consumo, custo unitário, perda)
  - [x] 5b. Tabela de Operações (nome, máquina, responsável, SAM, R$/min)
  - [x] 5c. Totais calculados automaticamente
- [x] 6. Implementar Step 3 (Custos):
  - [x] 6a. Campo: Preço de venda sugerido
  - [x] 6b. Campo: Overhead %
  - [x] 6c. Card de margem estimada com indicador visual
- [x] 7. Atualizar Step 4 (Revisão) - adicionar resumo de custos
- [x] 8. Atualizar `createMut` para:
  - [x] 8a. Criar `tech_sheet` automaticamente
  - [x] 8b. Inserir materiais em `tech_sheet_materials`
  - [x] 8c. Inserir operações em `tech_sheet_operations`
  - [x] 8d. Calcular e salvar custos na `tech_sheet`
- [x] 9. Atualizar `canAdvance` para novos steps
- [x] 10. Atualizar navegação (voltar) para incluir novo step

### Finalização

- [x] 11. Implementado visualmente o wizard completo
- [ ] 12. Fazer commit e push para o GitHub

