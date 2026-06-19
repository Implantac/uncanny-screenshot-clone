import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Rocket, Calendar, FileText, Star, ArrowRight, Sparkles } from "lucide-react";
import { getLaunchingThisWeek } from "@/lib/launching-week.functions";

export function LaunchingWeekPanel() {
  const fetchFn = useServerFn(getLaunchingThisWeek);
  const { data, isLoading } = useQuery({
    queryKey: ["launching-this-week"],
    queryFn: () => fetchFn(),
    refetchInterval: 120_000,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Rocket className="h-4 w-4 text-primary" />
              Coleções em lançamento esta semana
            </CardTitle>
            <CardDescription>
              Últimos 7 dias · brief auto-criado + carro-chefe vinculado
            </CardDescription>
          </div>
          {data && data.length > 0 && (
            <Badge variant="secondary">{data.length} ativa{data.length > 1 ? "s" : ""}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : !data || data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhuma coleção entrou em lançamento nos últimos 7 dias.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.map((it) => (
              <div
                key={it.collectionId}
                className="rounded-lg border bg-card p-3 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{it.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[it.season, it.year].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0 gap-1">
                    <Calendar className="h-3 w-3" />
                    {it.daysInLaunch}d
                  </Badge>
                </div>

                <div className="space-y-1.5 text-xs">
                  {it.heroProductName ? (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Star className="h-3 w-3 text-amber-500" />
                      <span className="truncate">
                        Carro-chefe: <span className="text-foreground">{it.heroProductName}</span>
                        {it.heroProductSku && <span className="opacity-60"> · {it.heroProductSku}</span>}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-amber-600">
                      <Star className="h-3 w-3" />
                      <span>Sem carro-chefe definido</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    {it.briefId ? (
                      <span>
                        Brief:{" "}
                        <Badge variant="secondary" className="text-[10px] py-0">
                          {it.briefStatus}
                        </Badge>
                      </span>
                    ) : (
                      <span className="text-amber-600">Brief pendente</span>
                    )}
                    <span className="opacity-60">· {it.productsCount} produtos</span>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" asChild className="flex-1 h-7 text-xs">
                    <Link to="/colecoes">
                      Coleção <ArrowRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                  {it.briefId && (
                    <Button size="sm" variant="default" asChild className="flex-1 h-7 text-xs">
                      <Link to="/marketing">
                        Brief <ArrowRight className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
