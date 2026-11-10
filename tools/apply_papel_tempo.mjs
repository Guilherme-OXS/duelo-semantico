import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
if (typeof globalThis.window === "undefined") {
  globalThis.window = globalThis;
}

const dataPath = path.resolve("e:/Projetos/RPGnovo/public/js/dictionary-data.js");
require(dataPath);

const data = globalThis.DUELO_DATA;
const { THEMES, WORDS, SECRET_POOL, ALIASES } = data;

if (WORDS.folha) {
  WORDS.folha.links = ["arvore", "papel", "caderno", "livro", "floresta", "vento", "prova"];
}
if (WORDS.papel) {
  WORDS.papel.links = ["livro", "caderno", "escrever", "arvore", "folha", "madeira", "celulose"];
}
if (WORDS.madeira) {
  WORDS.madeira.links = ["arvore", "floresta", "papel", "mesa", "porta", "celulose", "tronco"];
}

WORDS.celulose = {
  word: "celulose",
  category: THEMES.ciencia_energia.label,
  cluster: "ciencia_energia",
  sub: "materia",
  vec: [...THEMES.ciencia_energia.vec],
  links: ["papel", "madeira", "arvore", "folha", "floresta", "ciencia"],
  hint: "Fibra vegetal extraida da madeira usada como materia-prima para fabricar papel."
};
WORDS.desmatamento = {
  word: "desmatamento",
  category: THEMES.natureza_clima.label,
  cluster: "natureza_clima",
  sub: "flora",
  vec: [...THEMES.natureza_clima.vec],
  links: ["floresta", "arvore", "madeira", "natureza", "fogo", "terra"],
  hint: "Derrubada de arvores e destruicao de areas de floresta."
};

const tempoWords = ["tempo", "relogio", "hora", "dia", "noite", "semana", "mes", "ano", "passado", "futuro", "manha", "tarde", "inverno", "verao", "outono", "primavera", "idade"];
for (const tw of tempoWords) {
  if (WORDS[tw]) {
    WORDS[tw].cluster = "tempo_espaco";
    WORDS[tw].category = THEMES.tempo_espaco.label;
    WORDS[tw].vec = [...THEMES.tempo_espaco.vec];
  }
}

for (const w of ["celulose", "desmatamento"]) {
  if (!SECRET_POOL.includes(w)) SECRET_POOL.push(w);
}

const targets = new Set(["folha", "papel", "madeira", "celulose", "desmatamento", ...tempoWords]);
for (const key of targets) {
  const entry = WORDS[key];
  if (!entry || !THEMES[entry.cluster]) continue;
  const base = [...THEMES[entry.cluster].vec];
  const valid = (entry.links || []).filter((l) => WORDS[l]);
  if (valid.length > 0) {
    const avg = new Array(24).fill(0);
    for (const nb of valid) {
      for (let d = 0; d < 24; d++) avg[d] += WORDS[nb].vec[d] || 0;
    }
    for (let d = 0; d < 24; d++) avg[d] /= valid.length;
    entry.vec = base.map((v, d) => Math.round((0.62 * v + 0.38 * avg[d]) * 1000) / 1000);
  }
}

const outContent =
  "/**\n" +
  " * BANCO DE DADOS SEMANTICO 24D DA LINGUA PORTUGUESA (js/dictionary-data.js)\n" +
  " * 16 dominios semanticos nítidos com difusao em grafo de conexoes reais.\n" +
  " */\n" +
  "window.DUELO_DATA = {\n" +
  "  THEMES: " + JSON.stringify(THEMES, null, 2) + ",\n" +
  "  WORDS: " + JSON.stringify(WORDS, null, 2) + ",\n" +
  "  SECRET_POOL: " + JSON.stringify(SECRET_POOL) + ",\n" +
  "  ALIASES: " + JSON.stringify(ALIASES, null, 2) + "\n" +
  "};\n";

fs.writeFileSync(dataPath, outContent, "utf8");
console.log("[OK] Papel + Tempo + 2-hop atualizados! WORDS:", Object.keys(WORDS).length);
