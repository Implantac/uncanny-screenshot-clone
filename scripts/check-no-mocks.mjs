#!/usr/bin/env node
/**
 * Guardrail: bloqueia qualquer uso de dados mock/seed/fake/placeholder.
 * Falha o processo (exit 1) se encontrar padrões proibidos em telas,
 * hooks, libs, server functions ou migrations.
 *
 * Regra do projeto: USE MODA PLM trabalha SOMENTE com dados reais
 * (ERP read-only + Supabase do PLM). Telas vazias mostram empty state,
 * nunca dado fictício.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["src", "supabase/migrations"];
const ALLOW_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".sql"]);

// Arquivos/paths permitidos (o próprio guardrail, testes do guardrail, etc.)
const ALLOWLIST_PATHS = [
  "scripts/check-no-mocks.mjs",
  "src/integrations/supabase/types.ts", // auto-gerado
  "src/routeTree.gen.ts",
];

// Padrões proibidos — identificadores e literais típicos de dados fake.
// Usa word-boundary para evitar falsos positivos (ex.: "seedling").
const FORBIDDEN_PATTERNS = [
  { re: /\bmockData\b/i, msg: "variável mockData" },
  { re: /\bfakeData\b/i, msg: "variável fakeData" },
  { re: /\bdummyData\b/i, msg: "variável dummyData" },
  { re: /\bsampleData\b/i, msg: "variável sampleData" },
  { re: /\bMOCK_[A-Z0-9_]+\b/, msg: "constante MOCK_*" },
  { re: /\bFAKE_[A-Z0-9_]+\b/, msg: "constante FAKE_*" },
  { re: /\bSAMPLE_[A-Z0-9_]+\b/, msg: "constante SAMPLE_*" },
  { re: /from\s+["'][^"']*\/mocks?\/[^"']*["']/i, msg: 'import de "/mock(s)/"' },
  { re: /from\s+["'][^"']*\/fixtures?\/[^"']*["']/i, msg: 'import de "/fixture(s)/"' },
  { re: /\bfaker\.[a-z]/i, msg: "uso de faker.*" },
  { re: /@faker-js\/faker/, msg: "dependência @faker-js/faker" },
  { re: /\bchance\.[a-z]+\(/, msg: "uso de chance.*" },
  { re: /\bLorem ipsum\b/i, msg: 'texto "Lorem ipsum"' },
  { re: /\bplaceholder\.com\b/, msg: "URL placeholder.com" },
  { re: /\bvia\.placeholder\.com\b/, msg: "URL via.placeholder.com" },
  // SQL: INSERT em migration é considerado seed (apenas em .sql)
  {
    re: /\bINSERT\s+INTO\b/i,
    msg: "INSERT em migration (seed de dados é proibido)",
    onlyExt: [".sql"],
  },
];

const violations = [];

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      walk(full);
    } else {
      const ext = extname(name);
      if (!ALLOW_EXT.has(ext)) continue;
      const rel = relative(ROOT, full).replaceAll("\\", "/");
      if (ALLOWLIST_PATHS.includes(rel)) continue;
      scanFile(full, rel, ext);
    }
  }
}

function scanFile(full, rel, ext) {
  const text = readFileSync(full, "utf8");
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Permite override explícito linha a linha:  // allow-mock: motivo
    if (/(allow-mock|lovable-allow-mock)/i.test(line)) continue;
    for (const { re, msg, onlyExt } of FORBIDDEN_PATTERNS) {
      if (onlyExt && !onlyExt.includes(ext)) continue;
      if (re.test(line)) {
        violations.push({ file: rel, line: i + 1, msg, snippet: line.trim().slice(0, 160) });
      }
    }
  }
}

for (const d of SCAN_DIRS) walk(join(ROOT, d));

if (violations.length > 0) {
  console.error("\n❌ Guardrail de dados reais — padrões proibidos encontrados:\n");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  →  ${v.msg}`);
    console.error(`    ${v.snippet}\n`);
  }
  console.error(
    `Total: ${violations.length} violação(ões).\n` +
      `Regra: o projeto trabalha SOMENTE com dados reais (ERP read-only + Supabase).\n` +
      `Para casos legítimos (ex.: storybook), adicione  // allow-mock: motivo  na linha.\n`,
  );
  process.exit(1);
}

console.log("✅ Guardrail de dados reais: nenhum mock/seed/fake encontrado.");
