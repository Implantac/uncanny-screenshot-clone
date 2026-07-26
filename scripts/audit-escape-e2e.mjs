#!/usr/bin/env node
/**
 * Auditoria de cobertura: garante que os cenários de Escape do
 * ProductReadinessBadge realmente ROdaram para pronto E pendente.
 *
 * Falha se qualquer caso esperado estiver ausente, skipped, ou não passou.
 *
 * Entrada: playwright-results.json (reporter=json).
 */
import fs from "node:fs";

const REPORT = process.argv[2] ?? "playwright-results.json";
if (!fs.existsSync(REPORT)) {
  console.error(`::error::Report ${REPORT} não encontrado — o Playwright rodou?`);
  process.exit(1);
}

// Cada entrada = uma variação do cenário Escape que PRECISA passar de verdade.
// file = basename do spec; titleMatch = regex contra o título do teste.
const REQUIRED = [
  // escape puro (foco -> Escape)
  { file: "product-readiness-badge-escape.spec.ts", titleMatch: /^\[ready\]/ },
  { file: "product-readiness-badge-escape.spec.ts", titleMatch: /^\[pending\]/ },
  // Enter/Espaço abre, Escape fecha
  { file: "product-readiness-badge-enter-space.spec.ts", titleMatch: /^\[ready\].*Enter\b.*Escape/ },
  { file: "product-readiness-badge-enter-space.spec.ts", titleMatch: /^\[ready\].*Space\b.*Escape/ },
  { file: "product-readiness-badge-enter-space.spec.ts", titleMatch: /^\[pending\].*Enter\b.*Escape/ },
  { file: "product-readiness-badge-enter-space.spec.ts", titleMatch: /^\[pending\].*Space\b.*Escape/ },
  // aria-describedby some após Escape
  { file: "product-readiness-badge-aria-describedby.spec.ts", titleMatch: /^\[ready\]/ },
  { file: "product-readiness-badge-aria-describedby.spec.ts", titleMatch: /^\[pending\]/ },
];

const report = JSON.parse(fs.readFileSync(REPORT, "utf8"));

// Coleta { file, title, status, outcome } de todos os testes executados.
const executed = [];
const walk = (suite, file = suite.file ?? null) => {
  const currentFile = suite.file ?? file;
  for (const s of suite.suites ?? []) walk(s, currentFile);
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      // status agregado do Playwright: expected | unexpected | flaky | skipped
      const aggregated = t.status ?? "unknown";
      // último resultado individual (passed | failed | timedOut | skipped | interrupted)
      const last = (t.results ?? []).at(-1)?.status ?? "unknown";
      executed.push({
        file: (spec.file ?? currentFile ?? "").split("/").pop(),
        title: spec.title,
        aggregated,
        last,
      });
    }
  }
};
for (const s of report.suites ?? []) walk(s);

const problems = [];
const rows = []; // { status, file, title, reason }
for (const req of REQUIRED) {
  const matches = executed.filter(
    (e) => e.file === req.file && req.titleMatch.test(e.title),
  );
  if (matches.length === 0) {
    const msg = `FALTANDO: ${req.file} :: ${req.titleMatch} (nenhum teste com esse título rodou)`;
    problems.push(msg);
    rows.push({
      status: "🚫 FALTANDO",
      file: req.file,
      title: String(req.titleMatch),
      reason: "nenhum teste com esse título rodou (spec não existe, foi filtrado, ou o título mudou)",
    });
    continue;
  }
  for (const m of matches) {
    const ok = m.aggregated === "expected" && m.last === "passed";
    if (!ok) {
      problems.push(
        `NÃO PASSOU: ${m.file} :: "${m.title}" (aggregated=${m.aggregated}, last=${m.last})`,
      );
      const icon = m.last === "skipped" || m.aggregated === "skipped" ? "⏭️ SKIPPED" : "❌ FALHOU";
      const reason =
        m.last === "skipped" || m.aggregated === "skipped"
          ? "teste foi skipado (test.skip / fixture ausente / credenciais faltando)"
          : `execução não passou (aggregated=${m.aggregated}, last=${m.last})`;
      rows.push({ status: icon, file: m.file, title: m.title, reason });
    } else {
      rows.push({ status: "✅ OK", file: m.file, title: m.title, reason: "passou" });
    }
  }
}

// Link direto pra aba de artifacts desta run (aparece no summary quando falha).
const runUrl =
  process.env.GITHUB_SERVER_URL &&
  process.env.GITHUB_REPOSITORY &&
  process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}#artifacts`
    : null;

// Escreve resumo no GitHub Actions Job Summary quando disponível.
const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (summaryPath) {
  const failing = rows.filter((r) => !r.status.startsWith("✅"));
  const lines = [];
  lines.push("## Auditoria — Cenário Escape (ProductReadinessBadge)");
  lines.push("");
  if (failing.length === 0) {
    lines.push(`✅ Todos os ${REQUIRED.length} casos obrigatórios rodaram e passaram.`);
  } else {
    lines.push(`❌ ${failing.length} caso(s) obrigatório(s) falharam ou foram skipados:`);
    lines.push("");
    lines.push("| Status | Spec | Teste | Motivo |");
    lines.push("| --- | --- | --- | --- |");
    for (const r of failing) {
      const esc = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
      lines.push(`| ${r.status} | \`${esc(r.file)}\` | ${esc(r.title)} | ${esc(r.reason)} |`);
    }
    lines.push("");
    lines.push("<details><summary>Todos os casos auditados</summary>");
    lines.push("");
    lines.push("| Status | Spec | Teste | Motivo |");
    lines.push("| --- | --- | --- | --- |");
    for (const r of rows) {
      const esc = (s) => String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
      lines.push(`| ${r.status} | \`${esc(r.file)}\` | ${esc(r.title)} | ${esc(r.reason)} |`);
    }
    lines.push("");
    lines.push("</details>");
    lines.push("");
    if (runUrl) {
      lines.push(
        `> 📎 Traces, screenshots e vídeos desses casos: [artifact \`escape-failure-*\` desta run](${runUrl})`,
      );
    } else {
      lines.push("> Traces, screenshots e vídeos desses casos estão no artifact `escape-failure-*` desta run.");
    }
  }
  fs.appendFileSync(summaryPath, lines.join("\n") + "\n");
}

if (problems.length) {
  // Anotações por caso falhando — aparecem inline no checks UI do PR.
  for (const r of rows.filter((r) => !r.status.startsWith("✅"))) {
    const title = `Escape audit: ${r.status.replace(/^\S+\s/, "")}`;
    console.error(
      `::error file=e2e/${r.file},title=${title}::${r.title} — ${r.reason}`,
    );
  }
  console.error("::error::Auditoria Escape falhou — cenários obrigatórios não rodaram verde:");
  for (const p of problems) console.error(" - " + p);
  process.exit(1);
}

console.log(`OK: ${REQUIRED.length} cenário(s) Escape (pronto + pendente) executados e passaram.`);

