import {
  LayoutDashboard, Layers, Sparkles, FileText, PenTool, Scissors,
  Factory, Boxes, Truck, Megaphone, Store, Wallet, BarChart3,
  Bot, Cpu, ShieldCheck, MonitorPlay, Smartphone, Users, Brain,
  Radar, Zap, MapPin, Activity, type LucideIcon,
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
