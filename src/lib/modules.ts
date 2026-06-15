import {
  LayoutDashboard, Layers, Sparkles, FileText, PenTool, Scissors,
  Factory, Boxes, Truck, Megaphone, Store, Wallet, BarChart3,
  Bot, Cpu, ShieldCheck, MonitorPlay, Smartphone, Users, Brain,
  Radar, Zap, MapPin, Activity, Percent, Calendar, Award, LineChart, PackageSearch, Gauge, Banknote, Trophy, Target,
  KanbanSquare, Workflow, Ruler, ShoppingCart, Rocket, Star, Coins, Compass, UserCircle2, Route as RouteIcon, Database, ScrollText, Lock, ArrowLeftRight, Leaf, Repeat, Globe, ShieldAlert, type LucideIcon,
} from "lucide-react";

export type ModuleGroup =
  | "Operação"
  | "Coleções"
  | "Desenvolvimento"
  | "PCP & Produção"
  | "Cadeia (PLM)"
  | "Marketing"
  | "Inteligência"
  | "ERP (Integração)"
  | "Plataforma";

export type ModuleSource = "plm" | "erp-mirror";
export type ModuleStatus = "ativo" | "parcial" | "wip";

export type ModuleDef = {
  slug: string;
  path: string;
  title: string;
  short: string;
  description: string;
  icon: LucideIcon;
  group: ModuleGroup;
  source?: ModuleSource;     // default: "plm"
  status?: ModuleStatus;     // default: "ativo"
  hidden?: boolean;          // mantém rota, oculta do menu
};

/**
 * Reorganização Onda 1 — USE MODA PLM.
 * Nada foi removido: rotas marcadas como ERP-mirror permanecem acessíveis
 * via URL direta; apenas `hidden: true` as retira do sidebar do PLM.
 */
export const MODULES: ModuleDef[] = [
  // === Operação ===
  { slug: "command-center", path: "/", title: "Command Center", short: "Painel operacional", description: "Coleções, produtos, lotes e gargalos em tempo real.", icon: LayoutDashboard, group: "Operação", status: "parcial" },
  { slug: "fashion-calendar", path: "/fashion-calendar", title: "Fashion Calendar", short: "Linha do tempo", description: "Cronograma de coleções: desenvolvimento, produção e lançamento.", icon: Calendar, group: "Operação" },

  // === Coleções ===
  { slug: "colecoes", path: "/colecoes", title: "Coleções", short: "Núcleo do PLM", description: "Planejamento, moodboard, tendências, produtos e cronograma.", icon: Layers, group: "Coleções", status: "parcial" },
  { slug: "colecao-360", path: "/colecao-360", title: "Coleção 360º", short: "Ciclo completo", description: "Protótipos → produtos → OPs → vendas → margem em uma tela.", icon: Compass, group: "Coleções" },
  { slug: "trends", path: "/trends", title: "Hub de Tendências", short: "Moodboard e paleta", description: "Referências visuais, paleta e mood do catálogo.", icon: Compass, group: "Coleções" },

  // === Desenvolvimento ===
  { slug: "dev-kanban", path: "/dev-kanban", title: "Kanban de Desenvolvimento", short: "Pesquisa → liberação", description: "Pipeline completo do produto: pesquisa, modelagem, piloto, aprovação.", icon: Workflow, group: "Desenvolvimento" },
  { slug: "produtos", path: "/produtos", title: "Produtos", short: "Pipeline de produtos", description: "Do briefing à aprovação do estilo.", icon: Sparkles, group: "Desenvolvimento" },
  { slug: "variantes", path: "/variantes", title: "Variantes & SKU", short: "Grade cor × tamanho", description: "Cores, tamanhos e SKUs gerados por combinação. Base para grade de produção.", icon: Tag, group: "Desenvolvimento" },
  { slug: "ficha-tecnica", path: "/ficha-tecnica", title: "Ficha Técnica", short: "Materiais, operações, consumos", description: "Engenharia de produto: materiais, aviamentos, operações, tempos e custos industriais.", icon: FileText, group: "Desenvolvimento", status: "parcial" },
  { slug: "cad", path: "/cad", title: "CAD e Modelagem", short: "AI/CDR/DXF/SVG/PDF/PLT", description: "Modelagem digital e biblioteca de moldes.", icon: PenTool, group: "Desenvolvimento", status: "parcial" },
  { slug: "prototipos", path: "/prototipos", title: "Protótipos", short: "Provas e ajustes", description: "Ciclo de protótipos, provas e aprovações.", icon: Scissors, group: "Desenvolvimento" },
  { slug: "pilots", path: "/pilots", title: "Pilotos", short: "Aprovações de prova", description: "Ciclo de pilotos com status próprios e histórico.", icon: Ruler, group: "Desenvolvimento" },

  // === PCP & Produção ===
  { slug: "pcp", path: "/pcp", title: "PCP e Produção", short: "Ordens e capacidade", description: "Planejamento, ordens de produção e apontamento.", icon: Factory, group: "PCP & Produção" },
  { slug: "pcp-kanban", path: "/pcp-kanban", title: "PCP Kanban", short: "Board drag-and-drop", description: "Mova ordens entre setores arrastando os cards.", icon: KanbanSquare, group: "PCP & Produção", status: "parcial" },
  { slug: "centro-de-corte", path: "/centro-de-corte", title: "Centro de Corte", short: "Plano de corte", description: "Plano de corte, enfesto e peças cortadas.", icon: Scissors, group: "PCP & Produção" },
  { slug: "lotes", path: "/lotes", title: "Lotes & Rastreabilidade", short: "Batch tracking", description: "Lotes de produção, vínculo com OPs e histórico completo de estágios.", icon: Boxes, group: "PCP & Produção" },
  { slug: "twin-factory", path: "/twin-factory", title: "Torre de Controle", short: "Twin Factory", description: "Visão em tempo real de lotes, setores e gargalos.", icon: Activity, group: "PCP & Produção" },
  { slug: "capacity", path: "/capacity", title: "Capacidade de Produção", short: "OEE e carga", description: "OEE, WIP, atrasos e carga por fornecedor / facção.", icon: Gauge, group: "PCP & Produção" },
  { slug: "pcp-stages", path: "/pcp-stages", title: "Etapas do PCP", short: "Configurar estágios", description: "Configure as etapas (setores) do seu fluxo de produção, ordem e cores.", icon: KanbanSquare, group: "PCP & Produção" },

  // === Cadeia (PLM) — insumos / fornecedores ===
  { slug: "almoxarifado", path: "/almoxarifado", title: "Almoxarifado (Insumos)", short: "Tecidos e aviamentos", description: "Controle técnico de insumos da produção.", icon: Boxes, group: "Cadeia (PLM)" },
  { slug: "cadeia-360", path: "/cadeia-360", title: "Cadeia 360º", short: "Portal + sourcing + capacidade", description: "Portal do fornecedor, sourcing inteligente e calendário de capacidade.", icon: Truck, group: "Cadeia (PLM)" },
  { slug: "fornecedores", path: "/fornecedores", title: "Fornecedores", short: "Portal de parceiros", description: "Portal de fornecedores e facções.", icon: Truck, group: "Cadeia (PLM)" },
  { slug: "supplier-score", path: "/supplier-score", title: "Supplier Scorecard", short: "OTD e rating", description: "Score 0–100 por fornecedor com OTD, rating e tiers.", icon: Trophy, group: "Cadeia (PLM)" },
  { slug: "stock-health", path: "/stock-health", title: "Saúde de Insumos", short: "Cobertura técnica", description: "Ruptura, baixo, excesso e cobertura — escopo insumos PLM.", icon: PackageSearch, group: "Cadeia (PLM)", status: "parcial" },
  { slug: "compras", path: "/compras", title: "Necessidade de Compra", short: "Sugestão técnica", description: "Necessidade técnica de insumos (sem financeiro — envia para o ERP).", icon: ShoppingCart, group: "Cadeia (PLM)", status: "parcial" },

  // === Marketing (de produto) ===
  { slug: "marketing", path: "/marketing", title: "Marketing de Produto", short: "Performance por produto", description: "Performance por produto, coleção e região (lê do ERP).", icon: Megaphone, group: "Marketing", status: "parcial" },
  { slug: "influencers", path: "/influencers", title: "Influenciadores", short: "Cadastro e envios", description: "Cadastro, produtos enviados e baseline antes/depois.", icon: UserCircle2, group: "Marketing", status: "parcial" },
  { slug: "influencer-roi", path: "/influencer-roi", title: "ROI de Influencers", short: "Uplift e ROAS", description: "Crescimento de vendas/pedidos após postagem (dados ERP).", icon: Award, group: "Marketing", status: "parcial" },
  { slug: "campaigns", path: "/campaigns", title: "Campanhas", short: "Performance por canal", description: "Investimento, receita atribuída e ROAS por campanha.", icon: Target, group: "Marketing" },
  { slug: "geo-sales", path: "/geo-sales", title: "Geo Sales", short: "Mapa do Brasil", description: "Aceitação por UF e região (dados do ERP).", icon: MapPin, group: "Marketing", status: "parcial" },

  // === Inteligência ===
  { slug: "intel-hub", path: "/intel-hub", title: "Inteligência Operacional", short: "Hub unificado", description: "Alertas, reposição técnica e scores em uma tela única.", icon: Brain, group: "Inteligência" },
  { slug: "closed-loop", path: "/closed-loop", title: "PLM Closed-Loop", short: "Voz do cliente → próxima coleção", description: "Reviews, NPS, ABC/lifecycle e replanejamento (repetir/repaginar/cortar).", icon: Repeat, group: "Inteligência" },
  { slug: "omnichannel", path: "/omnichannel", title: "Omnichannel & Marketplace", short: "Mix de canais", description: "Receita por canal D2C/B2B/marketplace, ticket médio e geografia.", icon: Globe, group: "Marketing" },
  { slug: "fpa", path: "/fpa", title: "Planejamento Financeiro (FP&A)", short: "Forecast e plano x real", description: "Orçamento por coleção, forecast 12 meses e variação plano x real.", icon: Banknote, group: "Plataforma" },
  { slug: "quality", path: "/quality", title: "Centro de Qualidade & SLA", short: "OTD e defeitos", description: "Inspeções, taxa de defeito por fornecedor e cumprimento de prazo.", icon: ShieldAlert, group: "Cadeia (PLM)" },
  { slug: "intelligence", path: "/intelligence", title: "Intelligence Engine", short: "Inteligência operacional", description: "O que produzir, repor, atrasar — sinais operacionais.", icon: Brain, group: "Inteligência" },
  { slug: "control-tower", path: "/control-tower", title: "Control Tower", short: "Demand & Supply", description: "Necessidade por grade com semáforo de cobertura.", icon: Radar, group: "Inteligência" },
  { slug: "product-score", path: "/product-score", title: "Product Score", short: "Pontuação 0–100", description: "Pontuação por vendas, margem, ROI e giro.", icon: Star, group: "Inteligência" },
  { slug: "product-success", path: "/product-success", title: "Product Success", short: "Score preditivo", description: "Probabilidade de sucesso por produto.", icon: Rocket, group: "Inteligência" },
  { slug: "grade-needs", path: "/grade-needs", title: "Necessidade por Grade", short: "Quebra PP/P/M/G/GG", description: "Distribuição sugerida por tamanho.", icon: Ruler, group: "Inteligência" },
  { slug: "replenishment", path: "/replenishment", title: "Sugestão de Reposição", short: "Sinal p/ produção", description: "Sinal técnico de reposição p/ PCP (sem compras financeiras).", icon: Zap, group: "Inteligência", status: "parcial" },

  // === ERP (Integração) — leitura/espelho ===
  { slug: "attribution", path: "/attribution", title: "Marketing Attribution (ERP)", short: "Leitura ERP", description: "Receita atribuída por canal — espelho do ERP.", icon: RouteIcon, group: "ERP (Integração)", source: "erp-mirror", status: "parcial" },
  { slug: "sales-performance", path: "/sales-performance", title: "Sales Performance (ERP)", short: "Leitura ERP", description: "Receita, canais, ticket médio e top SKUs — espelho do ERP.", icon: LineChart, group: "ERP (Integração)", source: "erp-mirror", status: "parcial" },
  { slug: "margem", path: "/margem", title: "Margem & Rentabilidade (ERP)", short: "Leitura ERP", description: "Margem real por SKU — espelho do ERP.", icon: Percent, group: "ERP (Integração)", source: "erp-mirror", status: "parcial" },
  { slug: "profitability", path: "/profitability", title: "Rentabilidade por Coleção (ERP)", short: "Leitura ERP", description: "Lucro real por coleção — espelho do ERP.", icon: Coins, group: "ERP (Integração)", source: "erp-mirror", status: "parcial" },

  // Módulos ERP-mirror operacionais — rotas mantidas, ocultas do menu PLM
  { slug: "financeiro", path: "/financeiro", title: "Financeiro (ERP)", short: "Pertence ao ERP", description: "Operado no ERP — rota preservada para histórico.", icon: Wallet, group: "ERP (Integração)", source: "erp-mirror", hidden: true },
  { slug: "cashflow", path: "/cashflow", title: "Cashflow (ERP)", short: "Pertence ao ERP", description: "Operado no ERP — rota preservada para histórico.", icon: Banknote, group: "ERP (Integração)", source: "erp-mirror", hidden: true },
  { slug: "comercial", path: "/comercial", title: "Comercial / B2B (ERP)", short: "Pertence ao ERP", description: "Operado no ERP — rota preservada para histórico.", icon: Store, group: "ERP (Integração)", source: "erp-mirror", hidden: true },
  { slug: "clientes", path: "/clientes", title: "Clientes (ERP)", short: "Pertence ao ERP", description: "Cadastro fica no ERP — rota preservada para histórico.", icon: Users, group: "ERP (Integração)", source: "erp-mirror", hidden: true },
  { slug: "representantes", path: "/representantes", title: "Representantes (ERP)", short: "Pertence ao ERP", description: "Cadastro fica no ERP — rota preservada para histórico.", icon: UserCircle2, group: "ERP (Integração)", source: "erp-mirror", hidden: true },
  { slug: "pedidos-compra", path: "/pedidos-compra", title: "Pedidos de Compra (ERP)", short: "Pertence ao ERP", description: "Compras financeiras ficam no ERP — rota preservada para histórico.", icon: ShoppingCart, group: "ERP (Integração)", source: "erp-mirror", hidden: true },
  { slug: "movimentacoes", path: "/movimentacoes", title: "Movimentações Estoque (ERP)", short: "Pertence ao ERP", description: "Estoque fiscal fica no ERP — rota preservada para histórico.", icon: ArrowLeftRight, group: "ERP (Integração)", source: "erp-mirror", hidden: true },

  // === Plataforma ===
  { slug: "dpp", path: "/dpp", title: "Digital Product Passport", short: "Rastreabilidade", description: "Passaporte digital e compliance ESG.", icon: ShieldCheck, group: "Plataforma" },
  { slug: "sustentabilidade-360", path: "/sustentabilidade-360", title: "Sustentabilidade 360º", short: "ESG por coleção", description: "Pegada CO₂, materiais sustentáveis, certificações e rastreabilidade DPP.", icon: Leaf, group: "Plataforma" },
  { slug: "designer-workspace", path: "/designer-workspace", title: "Workspace do Designer", short: "Tudo no seu nome", description: "Protótipos abertos, aprovações pendentes e atalhos de criação.", icon: PenTool, group: "Desenvolvimento" },
  { slug: "approvals", path: "/approvals", title: "Workflow de Aprovações", short: "Gates do PLM", description: "Coleção → ficha técnica → piloto → liberação para produção.", icon: Workflow, group: "Operação" },
  { slug: "showroom", path: "/showroom", title: "Showroom Digital", short: "Vitrine 3D", description: "Showroom virtual com lookbooks interativos.", icon: MonitorPlay, group: "Plataforma", status: "wip" },
  { slug: "mobile", path: "/mobile", title: "Aplicativo Mobile", short: "App para times", description: "App nativo para campo, fábrica e vendedores.", icon: Smartphone, group: "Plataforma", status: "wip" },
  { slug: "bi", path: "/bi", title: "BI e Analytics", short: "Insights e KPIs", description: "Dashboards customizáveis.", icon: BarChart3, group: "Plataforma" },
  { slug: "fashion-gpt", path: "/fashion-gpt", title: "Fashion GPT", short: "Copiloto de moda", description: "Assistente especialista no seu negócio de moda.", icon: Bot, group: "Plataforma" },
  { slug: "use-ai", path: "/use-ai", title: "USE AI", short: "Automação inteligente", description: "Agentes de IA para automação.", icon: Cpu, group: "Plataforma" },
  { slug: "security-center", path: "/security-center", title: "Segurança", short: "MFA, LGPD, backup", description: "MFA TOTP, política de senhas, criptografia e backups.", icon: Lock, group: "Plataforma" },
  { slug: "audit", path: "/audit", title: "Auditoria & LGPD", short: "Logs e rastreabilidade", description: "Eventos auditáveis com filtro por entidade/ação.", icon: ScrollText, group: "Plataforma" },
  { slug: "data-lake", path: "/data-lake", title: "Data Lake", short: "Camada unificada", description: "Visão consolidada de todos os domínios.", icon: Database, group: "Plataforma" },
  { slug: "equipe", path: "/equipe", title: "Equipe & Permissões", short: "Usuários e papéis", description: "Gerencie usuários e atribua papéis (admin).", icon: Users, group: "Plataforma" },
];

export const MODULE_GROUPS: ModuleGroup[] = [
  "Operação",
  "Coleções",
  "Desenvolvimento",
  "PCP & Produção",
  "Cadeia (PLM)",
  "Marketing",
  "Inteligência",
  "ERP (Integração)",
  "Plataforma",
];
