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

// Padrões proibidos — restritos a identificadores claramente de "dados fake".
// Evita falsos positivos: ex. "sample" no sentido de amostra de produto é OK.
const FORBIDDEN_PATTERNS = [
  { re: /\bmockData\b/, msg: "identificador mockData" },
  { re: /\bfakeData\b/, msg: "identificador fakeData" },
  { re: /\bdummyData\b/, msg: "identificador dummyData" },
  { re: /\bsampleData\b/, msg: "identificador sampleData" },
  { re: /\bseedData\b/, msg: "identificador seedData" },
  { re: /\b(MOCK|FAKE|DUMMY|SAMPLE|SEED)_DATA\b/, msg: "constante *_DATA fake" },
  { re: /\b(generate|create|get|make|build)Mock[A-Z]\w*/, msg: "função generateMock*/createMock*" },
  { re: /\b(generate|create|get|make|build)Fake[A-Z]\w*/, msg: "função generateFake*/createFake*" },
  { re: /from\s+["'][^"']*\/__mocks__\/[^"']*["']/, msg: 'import de "/__mocks__/"' },
  { re: /from\s+["'][^"']*\/fixtures?\/[^"']*["']/, msg: 'import de "/fixture(s)/"' },
  { re: /from\s+["']@faker-js\/faker["']/, msg: "import de @faker-js/faker" },
  { re: /\bfaker\.(name|internet|lorem|datatype|company|address|finance|commerce)\b/, msg: "uso de faker.*" },
  { re: /\bLorem ipsum\b/i, msg: 'texto "Lorem ipsum"' },
  { re: /\bvia\.placeholder\.com\b/, msg: "URL via.placeholder.com" },
  { re: /\bplacehold\.co\b/, msg: "URL placehold.co" },
  { re: /\bpicsum\.photos\b/, msg: "URL picsum.photos (imagens fake)" },
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
