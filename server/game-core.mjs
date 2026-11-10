/**
 * Motor autoritativo server-side para impedir descoberta da palavra secreta via F12 / DevTools.
 * As respostas são escolhidas e avaliadas exclusivamente no servidor usando tokens AES-256-GCM.
 */
import crypto from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

if (typeof globalThis.window === "undefined") {
  globalThis.window = globalThis;
}

require("../public/js/dictionary-data.js");
require("../public/js/semantic-engine.js");

const MAX_TOKEN_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function getData() {
  return globalThis.DUELO_DATA || { THEMES: {}, WORDS: {}, ALIASES: {}, SECRET_POOL: [] };
}

function getEngine() {
  return globalThis.DUELO && globalThis.DUELO.Engine;
}

function cleanText(val, maxLen) {
  if (typeof val !== "string") return "";
  return val.replace(/[\u200B-\u200D\uFEFF]/g, "").trim().slice(0, maxLen);
}

function getMasterKey() {
  const seed =
    process.env.DUELO_SECRET_KEY ||
    process.env.SESSION_SECRET ||
    process.env.VERCEL_PROJECT_ID ||
    "duelo-semantico-local-dev-key";
  return crypto.createHash("sha256").update("duelo:v1:" + seed).digest();
}

function sealToken(payload) {
  const iv = crypto.randomBytes(12);
  const key = getMasterKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url")
  ].join(".");
}

function openToken(tokenStr) {
  if (typeof tokenStr !== "string" || tokenStr.length < 20 || tokenStr.length > 4096) {
    return null;
  }
  const parts = tokenStr.split(".");
  if (parts.length !== 3) return null;

  try {
    const iv = Buffer.from(parts[0], "base64url");
    const tag = Buffer.from(parts[1], "base64url");
    const encrypted = Buffer.from(parts[2], "base64url");
    if (iv.length !== 12 || tag.length !== 16 || encrypted.length === 0) return null;

    const key = getMasterKey();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
    const parsed = JSON.parse(decrypted);
    if (!parsed || parsed.v !== 1 || typeof parsed.secretWord !== "string" || !parsed.secretWord) {
      return null;
    }
    if (typeof parsed.issuedAt !== "number" || Date.now() - parsed.issuedAt > MAX_TOKEN_AGE_MS) {
      return null;
    }
    return parsed;
  } catch (err) {
    return null;
  }
}

export function getSaoPauloDateInfo(nowDate) {
  const now = nowDate instanceof Date ? nowDate : new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const partMap = {};
  for (const p of fmt.formatToParts(now)) {
    if (p.type !== "literal") partMap[p.type] = p.value;
  }
  const hour = Number(partMap.hour) % 24;
  const minute = Number(partMap.minute);
  const second = Number(partMap.second);
  const dateKey = partMap.year + "-" + partMap.month + "-" + partMap.day;
  const secUntilMidnight = Math.max(1, 86400 - (hour * 3600 + minute * 60 + second));
  return {
    dateKey: dateKey,
    nextDailyAtMs: now.getTime() + secUntilMidnight * 1000
  };
}

function pickHmacDailySecret(dateKey) {
  const data = getData();
  const pool = data.SECRET_POOL && data.SECRET_POOL.length > 0 ? data.SECRET_POOL : ["carro", "casa", "agua", "vida"];
  const hmac = crypto.createHmac("sha256", getMasterKey()).update("daily-word:" + dateKey).digest();
  const idx = hmac.readUInt32BE(0) % pool.length;
  return pool[idx] || "carro";
}

function pickRandomSecret(categoryFilter, excludeWords) {
  const data = getData();
  const pool = data.SECRET_POOL && data.SECRET_POOL.length > 0 ? data.SECRET_POOL : ["carro"];
  const wordsDb = data.WORDS || {};
  const excluded = new Set(Array.isArray(excludeWords) ? excludeWords.slice(0, 40) : []);

  let byCat = pool.filter(function (w) {
    if (!categoryFilter || categoryFilter === "all") return true;
    return wordsDb[w] && wordsDb[w].cluster === categoryFilter;
  });
  if (byCat.length === 0) byCat = pool.slice();

  const fresh = byCat.filter(function (w) { return !excluded.has(w); });
  const candidates = fresh.length > 0 ? fresh : byCat;
  const idx = crypto.randomInt(0, candidates.length);
  return candidates[idx] || "carro";
}

function withCustomEntrySync(customEntry, fn) {
  if (!customEntry || !customEntry.word) return fn();
  const data = getData();
  const wordsDb = data.WORDS || {};
  const hadKey = Object.prototype.hasOwnProperty.call(wordsDb, customEntry.word);
  const prevVal = hadKey ? wordsDb[customEntry.word] : undefined;
  wordsDb[customEntry.word] = customEntry;
  try {
    return fn();
  } finally {
    if (hadKey) wordsDb[customEntry.word] = prevVal;
    else delete wordsDb[customEntry.word];
  }
}

function buildSecretMeta(secretWord, customEntry) {
  const data = getData();
  const wordsDb = data.WORDS || {};
  const entry = (customEntry && customEntry.word === secretWord ? customEntry : null) ||
    wordsDb[secretWord] || {
      category: "Cotidiano",
      hint: "Palavra da lingua portuguesa."
    };
  return {
    word: secretWord,
    displayWord: secretWord.toUpperCase(),
    category: entry.category || "Cotidiano",
    hint: entry.hint || ""
  };
}

function handleStart(body) {
  const mode = ["daily", "practice", "duel", "custom"].includes(body.mode) ? body.mode : "practice";
  const categoryFilter = cleanText(body.categoryFilter, 64) || "all";
  const excludeWords = Array.isArray(body.excludeWords)
    ? body.excludeWords.map((w) => cleanText(w, 64)).filter(Boolean)
    : [];
  const dailyInfo = getSaoPauloDateInfo();
  const Engine = getEngine();
  const data = getData();

  let secretWord = "";
  let customEntry = null;

  if (mode === "daily") {
    secretWord = pickHmacDailySecret(dailyInfo.dateKey);
  } else if (mode === "custom") {
    const cs = body.customSecret || {};
    const rawWord = cleanText(cs.word, 64).toLowerCase();
    if (!rawWord) {
      return { status: 400, payload: { ok: false, error: "Palavra secreta invalida." } };
    }
    const resolved = Engine.resolveWord(rawWord, false);
    const cleanWord = resolved ? resolved.canonical : rawWord;
    const clusterKey = cleanText(cs.cluster, 64) || "transporte_rodas";
    const sampleKey = Object.keys(data.WORDS).find((k) => data.WORDS[k].cluster === clusterKey) || "carro";
    const sample = data.WORDS[sampleKey] || { category: "Personalizada", vec: new Array(16).fill(0.2), links: [] };
    const hintText = cleanText(cs.hint, 180) || ("Palavra secreta personalizada na categoria " + sample.category + ".");
    const rawLinks = cleanText(cs.links, 240);
    const customLinks = rawLinks
      ? rawLinks.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 12)
      : (sample.links || []).slice(0, 6);

    secretWord = cleanWord;
    customEntry = {
      word: cleanWord,
      category: sample.category,
      cluster: clusterKey,
      sub: cleanWord,
      vec: (sample.vec || []).slice(),
      links: customLinks,
      hint: hintText
    };
  } else {
    secretWord = pickRandomSecret(mode === "duel" ? "all" : categoryFilter, excludeWords);
  }

  const resolvedSecret = withCustomEntrySync(customEntry, () => Engine.resolveWord(secretWord, false));
  const canonicalSecret = resolvedSecret ? resolvedSecret.canonical : secretWord;

  const matchToken = sealToken({
    v: 1,
    mode: mode,
    secretWord: canonicalSecret,
    dateKey: dailyInfo.dateKey,
    customEntry: customEntry,
    issuedAt: Date.now()
  });

  return {
    status: 200,
    payload: {
      ok: true,
      mode: mode,
      matchToken: matchToken,
      dateKey: dailyInfo.dateKey,
      nextDailyAtMs: dailyInfo.nextDailyAtMs
    }
  };
}

async function handleEvaluate(body) {
  const token = openToken(body.matchToken);
  if (!token) {
    return { status: 400, payload: { ok: false, error: "Sessao da partida invalida ou expirada." } };
  }

  const rawWords = Array.isArray(body.words) ? body.words : [];
  if (rawWords.length === 0 || rawWords.length > 2) {
    return { status: 400, payload: { ok: false, error: "Informe 1 ou 2 palavras para avaliar." } };
  }

  const Engine = getEngine();
  const cleanWords = rawWords.map((w) => cleanText(w, 64));

  // Primeiro enriquece assincronamente via dicionario/Wikipedia sem tocar em secretWord
  const enrichments = await Promise.all(
    cleanWords.map(async (w) => {
      if (!w) return null;
      return await Engine.ensureWordEnrichedAsync(w);
    })
  );

  // Avaliacao sincrona e isolada (garante concorrencia segura caso seja palavra customizada)
  const results = withCustomEntrySync(token.customEntry, () => {
    return cleanWords.map((w, idx) => {
      const res = enrichments[idx];
      if (!res) return null;
      const usedFuzzy = res.source === "phonetic" || res.source === "typo";
      return Engine.calculateProximity(w, token.secretWord, usedFuzzy);
    });
  });

  const anyExact = results.some((r) => r && r.isExact);
  const revealedMeta = anyExact ? buildSecretMeta(token.secretWord, token.customEntry) : null;

  return {
    status: 200,
    payload: {
      ok: true,
      results: results,
      revealedMeta: revealedMeta
    }
  };
}

function handleHint(body) {
  const token = openToken(body.matchToken);
  if (!token) {
    return { status: 400, payload: { ok: false, error: "Sessao da partida invalida ou expirada." } };
  }

  const Engine = getEngine();
  const hintLevel = Math.max(1, Math.min(3, Number(body.hintLevel) || 1));
  const champScore = Number.isFinite(Number(body.champScore)) ? Number(body.champScore) : 15;
  const excludeWords = Array.isArray(body.excludeWords)
    ? body.excludeWords.map((w) => cleanText(w, 64)).filter(Boolean).slice(0, 120)
    : [];

  return withCustomEntrySync(token.customEntry, () => {
    const bundle = Engine.getHintBundle(token.secretWord, champScore, hintLevel, excludeWords);
    return {
      status: 200,
      payload: {
        ok: true,
        tier1: bundle.tier1,
        tier2: bundle.tier2,
        tier3: bundle.tier3
      }
    };
  });
}

function handleReveal(body) {
  const token = openToken(body.matchToken);
  if (!token) {
    return { status: 400, payload: { ok: false, error: "Sessao da partida invalida ou expirada." } };
  }

  const Engine = getEngine();
  return withCustomEntrySync(token.customEntry, () => {
    const evalExact = Engine.calculateProximity(token.secretWord, token.secretWord, false);
    const revealedMeta = buildSecretMeta(token.secretWord, token.customEntry);
    return {
      status: 200,
      payload: {
        ok: true,
        evalExact: evalExact,
        revealedMeta: revealedMeta
      }
    };
  });
}

function handleBotPick(body) {
  const token = openToken(body.matchToken);
  if (!token || token.mode !== "duel") {
    return { status: 400, payload: { ok: false, error: "Sessao de duelo invalida ou expirada." } };
  }

  const data = getData();
  const Engine = getEngine();
  const pool = data.SECRET_POOL || [];
  const used = new Set(Array.isArray(body.usedWords) ? body.usedWords.slice(0, 200).map((w) => cleanText(w, 64)) : []);
  const pending = cleanText(body.myPendingWord, 64);
  if (pending) {
    const r = Engine.resolveWord(pending, false);
    if (r && r.canonical) used.add(r.canonical);
  }

  const available = pool.filter((w) => !used.has(w));
  if (available.length === 0) {
    return { status: 200, payload: { ok: true, botWord: "tempo" } };
  }

  const round = Math.max(1, Number(body.round) || 1);
  const champScore = Number.isFinite(Number(body.champScore)) ? Number(body.champScore) : 15;

  const scored = available
    .map((w) => ({
      word: w,
      score: Engine.calculateProximity(w, token.secretWord, false).score
    }))
    .sort((a, b) => a.score - b.score);

  let chosen = "tempo";
  if (round === 1) {
    const maxIdx = Math.max(1, Math.min(scored.length, Math.floor(scored.length * 0.7)));
    chosen = scored[crypto.randomInt(0, maxIdx)].word;
  } else {
    const nonExact = scored.filter((item) => !(round < 5 && item.score >= 100));
    const aboveChamp = nonExact.filter((item) => item.score > champScore && item.score <= champScore + 28);

    if (aboveChamp.length > 0 && crypto.randomInt(0, 100) < 72) {
      chosen = aboveChamp[crypto.randomInt(0, aboveChamp.length)].word;
    } else {
      const startIdx = Math.floor(nonExact.length * 0.35);
      const midPool = nonExact.slice(startIdx);
      const sourcePool = midPool.length > 0 ? midPool : scored;
      chosen = sourcePool[crypto.randomInt(0, sourcePool.length)].word;
    }
  }

  return {
    status: 200,
    payload: {
      ok: true,
      botWord: chosen
    }
  };
}

export async function dispatchGameAction(body) {
  if (!body || typeof body !== "object") {
    return { status: 400, payload: { ok: false, error: "Requisicao invalida." } };
  }

  const action = cleanText(body.action, 32);
  if (action === "ping") {
    const dailyInfo = getSaoPauloDateInfo();
    return {
      status: 200,
      payload: {
        ok: true,
        backend: "vercel",
        dateKey: dailyInfo.dateKey,
        nextDailyAtMs: dailyInfo.nextDailyAtMs
      }
    };
  }
  if (action === "start") return handleStart(body);
  if (action === "evaluate") return await handleEvaluate(body);
  if (action === "hint") return handleHint(body);
  if (action === "reveal") return handleReveal(body);
  if (action === "bot_pick") return handleBotPick(body);

  return { status: 400, payload: { ok: false, error: "Acao desconhecida." } };
}

