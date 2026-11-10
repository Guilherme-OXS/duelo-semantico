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

// Enriquece sentidos duplos comuns (ex: folha de arvore e folha de papel/prova) + pincel/tinta
if (WORDS.folha) {
  WORDS.folha.links = ["arvore", "papel", "caderno", "livro", "floresta", "vento", "prova"];
}
WORDS.pincel = {
  word: "pincel",
  category: THEMES.musica_arte_lazer.label,
  cluster: "musica_arte_lazer",
  sub: "arte",
  vec: [...THEMES.musica_arte_lazer.vec],
  links: ["pintura", "tinta", "quadro", "arte", "lapis", "escola"],
  hint: "Instrumento com cerdas usado com tinta para pintar quadros ou ilustracoes."
};
WORDS.tinta = {
  word: "tinta",
  category: THEMES.musica_arte_lazer.label,
  cluster: "musica_arte_lazer",
  sub: "arte",
  vec: [...THEMES.musica_arte_lazer.vec],
  links: ["pintura", "pincel", "caneta", "papel", "quadro", "arte"],
  hint: "Liquido colorido usado em pinturas, canetas e impressoras."
};
if (!SECRET_POOL.includes("pincel")) SECRET_POOL.push("pincel");
if (!SECRET_POOL.includes("tinta")) SECRET_POOL.push("tinta");

// Re-suaviza os vetores de folha, pincel, tinta com os seus vizinhos atuais
for (const key of ["folha", "pincel", "tinta"]) {
  const entry = WORDS[key];
  const base = [...THEMES[entry.cluster].vec];
  const valid = entry.links.filter((l) => WORDS[l]);
  if (valid.length > 0) {
    const avg = new Array(24).fill(0);
    for (const nb of valid) {
      for (let d = 0; d < 24; d++) avg[d] += WORDS[nb].vec[d] || 0;
    }
    for (let d = 0; d < 24; d++) avg[d] /= valid.length;
    entry.vec = base.map((v, d) => Math.round((0.55 * v + 0.45 * avg[d]) * 1000) / 1000);
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
console.log("[OK] Bridges aplicados! WORDS:", Object.keys(WORDS).length);
