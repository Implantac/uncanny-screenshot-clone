import { createFileRoute } from "@tanstack/react-router";
import { Bot, Send, Sparkles, User, Wrench, ChevronDown, ChevronRight } from "lucide-react";
import { useRef, useEffect, useState, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { toast } from "sonner";
import { Markdown } from "@/components/markdown";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/_app/copilot")({
  head: () => ({
    meta: [
      { title: "Copiloto PCP · USE MODA OS" },
      { name: "description", content: "Copiloto IA com acesso direto aos dados de produção, suprimentos e qualidade." },
    ],
  }),
  component: CopilotPage,
});

const SUGGESTIONS = [
  "Quais OPs estão atrasadas?",
  "O que está em risco para esta semana?",
  "Quais insumos estão abaixo do mínimo?",
  "Quais fornecedores tiveram mais ocorrências?",
  "Existem ocorrências críticas abertas?",
];

type ToolPart = {
  type: string;
  toolName?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
};

function ToolCallCard({ part }: { part: ToolPart }) {
  const [open, setOpen] = useState(false);
  const name = part.toolName ?? part.type.replace(/^tool-/, "");
  const done = part.state === "output-available" || part.output !== undefined;
  return (
    <div className="border border-border rounded-lg overflow-hidden text-xs">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-2 flex items-center gap-2 bg-muted/40 hover:bg-muted/60 text-left"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <Wrench className="size-3 text-primary" />
        <span className="font-mono font-medium">{name}</span>
        <span className={`ml-auto text-[10px] ${done ? "text-emerald-500" : "text-amber-500"}`}>
          {done ? "ok" : "executando…"}
        </span>
      </button>
      {open && (
        <div className="px-3 py-2 space-y-2 bg-background">
          {part.input !== undefined && (
            <div>
              <div className="text-[10px] uppercase text-muted-foreground mb-0.5">input</div>
              <pre className="text-[11px] whitespace-pre-wrap break-words">{JSON.stringify(part.input, null, 2)}</pre>
            </div>
          )}
          {part.output !== undefined && (
            <div>
              <div className="text-[10px] uppercase text-muted-foreground mb-0.5">output</div>
              <pre className="text-[11px] whitespace-pre-wrap break-words max-h-64 overflow-auto">
                {JSON.stringify(part.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CopilotPage() {
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/copilot",
        prepareSendMessagesRequest: async ({ messages }) => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          const headers: Record<string, string> = {};
          if (token) headers.Authorization = `Bearer ${token}`;
          return { body: { messages }, headers };
        },
      }),
    [],
  );

  const { messages, sendMessage, status } = useChat({
    transport,
    onError: (err) => {
      const msg = err.message || "";
      if (msg.includes("429")) toast.error("Muitas requisições. Aguarde um instante.");
      else if (msg.includes("402")) toast.error("Créditos de IA esgotados.");
      else toast.error("Erro no Copiloto PCP.");
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isLoading) inputRef.current?.focus();
  }, [isLoading, messages.length]);

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
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight">Copiloto PCP</h1>
          <p className="text-xs text-muted-foreground">
            Chat especialista · consulta atrasos, riscos, faltas e ocorrências em tempo real
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {messages.length === 0 && (
            <div className="flex gap-3">
              <div className="size-8 rounded-full bg-[image:var(--gradient-primary)] grid place-items-center shrink-0">
                <Sparkles className="size-4 text-primary-foreground" />
              </div>
              <div className="glass rounded-2xl px-4 py-2.5 max-w-[80%] text-sm leading-relaxed">
                Sou o <strong>Copiloto PCP</strong>. Posso responder sobre OPs atrasadas, OPs em risco,
                faltas de insumo, ocorrências críticas e fornecedores problemáticos consultando seus dados reais.
              </div>
            </div>
          )}

          {messages.map((m) => {
            const text = m.parts
              .filter((p: any) => p.type === "text")
              .map((p: any) => p.text)
              .join("");
            const toolParts = m.parts.filter((p: any) => p.type?.startsWith("tool-")) as ToolPart[];
            return (
              <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div
                  className={`size-8 rounded-full grid place-items-center shrink-0 ${
                    m.role === "user"
                      ? "bg-muted"
                      : "bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]"
                  }`}
                >
                  {m.role === "user" ? (
                    <User className="size-4" />
                  ) : (
                    <Sparkles className="size-4 text-primary-foreground" />
                  )}
                </div>
                <div className={`max-w-[80%] space-y-2 ${m.role === "user" ? "items-end" : ""}`}>
                  {toolParts.length > 0 && (
                    <div className="space-y-1.5">
                      {toolParts.map((p, i) => (
                        <ToolCallCard key={i} part={p} />
                      ))}
                    </div>
                  )}
                  {text && (
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        m.role === "user" ? "bg-primary text-primary-foreground" : "glass"
                      }`}
                    >
                      {m.role === "user" ? (
                        <div className="whitespace-pre-wrap">{text}</div>
                      ) : (
                        <Markdown content={text} />
                      )}
                    </div>
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
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-xs px-3 py-1.5 rounded-full glass hover:border-primary/40 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2 items-end glass rounded-2xl p-2 focus-within:border-primary/40"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Pergunte ao Copiloto PCP…"
              className="flex-1 bg-transparent resize-none px-3 py-2 text-sm focus:outline-none placeholder:text-muted-foreground max-h-32"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="size-9 rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground grid place-items-center shadow-[var(--shadow-glow)] disabled:opacity-40"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
