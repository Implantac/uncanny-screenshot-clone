import { createFileRoute } from "@tanstack/react-router";
import { Bot, Send, Sparkles, User } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export const Route = createFileRoute("/_app/fashion-gpt")({
  head: () => ({
    meta: [
      { title: "Fashion GPT · USE MODA OS" },
      { name: "description", content: "Copiloto de IA especialista em moda." },
    ],
  }),
  component: FashionGPT,
});

type Msg = { role: "user" | "assistant"; content: string };

const suggestions = [
  "Quais peças têm maior margem na coleção Verão 26?",
  "Crie um briefing para uma cápsula praia de 12 peças",
  "Quais fornecedores estão atrasando entregas este mês?",
  "Resuma o desempenho comercial da última semana",
];

const seed: Msg[] = [
  { role: "assistant", content: "Olá! Sou o Fashion GPT, seu copiloto especialista em moda. Tenho acesso a todos os módulos da USE MODA OS — coleções, produção, vendas, fornecedores e estoque. Como posso ajudar?" },
];

function FashionGPT() {
  const [messages, setMessages] = useState<Msg[]>(seed);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  const send = (text: string) => {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setMessages((m) => [...m, { role: "assistant", content: mockReply(text) }]);
      setTyping(false);
    }, 900);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="p-6 border-b border-border flex items-center gap-3">
        <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <Bot className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Fashion GPT</h1>
          <p className="text-xs text-muted-foreground">Copiloto conectado aos 18 módulos · v2.4</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`size-8 rounded-full grid place-items-center shrink-0 ${m.role === "user" ? "bg-muted" : "bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]"}`}>
                {m.role === "user" ? <User className="size-4" /> : <Sparkles className="size-4 text-primary-foreground" />}
              </div>
              <div className={`rounded-2xl px-4 py-2.5 max-w-[80%] text-sm leading-relaxed ${m.role === "user" ? "bg-primary text-primary-foreground" : "glass"}`}>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex gap-3">
              <div className="size-8 rounded-full bg-[image:var(--gradient-primary)] grid place-items-center">
                <Sparkles className="size-4 text-primary-foreground" />
              </div>
              <div className="glass rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce" />
                  <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:120ms]" />
                  <span className="size-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:240ms]" />
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="p-4 border-t border-border bg-background">
        <div className="max-w-3xl mx-auto">
          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)} className="text-xs px-3 py-1.5 rounded-full glass hover:border-primary/40 transition-colors text-muted-foreground hover:text-foreground">
                  {s}
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex gap-2 items-end glass rounded-2xl p-2 focus-within:border-primary/40"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
              rows={1}
              placeholder="Pergunte ao Fashion GPT…"
              className="flex-1 bg-transparent resize-none px-3 py-2 text-sm focus:outline-none placeholder:text-muted-foreground max-h-32"
            />
            <button type="submit" disabled={!input.trim()} className="size-9 rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground grid place-items-center shadow-[var(--shadow-glow)] disabled:opacity-40 disabled:shadow-none transition-opacity">
              <Send className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function mockReply(q: string): string {
  const lower = q.toLowerCase();
  if (lower.includes("margem") || lower.includes("verão")) {
    return "Analisei a coleção Verão 26 (142 peças). Top 3 em margem:\n\n1. Vestido Midi Linho — 68% (R$ 289 / custo R$ 92)\n2. Top Cropped Tricot — 64% (R$ 149 / custo R$ 54)\n3. Camisa Linho MC — 61% (R$ 199 / custo R$ 77)\n\nRecomendo destacar essas 3 peças no próximo lookbook B2B.";
  }
  if (lower.includes("briefing") || lower.includes("cápsula")) {
    return "Briefing — Cápsula Praia (12 peças)\n\nConceito: Mediterrâneo contemporâneo, tons areia, oliva e off-white.\nPúblico: Mulheres 25-40, lifestyle praia urbana.\nMix sugerido: 4 vestidos · 3 saídas · 2 conjuntos · 2 acessórios · 1 chapéu.\nMateriais: linho lavado, viscose ecológica, crochê artesanal.\nWindow: 8 semanas. Custo-alvo médio: R$ 95/peça.\n\nPosso gerar as fichas técnicas iniciais?";
  }
  if (lower.includes("fornecedor") || lower.includes("atraso")) {
    return "Encontrei 3 fornecedores com atrasos este mês:\n\n• Santos & Cia (facção) — OP #4821 com 4 dias de atraso\n• Tecidos Brasil — lote de viscose previsto 05/06, ainda não entregue\n• Aviamentos SP — pedido parcial (60% entregue)\n\nQuer que eu abra tickets de cobrança no Portal de Fornecedores?";
  }
  if (lower.includes("comercial") || lower.includes("vendas")) {
    return "Desempenho comercial — últimos 7 dias:\n\n• Receita B2B: R$ 847k (+18% vs semana anterior)\n• Pedidos: 142 (ticket médio R$ 5.964)\n• Top cliente: Boutique Iguatemi (R$ 92k)\n• Conversão showroom digital: 34%\n• Mix: 58% feminino · 28% masculino · 14% acessórios\n\nDestaque: a coleção Resort 26 já representa 41% das vendas mesmo antes do lançamento oficial.";
  }
  return "Entendi. Para responder com precisão, preciso consultar os módulos relacionados. Posso buscar dados em Coleções, Produção, Comercial, Estoque ou Financeiro — qual o foco principal?";
}
