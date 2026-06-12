import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";

export function ModulePlaceholder({
  title, description, icon: Icon, features,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  features: string[];
}) {
  return (
    <div className="p-6 lg:p-10 max-w-6xl">
      <div className="flex items-start gap-4 mb-8">
        <div className="size-14 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-glow)] shrink-0">
          <Icon className="size-7 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground mt-1">{description}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((f) => (
          <div key={f} className="glass rounded-xl p-5 hover:border-primary/40 transition-colors">
            <div className="flex items-center gap-2 mb-2 text-primary">
              <Sparkles className="size-4" />
              <span className="text-[10px] uppercase tracking-widest font-medium">Recurso</span>
            </div>
            <div className="font-medium">{f}</div>
          </div>
        ))}
      </div>

      <div className="mt-10 glass rounded-2xl p-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-3">
          <span className="size-1.5 rounded-full bg-primary animate-pulse" /> Em construção
        </div>
        <h3 className="text-xl font-semibold">Módulo em desenvolvimento</h3>
        <p className="text-muted-foreground text-sm mt-2 max-w-md mx-auto">
          A estrutura está pronta. Próximo passo: conectar dados reais e habilitar fluxos de trabalho.
        </p>
      </div>
    </div>
  );
}
