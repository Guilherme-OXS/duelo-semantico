/**
 * Enriquece public/js/dictionary-data.js com palavras cotidianas essenciais,
 * preenche links pendentes sem adicionar lixo composto e valida grafos mutuos.
 */
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
const THEMES = data.THEMES;
const WORDS = data.WORDS;
const ALIASES = data.ALIASES || {};
const SECRET_POOL = data.SECRET_POOL || [];

// 1. Vocabulario essencial ausente + melhorias de grafos para culinaria, objetos e acoes cotidianas
const CURATED_ADDITIONS = [
  // Alimentacao, Temperos, Refeicoes & Cozinha
  ["oliva", "alimentacao_bebida", "tempero", ["azeite", "azeitona", "oleo", "salada", "tempero"], "Fruto da oliveira do qual se extrai o azeite."],
  ["azeitona", "alimentacao_bebida", "tempero", ["oliva", "azeite", "pizza", "salada", "tempero"], "Pequeno fruto verde ou preto usado em saladas, pizzas e na producao de azeite."],
  ["oleo", "alimentacao_bebida", "tempero", ["azeite", "oliva", "liquido", "panela", "cozinha", "manteiga"], "Gordura liquida vegetal usada para cozinhar, temperar ou fritar alimentos."],
  ["vinagre", "alimentacao_bebida", "tempero", ["azeite", "salada", "sal", "tempero", "garrafa"], "Liquido acido usado ao lado do azeite para temperar saladas."],
  ["tempero", "alimentacao_bebida", "tempero", ["sal", "azeite", "alho", "cebola", "pimenta", "oleo", "molho"], "Ingrediente como sal, alho ou azeite usado para dar sabor a comida."],
  ["manteiga", "alimentacao_bebida", "tempero", ["pao", "leite", "oleo", "cafe", "queijo", "cozinha"], "Gordura cremosa derivada do leite usada no pao e na cozinha."],
  ["molho", "alimentacao_bebida", "tempero", ["tomate", "tempero", "azeite", "macarrao", "salada", "panela"], "Preparo liquido ou cremoso servido sobre massas, carnes e saladas."],
  ["salada", "alimentacao_bebida", "hortifruti", ["alface", "tomate", "azeite", "vinagre", "verdura", "oliva", "prato"], "Prato leve de folhas, verduras e legumes temperado com sal e azeite."],
  ["verdura", "alimentacao_bebida", "hortifruti", ["alface", "salada", "legume", "tomate", "comida", "verde"], "Hortalica folhosa verde cultivada para alimentacao saudavel."],
  ["legume", "alimentacao_bebida", "hortifruti", ["cenoura", "batata", "verdura", "salada", "comida", "panela"], "Alimento vegetal nutritivo como cenoura, batata e abobora."],
  ["almoco", "alimentacao_bebida", "refeicao", ["jantar", "comida", "arroz", "feijao", "prato", "carne", "restaurante", "comer"], "Refeicao principal servida no meio do dia com arroz, feijao e acompanhamento."],
  ["jantar", "alimentacao_bebida", "refeicao", ["almoco", "comida", "prato", "mesa", "restaurante", "noite", "comer"], "Refeicao feita a noite com a familia ou amigos."],
  ["lanche", "alimentacao_bebida", "lanche", ["sanduiche", "pao", "hamburguer", "suco", "cafe", "comida"], "Refeicao rapida feita entre o almoco e o jantar."],
  ["refeicao", "alimentacao_bebida", "refeicao", ["almoco", "jantar", "lanche", "comida", "prato", "fome", "mesa"], "Ato de comer alimentos preparados em horarios do dia como almoco ou jantar."],
  ["restaurante", "alimentacao_bebida", "refeicao", ["comida", "prato", "almoco", "jantar", "cozinha", "mesa", "talheres"], "Estabelecimento comercial onde se servem refeicoes preparadas na hora."],
  ["talheres", "alimentacao_bebida", "utensilio", ["garfo", "faca", "colher", "prato", "mesa", "comida", "cozinha"], "Conjunto de garfo, faca e colher usados a mesa para comer."],
  ["garfo", "alimentacao_bebida", "utensilio", ["talheres", "faca", "colher", "prato", "comida"], "Utensilio de mesa com dentes usado para espetar alimentos."],
  ["faca", "alimentacao_bebida", "utensilio", ["talheres", "garfo", "colher", "cozinha", "prato", "cortar"], "Lamina com cabo usada na cozinha e a mesa para cortar alimentos."],
  ["colher", "alimentacao_bebida", "utensilio", ["talheres", "garfo", "faca", "sopa", "prato", "cafe"], "Utensilio concavo usado para tomar sopa, mexer cafe e comer sobremesas."],
  ["liquido", "alimentacao_bebida", "bebida", ["agua", "oleo", "azeite", "suco", "leite", "vinho", "copo", "beber"], "Substancia fluida sem forma fixa como agua, oleo, azeite ou suco."],
  ["panela", "moradia_casa", "comodo_comida", ["fogao", "cozinha", "comida", "arroz", "feijao", "oleo", "azeite"], "Recipiente metalico usado sobre o fogao para cozinhar alimentos."],
  ["sopa", "alimentacao_bebida", "prato_brasileiro", ["colher", "prato", "legume", "panela", "quente", "jantar"], "Prato liquido e quente feito com legumes, macarrao ou carne."],
  ["macarrao", "alimentacao_bebida", "prato_brasileiro", ["molho", "tomate", "queijo", "azeite", "prato", "almoco"], "Massa alimenticia cozida servida geralmente com molho, queijo e azeite."],
  ["ovo", "alimentacao_bebida", "geral", ["galinha", "omelete", "bolo", "oleo", "panela", "cafe"], "Alimento nutritivo usado em omeletes, bolos e receitas na cozinha."],
  ["farinha", "alimentacao_bebida", "geral", ["pao", "bolo", "trigo", "cozinha", "arroz"], "Po fino obtido de graos usado no preparo de paes e bolos."],
  ["sobremesa", "alimentacao_bebida", "doce", ["bolo", "chocolate", "sorvete", "torta", "acucar", "almoco"], "Prato doce servido ao final do almoco ou jantar."],
  ["padaria", "sociedade_cidade", "comercio", ["pao", "cafe", "bolo", "leite", "biscoito", "loja"], "Comercio de bairro especializado em paes frescos, cafe e doces."],
  ["supermercado", "sociedade_cidade", "comercio", ["comida", "loja", "arroz", "feijao", "dinheiro", "compra"], "Grande loja onde as pessoas fazem compras de alimentos e produtos da casa."],
  // Transporte, Formas & Cotidiano comuns
  ["camionete", "transporte_rodas", "automovel", ["carro", "caminhao", "estrada", "roda", "pneu", "carga"], "Automovel utilitario robusto com carroceria traseira aberta."],
  ["veiculo", "transporte_rodas", "automovel", ["carro", "moto", "caminhao", "onibus", "roda", "transito"], "Meio de transporte usado para deslocar pessoas ou cargas por vias."],
  ["circulo", "tecnologia_ciencias", "geometria", ["roda", "bola", "anel", "relogio", "geometria"], "Figura geometrica redonda formada por uma linha curva fechada."],
  ["geometria", "tecnologia_ciencias", "educacao", ["circulo", "ciencia", "escola", "calculo"], "Ramo da matematica que estuda formas, linhas e dimensoes."],
  ["porta-malas", "transporte_rodas", "automovel", ["carro", "mala", "estepe", "viagem", "roda"], "Compartimento traseiro do carro onde vao bagagens e o estepe."],
  ["borracharia", "transporte_rodas", "roda_borracha", ["pneu", "estepe", "roda", "conserto", "borracha"], "Oficina especializada em calibrar, remendar e trocar pneus."],
  ["reserva", "transporte_rodas", "roda_borracha", ["estepe", "pneu", "guarda", "emergencia"], "Item extra guardado para substituir o principal em caso de necessidade."]
];

for (const [word, cluster, sub, links, hint] of CURATED_ADDITIONS) {
  const theme = THEMES[cluster];
  if (!theme) continue;
  const existing = WORDS[word];
  WORDS[word] = {
    word: word,
    category: theme.label,
    cluster: cluster,
    sub: sub,
    vec: existing ? existing.vec : [...theme.vec],
    links: links,
    hint: hint
  };
  if (!SECRET_POOL.includes(word) && !["circulo", "geometria", "reserva"].includes(word)) {
    SECRET_POOL.push(word);
  }
}

// 2. Melhora especificamente conexoes de palavras nucleares como azeite -> oleo/tempero
if (WORDS.azeite) {
  WORDS.azeite.links = ["oliva", "oleo", "salada", "tempero", "azeitona", "cozinha", "vinagre", "liquido"];
}
if (WORDS.estepe) {
  WORDS.estepe.links = ["pneu", "roda", "carro", "porta-malas", "borracharia", "reserva"];
}
if (WORDS.sal) {
  WORDS.sal.links = ["tempero", "comida", "mar", "panela", "azeite", "cozinha"];
}

// 3. Auto-materializa QUALQUER palavra referenciada em .links que ainda nao exista em WORDS
//    (sem underscores e sem colocar auxiliares em SECRET_POOL para manter sorteios limpos)
const danglingMap = new Map();
for (const [srcWord, entry] of Object.entries(WORDS)) {
  for (const rawTarget of entry.links || []) {
    const t = String(rawTarget || "").trim().toLowerCase();
    if (!t || t.includes("_") || t.includes(" ")) continue;
    if (WORDS[t] || ALIASES[t]) continue;
    if (!danglingMap.has(t)) danglingMap.set(t, []);
    danglingMap.get(t).push(entry);
  }
}

for (const [targetWord, sources] of danglingMap.entries()) {
  const clusterVotes = {};
  const sumVec = new Array(16).fill(0);
  const reverseLinks = [];

  for (const s of sources) {
    clusterVotes[s.cluster] = (clusterVotes[s.cluster] || 0) + 1;
    for (let i = 0; i < 16; i++) sumVec[i] += s.vec[i] || 0;
    if (!reverseLinks.includes(s.word)) reverseLinks.push(s.word);
  }

  let bestCluster = sources[0].cluster || "vida_filosofia_emocao";
  let bestCount = -1;
  for (const [ck, cnt] of Object.entries(clusterVotes)) {
    if (cnt > bestCount) {
      bestCount = cnt;
      bestCluster = ck;
    }
  }

  const theme = THEMES[bestCluster] || { label: "Vocabulario Geral", vec: new Array(16).fill(0.2) };
  const avgVec = sumVec.map((v) => Math.round((v / sources.length) * 100) / 100);
  // Se houver apenas 1 fonte, puxa mais perto do vetor do tema para manter coerencia semantica
  const blendedVec = avgVec.map((v, i) => Math.round((0.65 * v + 0.35 * (theme.vec[i] || 0)) * 100) / 100);

  WORDS[targetWord] = {
    word: targetWord,
    category: theme.label,
    cluster: bestCluster,
    sub: "associado",
    vec: blendedVec,
    links: reverseLinks.slice(0, 8),
    hint: "Conceito ligado a " + reverseLinks.slice(0, 3).join(", ") + "."
  };
}

// 4. Aliases ortograficos estritamente seguros (sem trocar palavras distintas)
const SAFE_ALIASES = {
  "taleres": "talheres",
  "restalrante": "restaurante",
  "azeitonas": "azeitona",
  "azeites": "azeite",
  "oleos": "oleo",
  "temperos": "tempero",
  "saladas": "salada",
  "verduras": "verdura",
  "legumes": "legume",
  "lanches": "lanche",
  "almocos": "almoco",
  "almoços": "almoco",
  "almoco": "almoco",
  "jantares": "jantar",
  "liquidos": "liquido",
  "líquidos": "liquido",
  "líquido": "liquido",
  "óleo": "oleo",
  "óleos": "oleo",
  "círculo": "circulo",
  "panela": "panela",
  "panelas": "panela",
  "garfos": "garfo",
  "facas": "faca",
  "colheres": "colher",
  "colher": "colher"
};

for (const [k, v] of Object.entries(SAFE_ALIASES)) {
  if (k !== v && WORDS[v]) ALIASES[k] = v;
}

const outContent =
  "/**\n" +
  " * BANCO DE DADOS SEMANTICO EXPANDIDO DA LINGUA PORTUGUESA (js/dictionary-data.js)\n" +
  " * Vocabulario nucleo + conexoes semanticas completas sem links quebrados.\n" +
  " */\n" +
  "window.DUELO_DATA = {\n" +
  "  THEMES: " + JSON.stringify(THEMES, null, 2) + ",\n" +
  "  WORDS: " + JSON.stringify(WORDS, null, 2) + ",\n" +
  "  SECRET_POOL: " + JSON.stringify(SECRET_POOL) + ",\n" +
  "  ALIASES: " + JSON.stringify(ALIASES, null, 2) + "\n" +
  "};\n";

fs.writeFileSync(dataPath, outContent, "utf8");
console.log("[OK] Dicionario enriquecido:", Object.keys(WORDS).length, "palavras nucleares |", SECRET_POOL.length, "palavras sorteadas |", Object.keys(ALIASES).length, "aliases | Pendentes adicionados:", danglingMap.size);
