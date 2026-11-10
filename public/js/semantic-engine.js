/**
 * ============================================================================
 * MOTOR DE PROXIMIDADE SEMANTICA HIBRIDO (js/semantic-engine.js)
 * ============================================================================
 * - Base Semantica Local Expandida (375+ conceitos nucleares em 16 dimensoes).
 * - Lematizador de Plurais e Flexoes Verbais em Portugues (ex: dormi -> dormir).
 * - Consulta a APIs Publicas (Dicionario Aberto + Wikipedia PT REST) ANTES de
 *   tentar correcao ortografica, garantindo que palavras reais nunca sejam
 *   trocadas erroneamente (ex: "fala" nunca vira "sala").
 * - Suporte a Modo Treino Livre e Modo Palavra do Dia (Estilo Termo).
 */
window.DUELO = window.DUELO || {};

window.DUELO.Engine = (function () {
  const CACHE_KEY = "duelo_semantic_api_cache_v5";
  let apiCache = {};

  function getVectorDim() {
    const themes = window.DUELO_DATA && window.DUELO_DATA.THEMES;
    if (themes) {
      const keys = Object.keys(themes);
      for (let i = 0; i < keys.length; i++) {
        if (themes[keys[i]] && Array.isArray(themes[keys[i]].vec)) {
          return themes[keys[i]].vec.length;
        }
      }
    }
    return 24;
  }

  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      apiCache = JSON.parse(raw);
      const expectedDim = getVectorDim();
      if (window.DUELO_DATA && window.DUELO_DATA.WORDS) {
        Object.keys(apiCache).forEach(function (wKey) {
          const cached = apiCache[wKey] && apiCache[wKey].entry;
          if (!window.DUELO_DATA.WORDS[wKey] && cached && Array.isArray(cached.vec) && cached.vec.length === expectedDim) {
            window.DUELO_DATA.WORDS[wKey] = cached;
          }
        });
      }
    }
  } catch (e) {}

  function saveCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(apiCache));
    } catch (e) {}
  }

  function stripAccents(str) {
    return (str || "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9-\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanDisplayForm(originalStr, canonicalWord) {
    const cleanOrig = (originalStr || "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/[^\p{L}\p{N}-]/gu, "")
      .trim();
    if (cleanOrig && stripAccents(cleanOrig) === canonicalWord) {
      return cleanOrig.toUpperCase();
    }
    return canonicalWord.toUpperCase();
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    const alen = a.length;
    const blen = b.length;
    if (alen === 0) return blen;
    if (blen === 0) return alen;

    const matrix = [];
    for (let i = 0; i <= blen; i++) matrix[i] = [i];
    for (let j = 0; j <= alen; j++) matrix[0][j] = j;

    for (let i = 1; i <= blen; i++) {
      for (let j = 1; j <= alen; j++) {
        const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return matrix[blen][alen];
  }

  function phoneticKey(w) {
    return w
      .replace(/l$/g, "u")
      .replace(/z/g, "s")
      .replace(/ch/g, "x")
      .replace(/ss/g, "s")
      .replace(/c([ei])/g, "s$1")
      .replace(/([aeiou])i([aeiou])/g, "$1$2");
  }

  // Gera possiveis infinitivos de verbos conjugados em portugues (ex: dormi -> dormir, falei -> falar)
  function getVerbInfinitiveCandidates(word) {
    if (!word || word.length < 4) return [];
    const cands = [];
    const suffixes = [
      ["ando", "ar"], ["endo", "er"], ["indo", "ir"],
      ["ei", "ar"], ["ou", "ar"], ["aste", "ar"], ["amos", "ar"], ["aram", "ar"],
      ["eu", "er"], ["este", "er"], ["emos", "er"], ["eram", "er"],
      ["iu", "ir"], ["iste", "ir"], ["imos", "ir"], ["iram", "ir"],
      ["i", "ir"], ["i", "er"], ["a", "ar"], ["e", "er"], ["o", "ar"]
    ];
    for (let i = 0; i < suffixes.length; i++) {
      const suf = suffixes[i][0];
      const rep = suffixes[i][1];
      if (word.endsWith(suf) && word.length > suf.length + 1) {
        const cand = word.slice(0, word.length - suf.length) + rep;
        if (cands.indexOf(cand) === -1) cands.push(cand);
      }
    }
    return cands;
  }

  function resolveWord(rawInput, allowFuzzyFallback) {
    const cleaned = stripAccents(rawInput);
    if (!cleaned) return null;

    const wordsDb = window.DUELO_DATA.WORDS || {};
    const aliases = window.DUELO_DATA.ALIASES || {};

    // 1. Dicionario Local ou Aprendido via API (Match Exato)
    if (wordsDb[cleaned]) {
      return {
        original: rawInput.trim(),
        canonical: cleaned,
        correctedFrom: null,
        known: true,
        source: wordsDb[cleaned].fromApi ? "api" : "local",
        entry: wordsDb[cleaned]
      };
    }

    // 2. Tabela Explicita de Aliases / Correcoes Conhecidas (ex: pinel -> pneu)
    if (aliases[cleaned] && wordsDb[aliases[cleaned]]) {
      const target = aliases[cleaned];
      return {
        original: rawInput.trim(),
        canonical: target,
        correctedFrom: cleaned !== target ? rawInput.trim() : null,
        known: true,
        source: "alias",
        entry: wordsDb[target]
      };
    }

    // 3. Plurais Simples (ex: carros -> carro, falas -> fala)
    if (cleaned.endsWith("s") && cleaned.length > 3) {
      const singular = cleaned.slice(0, -1);
      if (wordsDb[singular]) {
        return {
          original: rawInput.trim(),
          canonical: singular,
          correctedFrom: rawInput.trim(),
          known: true,
          source: "plural",
          entry: wordsDb[singular]
        };
      }
    }

    // 4. Flexoes Verbais Simples (ex: dormi -> dormir, falei -> falar)
    const verbCands = getVerbInfinitiveCandidates(cleaned);
    for (let v = 0; v < verbCands.length; v++) {
      if (wordsDb[verbCands[v]]) {
        return {
          original: rawInput.trim(),
          canonical: verbCands[v],
          correctedFrom: rawInput.trim(),
          known: true,
          source: "verb",
          entry: wordsDb[verbCands[v]]
        };
      }
    }

    // 5. Fallback de Correcao Ortografica / Fonetica
    // SO executa quando allowFuzzyFallback === true (apos API confirmar que a palavra nao existe)
    if (allowFuzzyFallback) {
      const pKey = phoneticKey(cleaned);
      const allKeys = Object.keys(wordsDb);

      for (let i = 0; i < allKeys.length; i++) {
        const k = allKeys[i];
        if (phoneticKey(k) === pKey) {
          return {
            original: rawInput.trim(),
            canonical: k,
            correctedFrom: rawInput.trim(),
            known: true,
            source: "phonetic",
            entry: wordsDb[k]
          };
        }
      }

      if (cleaned.length >= 6) {
        let bestMatch = null;
        let bestDist = 99;
        for (let i = 0; i < allKeys.length; i++) {
          const k = allKeys[i];
          if (k.charAt(0) !== cleaned.charAt(0)) continue;
          if (Math.abs(k.length - cleaned.length) > 1) continue;
          const d = levenshtein(cleaned, k);
          if (d <= 1 && d < bestDist) {
            bestDist = d;
            bestMatch = k;
          }
        }
        if (bestMatch) {
          return {
            original: rawInput.trim(),
            canonical: bestMatch,
            correctedFrom: rawInput.trim(),
            known: true,
            source: "typo",
            entry: wordsDb[bestMatch]
          };
        }
      }
    }

    // 6. Inferencia Morfologica por Raiz
    const inferred = inferFromMorphemes(cleaned);
    return {
      original: rawInput.trim(),
      canonical: cleaned,
      correctedFrom: null,
      known: inferred.matched,
      source: inferred.matched ? "morpheme" : "unknown",
      entry: inferred.entry
    };
  }

  function inferFromMorphemes(word) {
    const themes = window.DUELO_DATA.THEMES || {};
    const vecDim = getVectorDim();
    const rules = [
      { roots: ["vida", "mort", "alma", "amor", "sent", "ment", "paz", "alegr", "trist", "sonh", "esperan", "saudad", "confianc", "memori", "filosof", "fal", "convers"], theme: "vida_filosofia_emocao" },
      { roots: ["carr", "autom", "veic", "pne", "rod", "motor", "estrad", "caminh", "mot", "biciclet", "onib", "avia", "barc", "navi", "trem"], theme: "transporte_rodas" },
      { roots: ["cas", "apart", "telh", "port", "janel", "chav", "quart", "cam", "sal", "sof", "banheir", "predi", "armari", "martel", "escad"], theme: "moradia_casa" },
      { roots: ["arvor", "florest", "flor", "rio", "mar", "prai", "montanh", "chuv", "nuvem", "vent", "pedr", "terr", "fazend"], theme: "natureza_clima" },
      { roots: ["cachorr", "gat", "caval", "vac", "boi", "lea", "lob", "passar", "peix", "bich", "anim", "dinossaur"], theme: "animais_fauna" },
      { roots: ["comid", "aliment", "pao", "caf", "leit", "queij", "arroz", "feija", "carn", "frang", "pizz", "bol", "chocolat", "frut", "almoc", "jant", "lanch", "refeic", "verdur", "legum", "salad", "oliv", "azeit", "temper", "talher", "restaurant", "manteig", "vinagr", "farinh", "culinari", "cozinheir", "frit"], theme: "alimentacao_bebida" },
      { roots: ["corp", "cabec", "rosto", "olh", "boc", "dent", "brac", "pern", "coraca", "saud", "medic", "hospital", "remedi", "dorm", "farmac"], theme: "corpo_saude" },
      { roots: ["livr", "escol", "cadern", "canet", "lapis", "bibliotec", "autor", "leitur", "estud", "profess", "alun", "revist", "jornal", "dicionari", "poes"], theme: "educacao_leitura" },
      { roots: ["comput", "celul", "intern", "teclad", "mous", "telas", "camer", "wifi", "bluet", "softwar", "aplicativ", "rob", "senh"], theme: "tecnologia_digital" },
      { roots: ["cienc", "energ", "eletric", "metal", "ferr", "plast", "geometr", "circul", "quimic", "fisic", "bater", "ima", "fog", "gel"], theme: "ciencia_energia" },
      { roots: ["futeb", "gol", "jog", "esport", "gamer", "consol", "xadrez", "corrid", "natac", "basquet", "volei", "raquet", "atlet", "academi", "estadi"], theme: "esportes_jogos" },
      { roots: ["viola", "music", "pian", "guitarr", "flaut", "film", "cinem", "teatr", "pintur", "muse", "fotograf", "danc", "fest", "cant"], theme: "musica_arte_lazer" },
      { roots: ["sapat", "camis", "calc", "roup", "vestid", "chapeu", "ocul"], theme: "vestuario_moda" },
      { roots: ["cidad", "dinheir", "trabalh", "ruas", "loja", "banc", "polici", "justic", "advog", "bombeir", "padari", "supermercad", "pont"], theme: "sociedade_cidade" },
      { roots: ["astronaut", "espac", "planet", "galaxi", "foguet", "telescop", "univers", "estrel", "lua", "asteroid"], theme: "espaco_universo" },
      { roots: ["temp", "relogi", "hor", "minut", "seman", "mes", "ano", "calendari", "invern", "vera"], theme: "tempo_espaco" }
    ];

    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      for (let j = 0; j < r.roots.length; j++) {
        if (word.indexOf(r.roots[j]) !== -1) {
          const tInfo = themes[r.theme] || { label: "Vocabulario Geral", vec: new Array(vecDim).fill(0.2) };
          return {
            matched: true,
            entry: {
              word: word,
              category: tInfo.label,
              cluster: r.theme,
              sub: "inferred",
              vec: tInfo.vec.slice(),
              links: [],
              hint: "Palavra relacionada ao campo de " + tInfo.label + "."
            }
          };
        }
      }
    }

    const vec = [];
    for (let d = 0; d < vecDim; d++) {
      const code = word.charCodeAt(d % word.length) || 97;
      vec.push(((code * (d + 5)) % 45) / 100 + 0.05);
    }

    return {
      matched: false,
      entry: {
        word: word,
        category: "Vocabulario Geral",
        cluster: "geral",
        sub: "geral",
        vec: vec,
        links: [],
        hint: "Termo da lingua portuguesa."
      }
    };
  }

  /**
   * Consulta APIs publicas (Dicionario Aberto + Wikipedia PT) antes de recorrer
   * a qualquer correcao de digitacao, preservando todas as palavras reais.
   */
  async function ensureWordEnrichedAsync(rawInput) {
    const resolved = resolveWord(rawInput, false);
    if (!resolved) return null;
    if (resolved.known && resolved.source !== "morpheme") return resolved;

    const clean = resolved.canonical;
    if (apiCache[clean] && apiCache[clean].entry) {
      window.DUELO_DATA.WORDS[clean] = apiCache[clean].entry;
      return resolveWord(clean, false);
    }

    // 1. Consulta nas APIs pela palavra exata
    let definitionText = await fetchDefinitionFromPublicApis(clean, rawInput);
    let targetCanonical = clean;

    // 2. Se nao achou direto (ex: flexao verbal), tenta os candidatos infinitivos na API
    if (!definitionText) {
      const verbCands = getVerbInfinitiveCandidates(clean);
      for (let i = 0; i < verbCands.length; i++) {
        const defCand = await fetchDefinitionFromPublicApis(verbCands[i], verbCands[i]);
        if (defCand) {
          definitionText = defCand;
          targetCanonical = verbCands[i];
          break;
        }
      }
    }

    // 3. Se a API NAO encontrou a palavra em nenhum lugar, agora sim tenta correcao de digitacao!
    if (!definitionText) {
      return resolveWord(rawInput, true);
    }

    const wordsDb = window.DUELO_DATA.WORDS || {};
    const aliases = window.DUELO_DATA.ALIASES || {};
    const tokens = stripAccents(definitionText).split(/\s+/);
    const vecDim = getVectorDim();
    const matchedKeywords = [];
    const sumVec = new Array(vecDim).fill(0);
    const themeVotes = {};

    const stemHints = {
      musical: "musica", musicais: "musica", melodia: "musica", som: "musica",
      espacial: "espaco", espaciais: "espaco", planeta: "planeta", estrela: "estrela",
      culinaria: "comida", culinario: "comida", alimento: "comida", alimentos: "comida",
      veiculo: "carro", veiculos: "carro", automovel: "carro", rodar: "roda",
      animal: "cachorro", animais: "cachorro", ave: "passaro", aves: "passaro",
      eletronico: "computador", digital: "computador", computador: "computador",
      literario: "livro", leitura: "livro", escolar: "escola", educacao: "escola",
      medico: "hospital", medicina: "hospital", saude: "saude", corpo: "corpo",
      esportivo: "esporte", esportiva: "esporte", futebol: "futebol",
      linguagem: "fala", comunicar: "fala", comunicacao: "fala", voz: "voz",
      bagagem: "mala", viajar: "viagem"
    };

    function addMatchedToken(tkKey) {
      if (!wordsDb[tkKey] || matchedKeywords.indexOf(tkKey) !== -1) return;
      matchedKeywords.push(tkKey);
      const tkEntry = wordsDb[tkKey];
      for (let d = 0; d < vecDim; d++) {
        sumVec[d] += tkEntry.vec[d] || 0;
      }
      themeVotes[tkEntry.cluster] = (themeVotes[tkEntry.cluster] || 0) + 1;
    }

    for (let i = 0; i < tokens.length; i++) {
      const tk = tokens[i];
      if (tk.length < 3 || tk === clean) continue;
      if (wordsDb[tk]) {
        addMatchedToken(tk);
      } else if (aliases[tk] && wordsDb[aliases[tk]]) {
        addMatchedToken(aliases[tk]);
      } else if (tk.endsWith("s") && wordsDb[tk.slice(0, -1)]) {
        addMatchedToken(tk.slice(0, -1));
      } else if (stemHints[tk] && wordsDb[stemHints[tk]]) {
        addMatchedToken(stemHints[tk]);
      }
    }

    if (matchedKeywords.length > 0) {
      const avgVec = sumVec.map(function (val) {
        return Math.round((val / matchedKeywords.length) * 100) / 100;
      });

      let bestCluster = "geral";
      let bestVotes = 0;
      Object.keys(themeVotes).forEach(function (ck) {
        if (themeVotes[ck] > bestVotes) {
          bestVotes = themeVotes[ck];
          bestCluster = ck;
        }
      });

      const primaryMatch = wordsDb[matchedKeywords[0]];
      const themeMeta = (window.DUELO_DATA.THEMES && window.DUELO_DATA.THEMES[bestCluster]) || { label: "Dicionario Online" };
      const learnedEntry = {
        word: clean,
        category: themeMeta.label,
        cluster: bestCluster,
        sub: (primaryMatch && primaryMatch.sub) || "api",
        vec: avgVec,
        links: matchedKeywords.slice(0, 12),
        hint: definitionText.slice(0, 180),
        fromApi: true
      };

      window.DUELO_DATA.WORDS[clean] = learnedEntry;
      apiCache[clean] = { definition: definitionText.slice(0, 220), entry: learnedEntry };
      saveCache();

      return {
        original: rawInput.trim(),
        canonical: clean,
        correctedFrom: targetCanonical !== clean ? rawInput.trim() : null,
        known: true,
        source: "api",
        entry: learnedEntry
      };
    }

    return resolved;
  }

  async function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, timeoutMs || 2500);
    try {
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      return resp;
    } catch (e) {
      clearTimeout(timer);
      return null;
    }
  }

  function isPopCultureNoise(text) {
    const lower = (text || "").toLowerCase();
    return /\b(can[çc][ãa]o|m[úu]sica de|singles?|álbum|[áa]lbum|ep de|cantor(?:a|es)?|banda |filme |s[ée]rie de televis[ãa]o|futebolista|jogador(?:a)? de|munic[íi]pio (?:brasileiro|espanhol|portugu[eê]s)|comuna |desambigua[çc][ãa]o|sobrenome|prenome|localidade)\b/.test(lower);
  }

  async function fetchDefinitionFromPublicApis(cleanWord, originalWord) {
    const queryWord = (originalWord || cleanWord).trim().toLowerCase();
    const [dicResp, dicCleanResp, wikiResp] = await Promise.all([
      fetchWithTimeout("https://api.dicionario-aberto.net/word/" + encodeURIComponent(queryWord), 2400),
      queryWord !== cleanWord
        ? fetchWithTimeout("https://api.dicionario-aberto.net/word/" + encodeURIComponent(cleanWord), 2400)
        : Promise.resolve(null),
      fetchWithTimeout("https://pt.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(queryWord), 2400)
    ]);

    const parts = [];

    // 1. Prioridade maxima: Dicionario Aberto (definicao linguistica oficial da palavra)
    const dicCandidates = [dicResp, dicCleanResp];
    for (let i = 0; i < dicCandidates.length; i++) {
      const resp = dicCandidates[i];
      if (resp && resp.ok) {
        try {
          const data = await resp.json();
          if (Array.isArray(data) && data.length > 0 && data[0].xml) {
            const cleanDef = data[0].xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
            if (cleanDef) {
              parts.push(cleanDef);
              break;
            }
          }
        } catch (e) {}
      }
    }

    // 2. Complemento enciclopedico via Wikipedia PT (somente se NAO for artigo de musica/filme/celebridade)
    if (wikiResp && wikiResp.ok) {
      try {
        const wData = await wikiResp.json();
        if (wData && wData.extract && wData.type !== "disambiguation" && !isPopCultureNoise(wData.extract)) {
          parts.push(wData.extract);
        }
      } catch (e) {}
    }

    return parts.length > 0 ? parts.join(" ") : null;
  }

  function cosineSimilarity(v1, v2) {
    let dot = 0;
    let mag1 = 0;
    let mag2 = 0;
    const len = Math.min(v1.length, v2.length);
    for (let i = 0; i < len; i++) {
      dot += v1[i] * v2[i];
      mag1 += v1[i] * v1[i];
      mag2 += v2[i] * v2[i];
    }
    if (mag1 === 0 || mag2 === 0) return 0;
    return dot / (Math.sqrt(mag1) * Math.sqrt(mag2));
  }

  function deterministicJitter(wordA, wordB) {
    const combined = wordA + ":" + wordB;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      hash = (hash * 31 + combined.charCodeAt(i)) % 1000;
    }
    return (hash / 1000) * 1.5;
  }

  function calculateProximity(guessRaw, secretWordCanonical, allowFuzzyFallback) {
    const resolved = resolveWord(guessRaw, !!allowFuzzyFallback);
    const secretResolved = resolveWord(secretWordCanonical, false);
    if (!resolved || !secretResolved) return null;

    const w1 = resolved.canonical;
    const w2 = secretResolved.canonical;
    const e1 = resolved.entry;
    const e2 = secretResolved.entry;

    if (w1 === w2) {
      return {
        word: w1,
        displayWord: cleanDisplayForm(resolved.original, w1),
        originalInput: resolved.original,
        correctedFrom: resolved.correctedFrom,
        category: e1.category,
        source: resolved.source,
        score: 100.0,
        isExact: true,
        tier: "exact",
        tierLabel: "Palavra Exata!",
        explanation: "Você descobriu a palavra secreta exata!"
      };
    }

    const cos = cosineSimilarity(e1.vec, e2.vec);
    let score = cos * 42.0;

    if (e1.cluster === e2.cluster && e1.cluster !== "geral") {
      score += 13.0;
    }

    if (e1.sub === e2.sub && e1.sub !== "geral" && e1.sub !== "inferred") {
      score += 13.0;
    }

    const links1 = e1.links || [];
    const links2 = e2.links || [];

    const idxInSecret = links2.indexOf(w1);
    const idxInGuess = links1.indexOf(w2);

    if (idxInSecret !== -1 || idxInGuess !== -1) {
      const bestRank = idxInSecret !== -1 && idxInGuess !== -1
        ? Math.min(idxInSecret, idxInGuess)
        : (idxInSecret !== -1 ? idxInSecret : idxInGuess);
      const rankBonus = Math.max(0, 7.5 - bestRank * 1.35);
      const mutualBonus = idxInSecret !== -1 && idxInGuess !== -1 ? 3.5 : 0;
      score += 10.5 + rankBonus + mutualBonus;
    }

    let sharedCount = 0;
    const sharedWords = [];
    for (let i = 0; i < links1.length; i++) {
      if (links2.indexOf(links1[i]) !== -1) {
        sharedCount++;
        sharedWords.push(links1[i]);
      }
    }
    if (sharedCount > 0) {
      score += Math.min(7.5, sharedCount * 2.0);
    }

    if (w1.length >= 4 && w2.length >= 4 && w1.slice(0, 4) === w2.slice(0, 4)) {
      score += 2.0;
    }

    // Conexao direta explicita entre clusters diferentes (ex: azeite <-> cozinha, roda <-> circulo) mantem piso semantico forte
    if ((idxInSecret !== -1 || idxInGuess !== -1) && e1.cluster !== e2.cluster) {
      const crossRank = idxInSecret !== -1 ? idxInSecret : idxInGuess;
      const directFloor = 58.0 + Math.max(0, 6.0 - crossRank * 1.2) + (idxInSecret !== -1 && idxInGuess !== -1 ? 3.0 : 0);
      if (score < directFloor) score = directFloor;
    }

    score += deterministicJitter(w1, w2);

    const clamped = Math.max(4.5, Math.min(98.8, Math.round(score * 10) / 10));

    let tier = "cold";
    let tierLabel = "Frio · Distante";
    if (clamped >= 82) {
      tier = "burning";
      tierLabel = "Fervendo · Muito próxima";
    } else if (clamped >= 62) {
      tier = "hot";
      tierLabel = "Quente · Mesmo contexto";
    } else if (clamped >= 38) {
      tier = "warm";
      tierLabel = "Morno · Relação indireta";
    }

    let explanation = "Área: " + e1.category;
    if (resolved.source === "api") {
      explanation = "Dicionário online (" + e1.category + ")";
    } else if (idxInSecret !== -1 || idxInGuess !== -1) {
      explanation = "Conexão direta com a palavra secreta.";
    } else if (sharedWords.length > 0) {
      explanation = "Ligada a: " + sharedWords.slice(0, 2).join(", ").toUpperCase();
    } else if (e1.cluster === e2.cluster) {
      explanation = "Mesmo tema (" + e1.category + ").";
    }

    return {
      word: w1,
      displayWord: cleanDisplayForm(resolved.original, w1),
      originalInput: resolved.original,
      correctedFrom: resolved.correctedFrom,
      category: e1.category,
      source: resolved.source,
      score: clamped,
      isExact: false,
      tier: tier,
      tierLabel: tierLabel,
      explanation: explanation
    };
  }

  async function fetchOnlineDefinition(word) {
    const clean = stripAccents(word);
    if (!clean) return null;
    if (apiCache[clean] && apiCache[clean].definition) return apiCache[clean];
    const def = await fetchDefinitionFromPublicApis(clean, word);
    if (def) {
      apiCache[clean] = Object.assign(apiCache[clean] || {}, { definition: def.slice(0, 220) });
      saveCache();
      return apiCache[clean];
    }
    return null;
  }

  function getDailySecretWord() {
    const pool = window.DUELO_DATA.SECRET_POOL || ["carro", "casa", "arvore", "pao", "computador", "futebol", "vida"];
    const now = new Date();
    const key = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    const idx = Math.abs(key * 2654435761) % pool.length;
    return pool[idx] || "carro";
  }

  function getBridgeHint(secretWordCanonical, currentChampionScore, excludeWords) {
    const wordsDb = window.DUELO_DATA.WORDS;
    const excluded = {};
    (Array.isArray(excludeWords) ? excludeWords : []).forEach(function (w) {
      const c = stripAccents(w);
      if (c) excluded[c] = true;
    });

    const candidates = Object.keys(wordsDb)
      .filter(function (w) { return w !== secretWordCanonical && !excluded[w]; })
      .map(function (w) { return calculateProximity(w, secretWordCanonical, false); })
      .filter(function (res) { return res && res.score > currentChampionScore + 1.2 && res.score < 100; })
      .sort(function (a, b) { return a.score - b.score; });

    if (candidates.length > 0) {
      const stepIdx = Math.min(candidates.length - 1, Math.floor(candidates.length * 0.45));
      return candidates[stepIdx];
    }
    return null;
  }

  function escapeHtmlText(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getHintBundle(secretWordCanonical, currentChampionScore, hintLevel, excludeWords) {
    const wordsDb = window.DUELO_DATA.WORDS || {};
    const entry = wordsDb[secretWordCanonical] || {
      category: "Cotidiano",
      hint: "Palavra da lingua portuguesa.",
      links: []
    };
    const level = Math.max(1, Math.min(3, Number(hintLevel) || 1));
    const tier1 = 'DICA 1 (Tema & Tamanho): Categoria "' + escapeHtmlText(entry.category) + '" | Possui ' + secretWordCanonical.length + ' letras.';

    let tier2 = null;
    if (level >= 2) {
      const bridge = getBridgeHint(secretWordCanonical, currentChampionScore, excludeWords);
      if (bridge) {
        tier2 = 'DICA 2 (Palavra-Ponte Mais Próxima): Experimente testar <strong>' + escapeHtmlText(bridge.displayWord) + '</strong> (' + bridge.score.toFixed(1) + '%).';
      } else {
        const excluded = {};
        (Array.isArray(excludeWords) ? excludeWords : []).forEach(function (w) {
          const c = stripAccents(w);
          if (c) excluded[c] = true;
        });
        const links = Array.isArray(entry.links) ? entry.links : [];
        const lateral = links.find(function (lnk) {
          const c = stripAccents(lnk);
          return c && c !== secretWordCanonical && !excluded[c];
        });
        if (lateral) {
          tier2 = 'DICA 2 (Conexão Lateral): Além do que você já testou, ela se liga diretamente a <strong>' + escapeHtmlText(lateral.toUpperCase()) + '</strong>.';
        } else {
          const lastChar = secretWordCanonical.charAt(secretWordCanonical.length - 1).toUpperCase();
          tier2 = 'DICA 2 (Estrutura da Palavra): Termina com a letra <strong>"' + escapeHtmlText(lastChar) + '"</strong> e tem ' + secretWordCanonical.length + ' letras.';
        }
      }
    }

    let tier3 = null;
    if (level >= 3) {
      tier3 = 'DICA 3 (Definição & Inicial): Começa com a letra <strong>"' + escapeHtmlText(secretWordCanonical.charAt(0).toUpperCase()) + '"</strong> — ' + escapeHtmlText(entry.hint);
    }

    return {
      tier1: tier1,
      tier2: tier2,
      tier3: tier3
    };
  }

  async function evaluateWordAsync(rawInput, secretWordCanonical) {
    const res = await ensureWordEnrichedAsync(rawInput);
    if (!res) return null;
    const usedFuzzy = res.source === "phonetic" || res.source === "typo";
    return calculateProximity(rawInput, secretWordCanonical, usedFuzzy);
  }

  return {
    resolveWord: resolveWord,
    ensureWordEnrichedAsync: ensureWordEnrichedAsync,
    evaluateWordAsync: evaluateWordAsync,
    calculateProximity: calculateProximity,
    fetchOnlineDefinition: fetchOnlineDefinition,
    getDailySecretWord: getDailySecretWord,
    getBridgeHint: getBridgeHint,
    getHintBundle: getHintBundle
  };
})();
