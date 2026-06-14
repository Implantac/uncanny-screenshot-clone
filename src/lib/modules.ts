import {
  LayoutDashboard, Layers, Sparkles, FileText, PenTool, Scissors,
  Factory, Boxes, Truck, Megaphone, Store, Wallet, BarChart3,
  Bot, Cpu, ShieldCheck, MonitorPlay, Smartphone, Users, Brain,
  Radar, Zap, MapPin, Activity, Percent, Calendar, Award, LineChart, PackageSearch, Gauge, Banknote, Trophy, Target,
  KanbanSquare, Workflow, Ruler, ShoppingCart, Rocket, Star, Coins, type LucideIcon,
} from "lucide-react";

export type ModuleDef = {
  slug: string;
  path: string;
  title: string;
  short: string;
  description: string;
  icon: LucideIcon;
  group: "Operação" | "Produto" | "Cadeia" | "Comercial" | "Inteligência" | "Plataforma";
};

export const MODULES: ModuleDef[] = [
  { slug: "command-center", path: "/", title: "Command Center", short: "Dashboard executivo", description: "Visão 360º do negócio em tempo real.", icon: LayoutDashboard, group: "Operação" },
  { slug: "colecoes", path: "/colecoes", title: "Gestão de Coleções", short: "Coleções e linhas", description: "Planeje coleções, linhas e calendário sazonal.", icon: Layers, group: "Produto" },
  { slug: "produtos", path: "/produtos", title: "Desenvolvimento de Produtos", short: "Pipeline de produtos", description: "Do briefing à aprovação do estilo.", icon: Sparkles, group: "Produto" },
  { slug: "ficha-tecnica", path: "/ficha-tecnica", title: "Ficha Técnica Inteligente", short: "Tech packs com IA", description: "Fichas técnicas geradas e versionadas com IA.", icon: FileText, group: "Produto" },
  { slug: "cad", path: "/cad", title: "CAD e Modelagem", short: "Modelagem digital", description: "Integração com CADs e biblioteca de moldes.", icon: PenTool, group: "Produto" },
  { slug: "prototipos", path: "/prototipos", title: "Protótipos", short: "Provas e ajustes", description: "Ciclo de protótipos, provas e aprovações.", icon: Scissors, group: "Produto" },
  { slug: "pcp", path: "/pcp", title: "PCP e Produção", short: "Ordens e capacidade", description: "Planejamento, ordens de produção e apontamento.", icon: Factory, group: "Cadeia" },
  { slug: "pcp-kanban", path: "/pcp-kanban", title: "PCP Kanban", short: "Board drag-and-drop", description: "Mova ordens entre setores arrastando os cards.", icon: KanbanSquare, group: "Cadeia" },
  { slug: "dev-kanban", path: "/dev-kanban", title: "Kanban de Desenvolvimento", short: "Pipeline do produto", description: "Pesquisa → modelagem → liberação para PCP.", icon: Workflow, group: "Produto" },
  { slug: "pilots", path: "/pilots", title: "Gestão de Pilotos", short: "Aprovações de prova", description: "Ciclo de pilotos com status próprios e histórico.", icon: Ruler, group: "Produto" },
  { slug: "compras", path: "/compras", title: "Compras", short: "Reposição e cotações", description: "Necessidade de compra, sugestão e mapa de fornecedores.", icon: ShoppingCart, group: "Cadeia" },
  { slug: "centro-de-corte", path: "/centro-de-corte", title: "Centro de Corte", short: "Plano de corte", description: "Plano de corte, enfesto e peças cortadas.", icon: Scissors, group: "Cadeia" },
  { slug: "almoxarifado", path: "/almoxarifado", title: "Almoxarifado", short: "Estoque e insumos", description: "Controle de tecidos, aviamentos e produtos acabados.", icon: Boxes, group: "Cadeia" },
  { slug: "fornecedores", path: "/fornecedores", title: "Fornecedores", short: "Portal de parceiros", description: "Portal completo para fornecedores e facções.", icon: Truck, group: "Cadeia" },
  { slug: "marketing", path: "/marketing", title: "Marketing", short: "Campanhas e mídia", description: "Calendário de campanhas e performance de mídia.", icon: Megaphone, group: "Comercial" },
  { slug: "comercial", path: "/comercial", title: "Comercial / B2B", short: "Pedidos e clientes", description: "Portal B2B, pedidos, representantes e clientes.", icon: Store, group: "Comercial" },
  { slug: "financeiro", path: "/financeiro", title: "Financeiro", short: "Caixa e DRE", description: "Contas a pagar, receber, fluxo de caixa e DRE.", icon: Wallet, group: "Comercial" },
  { slug: "twin-factory", path: "/twin-factory", title: "Twin Factory", short: "Torre da produção", description: "Visão em tempo real de lotes, setores e gargalos.", icon: Activity, group: "Cadeia" },
  { slug: "intelligence", path: "/intelligence", title: "Intelligence Engine", short: "Inteligência operacional", description: "Necessidade de produção, reposição, ROI de influencers, atribuição e Product Score.", icon: Brain, group: "Inteligência" },
  { slug: "control-tower", path: "/control-tower", title: "Control Tower", short: "Demand & Supply", description: "O que produzir agora — necessidade por grade com semáforo de cobertura.", icon: Radar, group: "Inteligência" },
  { slug: "replenishment", path: "/replenishment", title: "Smart Replenishment", short: "Reposição IA", description: "Sugestão de reposição, previsão de ruptura e excesso.", icon: Zap, group: "Inteligência" },
  { slug: "geo-sales", path: "/geo-sales", title: "Geo Sales", short: "Mapa de vendas", description: "Aceitação por UF e região com mapa de calor.", icon: MapPin, group: "Inteligência" },
  { slug: "margem", path: "/margem", title: "Margem & Rentabilidade", short: "CMV, margem, ABC", description: "Margem real por SKU, markup e curva ABC dos últimos 90 dias.", icon: Percent, group: "Inteligência" },
  { slug: "profitability", path: "/profitability", title: "Motor de Rentabilidade", short: "ROI por coleção", description: "Lucro real por coleção: receita − CMV − marketing.", icon: Coins, group: "Inteligência" },
  { slug: "product-success", path: "/product-success", title: "Product Success Engine", short: "Score preditivo", description: "Probabilidade de sucesso por produto (velocidade, margem, recência).", icon: Rocket, group: "Inteligência" },
  { slug: "product-score", path: "/product-score", title: "Product Score", short: "Pontuação 0–100", description: "Pontuação por vendas, margem, ROI e giro.", icon: Star, group: "Inteligência" },
  { slug: "grade-needs", path: "/grade-needs", title: "Necessidade por Grade", short: "Quebra PP/P/M/G/GG", description: "Distribuição sugerida por tamanho com base no histórico real.", icon: Ruler, group: "Inteligência" },
  { slug: "fashion-calendar", path: "/fashion-calendar", title: "Fashion Calendar", short: "Linha do tempo", description: "Cronograma de coleções: desenvolvimento, produção e lançamento.", icon: Calendar, group: "Operação" },
  { slug: "influencer-roi", path: "/influencer-roi", title: "Influencer ROI", short: "Atribuição e uplift", description: "ROAS, uplift e tiers por influenciador.", icon: Award, group: "Comercial" },
  { slug: "sales-performance", path: "/sales-performance", title: "Sales Performance", short: "Receita e canais", description: "Receita diária, canais, ticket médio e top SKUs.", icon: LineChart, group: "Comercial" },
  { slug: "stock-health", path: "/stock-health", title: "Stock Health", short: "Saúde do estoque", description: "Ruptura, baixo, morto, excesso e cobertura por SKU.", icon: PackageSearch, group: "Cadeia" },
  { slug: "capacity", path: "/capacity", title: "Production Capacity", short: "OEE e carga", description: "OEE, WIP, atrasos e carga por fornecedor / facção.", icon: Gauge, group: "Cadeia" },
  { slug: "cashflow", path: "/cashflow", title: "Cashflow Health", short: "Saldo projetado", description: "A pagar, a receber, atrasos e projeção de 30 dias.", icon: Banknote, group: "Comercial" },
  { slug: "supplier-score", path: "/supplier-score", title: "Supplier Scorecard", short: "OTD e rating", description: "Score 0–100 por fornecedor com OTD, rating e tiers Ouro/Prata/Bronze.", icon: Trophy, group: "Cadeia" },
  { slug: "campaigns", path: "/campaigns", title: "Campaign Performance", short: "ROAS por canal", description: "Investimento, receita atribuída, margem e ROAS por campanha e canal.", icon: Target, group: "Comercial" },
  { slug: "bi", path: "/bi", title: "BI e Analytics", short: "Insights e KPIs", description: "Dashboards customizáveis e exploração de dados.", icon: BarChart3, group: "Inteligência" },
  { slug: "fashion-gpt", path: "/fashion-gpt", title: "Fashion GPT", short: "Copiloto de moda", description: "Assistente especialista no seu negócio de moda.", icon: Bot, group: "Inteligência" },
  { slug: "use-ai", path: "/use-ai", title: "USE AI", short: "Automação inteligente", description: "Agentes de IA para automação de processos.", icon: Cpu, group: "Inteligência" },
  { slug: "dpp", path: "/dpp", title: "Digital Product Passport", short: "Rastreabilidade", description: "Passaporte digital e compliance ESG.", icon: ShieldCheck, group: "Plataforma" },
  { slug: "showroom", path: "/showroom", title: "Showroom Digital", short: "Vitrine 3D", description: "Showroom virtual com lookbooks interativos.", icon: MonitorPlay, group: "Plataforma" },
  { slug: "mobile", path: "/mobile", title: "Aplicativo Mobile", short: "App para times", description: "App nativo para campo, fábrica e vendedores.", icon: Smartphone, group: "Plataforma" },
  { slug: "equipe", path: "/equipe", title: "Equipe & Permissões", short: "Usuários e papéis", description: "Gerencie usuários e atribua papéis (admin).", icon: Users, group: "Plataforma" },
];

export const MODULE_GROUPS: ModuleDef["group"][] = [
  "Operação", "Produto", "Cadeia", "Comercial", "Inteligência", "Plataforma",
];
