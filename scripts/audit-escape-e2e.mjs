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
for (const req of REQUIRED) {
  const matches = executed.filter(
    (e) => e.file === req.file && req.titleMatch.test(e.title),
  );
  if (matches.length === 0) {
    problems.push(`FALTANDO: ${req.file} :: ${req.titleMatch} (nenhum teste com esse título rodou)`);
    continue;
  }
  for (const m of matches) {
    const ok = m.aggregated === "expected" && m.last === "passed";
    if (!ok) {
      problems.push(
        `NÃO PASSOU: ${m.file} :: "${m.title}" (aggregated=${m.aggregated}, last=${m.last})`,
      );
    }
  }
}

if (problems.length) {
  console.error("::error::Auditoria Escape falhou — cenários obrigatórios não rodaram verde:");
  for (const p of problems) console.error(" - " + p);
  process.exit(1);
}

console.log(`OK: ${REQUIRED.length} cenário(s) Escape (pronto + pendente) executados e passaram.`);
