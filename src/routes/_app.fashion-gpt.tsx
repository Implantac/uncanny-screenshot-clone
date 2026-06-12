import { createFileRoute } from "@tanstack/react-router";
import { Bot, Send, Sparkles, User, Database } from "lucide-react";
import { useRef, useEffect, useState, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Markdown } from "@/components/markdown";
import { buildFashionContext } from "@/lib/fashion-context";

export const Route = createFileRoute("/_app/fashion-gpt")({
  head: () => ({
    meta: [
      { title: "Fashion GPT · USE MODA OS" },
      { name: "description", content: "Copiloto de IA especialista em moda." },
    ],
  }),
  component: FashionGPT,
});

const suggestions = [
  "Quais peças têm maior margem hoje?",
  "Como está minha carteira de pedidos B2B?",
  "Qual meu saldo financeiro projetado?",
  "Quais itens do almoxarifado estão em nível crítico?",
];

function FashionGPT() {
  const endRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");

  const { data: context } = useQuery({
    queryKey: ["fashion-context"],
    queryFn: buildFashionContext,
    staleTime: 60_000,
  });
  const contextRef = useRef(context);
  useEffect(() => { contextRef.current = context; }, [context]);

  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/chat",
    prepareSendMessagesRequest: ({ messages }) => ({
      body: { messages, context: contextRef.current },
    }),
  }), []);

  const { messages, sendMessage, status } = useChat({
    transport,
    onError: (err) => {
      const msg = err.message || "";
      if (msg.includes("429")) toast.error("Muitas requisições. Tente novamente em instantes.");
      else if (msg.includes("402")) toast.error("Créditos de IA esgotados no workspace.");
      else toast.error("Erro ao chamar o Fashion GPT.");
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const send = (text: string) => {
    if (!text.trim() || isLoading) return;
    sendMessage({ text: text.trim() });
    setInput("");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="p-6 border-b border-border flex items-center gap-3">
        <div className="size-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)]">
          <Bot className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Fashion GPT</h1>
          <p className="text-xs text-muted-foreground">Copiloto IA · Gemini 3 Flash</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {messages.length === 0 && (
            <div className="flex gap-3">
              <div className="size-8 rounded-full bg-[image:var(--gradient-primary)] grid place-items-center shrink-0 shadow-[var(--shadow-glow)]">
                <Sparkles className="size-4 text-primary-foreground" />
              </div>
              <div className="glass rounded-2xl px-4 py-2.5 max-w-[80%] text-sm leading-relaxed">
                Olá! Sou o <strong>Fashion GPT</strong>, seu copiloto especialista em moda. Pergunte sobre coleções, margens, fornecedores, PCP ou qualquer área da operação.
              </div>
            </div>
          )}
          {messages.map((m) => {
            const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
            return (
              <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`size-8 rounded-full grid place-items-center shrink-0 ${m.role === "user" ? "bg-muted" : "bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]"}`}>
                  {m.role === "user" ? <User className="size-4" /> : <Sparkles className="size-4 text-primary-foreground" />}
                </div>
                <div className={`rounded-2xl px-4 py-2.5 max-w-[80%] text-sm leading-relaxed ${m.role === "user" ? "bg-primary text-primary-foreground" : "glass"}`}>
                  {m.role === "user" ? (
                    <div className="whitespace-pre-wrap">{text}</div>
                  ) : (
                    <Markdown content={text} />
                  )}
                </div>
              </div>
            );
          })}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
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
          {messages.length === 0 && (
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
            <button type="submit" disabled={!input.trim() || isLoading} className="size-9 rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground grid place-items-center shadow-[var(--shadow-glow)] disabled:opacity-40 disabled:shadow-none transition-opacity">
              <Send className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
