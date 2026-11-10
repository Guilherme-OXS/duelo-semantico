/**
 * ============================================================================
 * CONTROLADOR PRINCIPAL DO JOGO "DUELO SEMANTICO: MAIS PROXIMO" (js/app.js)
 * ============================================================================
 * Regra Oficial:
 * - Rodada 1: O jogador escreve 2 palavras da lingua portuguesa (ex: "casa" e "carro").
 *   O programa analisa e escolhe qual esta mais proxima da Palavra Secreta.
 * - Rodadas 2+: A palavra vencedora permanece automaticamente como "Mais Proxima Atual"
 *   a esquerda. O jogador digita 1 nova palavra a direita ate chegar a 100% (Palavra Secreta).
 */
window.DUELO = window.DUELO || {};

(function () {
  const STORAGE_KEY = "duelo_semantico_stats_v1";
  const RECENT_SECRETS_KEY = "duelo_semantico_recent_secrets_v1";
  const DAILY_COMPLETION_KEY = "duelo_semantico_daily_done_v1";
  const SOLO_MODE_KEY = "duelo_semantico_solo_mode_v1";

  let dailyCountdownTimer = null;
  let startMatchSerial = 0;
  let pendingStartPromise = null;

  let gameState = {
    mode: "practice",    // "practice" (modo treino livre) ou "daily" (palavra do dia unica para todos)
    gameCount: 0,
    secretWord: "",
    matchToken: null,
    revealedMeta: null,
    categoryFilter: "all",
    round: 1,
    isSolved: false,
    wasRevealed: false,
    isCustomSecret: false,
    champion: null,
    lastDuel: null,
    history: [],
    testedWords: [],
    hintsUsed: 0,
    revealedHints: { tier1: null, tier2: null, tier3: null }
  };

  let stats = {
    gamesWon: 0,
    bestRounds: null,
    totalRoundsPlayed: 0
  };

  const SUGGESTION_SETS = [
    ["carro", "casa", "vida", "tempo", "arvore", "futebol", "computador", "livro", "musica", "agua", "paz", "cachorro"],
    ["aviao", "escola", "comida", "dinheiro", "hospital", "sol", "planeta", "roupa", "violao", "cinema", "amigo", "fogo"],
    ["bicicleta", "cozinha", "azeite", "relogio", "oceano", "leao", "celular", "caderno", "justica", "basquete", "cafe", "amor"],
    ["navio", "biblioteca", "restaurante", "eletricidade", "estrela", "sapato", "martelo", "policia", "xadrez", "saudade", "pao", "flor"]
  ];
  let suggestionPage = 0;

  function qs(sel) { return document.querySelector(sel); }
  function qsa(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function getTodayDateKey() {
    const apiInfo = window.DUELO.Api && window.DUELO.Api.getServerDateInfo();
    if (apiInfo && apiInfo.dateKey) return apiInfo.dateKey;
    try {
      const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });
      return fmt.format(new Date());
    } catch (e) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      return y + "-" + m + "-" + d;
    }
  }

  function loadPreferredMode() {
    try {
      const saved = localStorage.getItem(SOLO_MODE_KEY);
      if (saved === "daily" || saved === "practice") return saved;
    } catch (e) {}
    return "practice";
  }

  function savePreferredMode(mode) {
    try {
      localStorage.setItem(SOLO_MODE_KEY, mode === "daily" ? "daily" : "practice");
    } catch (e) {}
  }

  function getTodayDailyRecord() {
    try {
      const raw = localStorage.getItem(DAILY_COMPLETION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.dateKey === getTodayDateKey() && parsed.secretWord) {
        return parsed;
      }
    } catch (e) {}
    return null;
  }

  function buildWinChain(historyList) {
    const chain = [];
    const list = Array.isArray(historyList) ? historyList : [];
    for (let i = list.length - 1; i >= 0; i--) {
      const w = list[i].winner && list[i].winner.displayWord;
      if (w && (chain.length === 0 || chain[chain.length - 1] !== w)) {
        chain.push(w);
      }
    }
    return chain;
  }

  function saveTodayDailyRecord(winner, totalRounds, wasRevealed) {
    try {
      const payload = {
        dateKey: getTodayDateKey(),
        secretWord: gameState.secretWord || winner.word,
        displayWord: winner.displayWord,
        hintText: (gameState.revealedMeta && gameState.revealedMeta.hint) || "",
        rounds: totalRounds,
        hintsUsed: gameState.hintsUsed,
        revealed: !!wasRevealed,
        chain: buildWinChain(gameState.history),
        champion: gameState.champion,
        history: gameState.history,
        testedWords: gameState.testedWords
      };
      localStorage.setItem(DAILY_COMPLETION_KEY, JSON.stringify(payload));
    } catch (e) {}
  }

  function isDailyLocked() {
    return gameState.mode === "daily" && !gameState.isCustomSecret && !!getTodayDailyRecord();
  }

  function formatTimeUntilTomorrow() {
    const apiInfo = window.DUELO.Api && window.DUELO.Api.getServerDateInfo();
    let diffSec = 0;
    if (apiInfo && apiInfo.nextDailyAtMs) {
      diffSec = Math.max(0, Math.floor((apiInfo.nextDailyAtMs - Date.now()) / 1000));
    } else {
      const now = new Date();
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
      diffSec = Math.max(0, Math.floor((tomorrow.getTime() - now.getTime()) / 1000));
    }
    const h = String(Math.floor(diffSec / 3600)).padStart(2, "0");
    const m = String(Math.floor((diffSec % 3600) / 60)).padStart(2, "0");
    const s = String(diffSec % 60).padStart(2, "0");
    return h + "h " + m + "m " + s + "s";
  }

  function stopDailyCountdownTimer() {
    if (dailyCountdownTimer) {
      clearInterval(dailyCountdownTimer);
      dailyCountdownTimer = null;
    }
  }

  function startDailyCountdownTimer() {
    stopDailyCountdownTimer();
    const el = qs("#daily-countdown-text");
    if (!el) return;
    el.textContent = formatTimeUntilTomorrow();
    dailyCountdownTimer = setInterval(function () {
      const target = qs("#daily-countdown-text");
      if (!target || gameState.mode !== "daily") {
        stopDailyCountdownTimer();
        return;
      }
      target.textContent = formatTimeUntilTomorrow();
    }, 1000);
  }

  function syncModeControls() {
    const isDaily = gameState.mode === "daily";
    const modeSelect = qs("#select-game-mode");
    const catSelect = qs("#select-category-filter");
    const btnNew = qs("#btn-new-secret");
    const btnHint = qs("#btn-get-hint");
    const btnReveal = qs("#btn-reveal-secret");

    if (modeSelect && modeSelect.value !== gameState.mode) {
      modeSelect.value = gameState.mode;
    }

    // Na Palavra do Dia não existe filtro de tema: a palavra é a mesma para todos
    if (catSelect) {
      catSelect.classList.toggle("hidden", isDaily);
      catSelect.disabled = isDaily;
    }

    // Na Palavra do Dia não há sorteio de "Nova Palavra"
    if (btnNew) {
      btnNew.classList.toggle("hidden", isDaily);
    }

    const hideActionButtons = gameState.isSolved || isDailyLocked();
    if (btnHint) {
      btnHint.classList.toggle("hidden", hideActionButtons);
      btnHint.disabled = gameState.hintsUsed >= 3;
      btnHint.textContent = gameState.hintsUsed >= 3
        ? "Todas as Dicas (3/3)"
        : (gameState.hintsUsed > 0 ? "Pedir Dica (" + gameState.hintsUsed + "/3)" : "Pedir Dica");
    }
    if (btnReveal) btnReveal.classList.toggle("hidden", hideActionButtons);
  }

  function switchMainTab(tabName) {
    const isDuel = tabName === "duel";
    const soloView = qs("#tab-solo-view");
    const duelView = qs("#tab-duel-view");
    if (soloView) soloView.classList.toggle("hidden", isDuel);
    if (duelView) duelView.classList.toggle("hidden", !isDuel);

    qsa("[data-main-tab]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-main-tab") === tabName);
    });
  }

  window.DUELO.SwitchTab = switchMainTab;

  function init() {
    gameState.mode = loadPreferredMode();
    loadStats();
    window.DUELO.Radar.init(qs("#semantic-radar-canvas"));
    bindEvents();
    renderSuggestionsChips();
    startNewMatch(); // Sempre sorteia uma palavra secreta aleatoria ou carrega o estado diario
    if (window.DUELO.DuelMode && window.DUELO.DuelMode.init) {
      window.DUELO.DuelMode.init();
    }
  }

  function loadStats() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        stats.gamesWon = parsed.gamesWon || 0;
        stats.bestRounds = parsed.bestRounds || null;
        stats.totalRoundsPlayed = parsed.totalRoundsPlayed || 0;
      }
    } catch (e) {}
    renderStatsBar();
  }

  function saveStats() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (e) {}
    renderStatsBar();
  }

  function renderStatsBar() {
    const wonEl = qs("#stat-games-won");
    const bestEl = qs("#stat-best-rounds");
    const roundEl = qs("#stat-current-round");
    if (wonEl) wonEl.textContent = stats.gamesWon;
    if (bestEl) bestEl.textContent = stats.bestRounds !== null ? stats.bestRounds + " rodadas" : "--";
    if (roundEl) {
      if (gameState.mode === "daily" && gameState.isSolved) {
        roundEl.textContent = gameState.wasRevealed ? "Revelada" : "Concluído";
      } else {
        roundEl.textContent = "Rodada " + gameState.round;
      }
    }
  }

  function renderSuggestionsChips() {
    const container = qs("#quick-suggestions-cluster");
    if (!container) return;

    const usedSet = {};
    (gameState.testedWords || []).forEach(function (t) {
      usedSet[t.word] = true;
    });

    const activeList = SUGGESTION_SETS[suggestionPage % SUGGESTION_SETS.length] || SUGGESTION_SETS[0];
    container.innerHTML = activeList.map(function (w) {
      const isUsed = !!usedSet[w];
      return '<button type="button" data-fill-word="' + w + '" class="suggestion-chip ' + (isUsed ? "is-used" : "") + '"' + (isUsed ? " disabled title=\"Ja testada nesta partida\"" : "") + '>' + w + '</button>';
    }).join("");

    qsa("[data-fill-word]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.disabled) return;
        const word = btn.getAttribute("data-fill-word");
        const in1 = qs("#input-round1-word1");
        const in2 = qs("#input-round1-word2");
        const inNext = qs("#input-next-challenger");

        if (gameState.round === 1 && !gameState.champion) {
          if (!in1.value.trim()) {
            in1.value = word;
            in2.focus();
          } else if (!in2.value.trim()) {
            in2.value = word;
            hideMissingHighlight();
            hideInlineAlert();
          } else {
            in2.value = word;
          }
        } else if (inNext) {
          inNext.value = word;
          inNext.focus();
        }
      });
    });
  }

  function getRecentSecrets() {
    try {
      const raw = localStorage.getItem(RECENT_SECRETS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function rememberSecret(word) {
    try {
      const list = getRecentSecrets().filter(function (w) { return w !== word; });
      list.unshift(word);
      if (list.length > 25) list.length = 25;
      localStorage.setItem(RECENT_SECRETS_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function pickRandomSecretWord(categoryFilter) {
    const pool = window.DUELO_DATA.SECRET_POOL || [];
    const wordsDb = window.DUELO_DATA.WORDS || {};
    const recent = getRecentSecrets();

    let byCategory = pool.filter(function (w) {
      if (w === gameState.secretWord) return false;
      if (!categoryFilter || categoryFilter === "all") return true;
      return wordsDb[w] && wordsDb[w].cluster === categoryFilter;
    });
    if (byCategory.length === 0) byCategory = pool.filter(function (w) { return w !== gameState.secretWord; });

    // Prioriza palavras que nao sairam recentemente
    let fresh = byCategory.filter(function (w) { return recent.indexOf(w) === -1; });
    const candidates = fresh.length > 0 ? fresh : byCategory;

    const idx = Math.floor(Math.random() * candidates.length);
    const picked = candidates[idx] || "carro";
    rememberSecret(picked);
    return picked;
  }

  function restoreLockedDailyMatch(record) {
    stopDailyCountdownTimer();
    gameState.gameCount += 1;
    gameState.secretWord = record.secretWord;
    gameState.matchToken = null;
    gameState.revealedMeta = record.hintText ? { hint: record.hintText, displayWord: record.displayWord } : null;
    gameState.round = record.rounds || 1;
    gameState.isSolved = true;
    gameState.wasRevealed = !!record.revealed;
    gameState.isCustomSecret = false;
    gameState.champion = record.champion || null;
    gameState.lastDuel = null;
    gameState.history = Array.isArray(record.history) ? record.history : [];
    gameState.testedWords = Array.isArray(record.testedWords) ? record.testedWords : [];
    gameState.hintsUsed = record.hintsUsed || 0;
    gameState.revealedHints = { tier1: null, tier2: null, tier3: null };

    window.DUELO.Radar.reset();
    gameState.testedWords.forEach(function (tw) {
      window.DUELO.Radar.addOrUpdateWord(tw, !!(gameState.champion && gameState.champion.word === tw.word));
    });
    window.DUELO.Radar.setSolved(record.displayWord);

    const in1 = qs("#input-round1-word1");
    const in2 = qs("#input-round1-word2");
    const inNext = qs("#input-next-challenger");
    if (in1) in1.value = "";
    if (in2) in2.value = "";
    if (inNext) inNext.value = "";

    hideMissingHighlight();
    hideInlineAlert();

    const hintBox = qs("#hint-display-box");
    if (hintBox) {
      hintBox.classList.add("hidden");
      hintBox.innerHTML = "";
    }

    renderVictoryState(
      { word: record.secretWord, displayWord: record.displayWord },
      gameState.round,
      gameState.wasRevealed,
      record.chain
    );
    updateUI();
  }

  function applyLocalSecretFallback(customSpec) {
    if (customSpec && typeof customSpec === "object") {
      const resolved = window.DUELO.Engine.resolveWord(customSpec.word);
      const cleanWord = resolved ? resolved.canonical : customSpec.word.toLowerCase();
      const clusterKey = customSpec.cluster || "transporte_rodas";
      const sampleKey = Object.keys(window.DUELO_DATA.WORDS).find(function (k) {
        return window.DUELO_DATA.WORDS[k].cluster === clusterKey;
      }) || "carro";
      const sample = window.DUELO_DATA.WORDS[sampleKey];
      const customLinks = customSpec.links
        ? customSpec.links.split(",").map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean)
        : sample.links.slice(0, 6);

      window.DUELO_DATA.WORDS[cleanWord] = {
        word: cleanWord,
        category: sample.category,
        cluster: clusterKey,
        sub: cleanWord,
        vec: sample.vec.slice(),
        links: customLinks,
        hint: customSpec.hint || ("Palavra secreta personalizada na categoria " + sample.category + ".")
      };
      return cleanWord;
    }

    if (typeof customSpec === "string" && customSpec) {
      const r = window.DUELO.Engine.resolveWord(customSpec);
      return r ? r.canonical : customSpec;
    }

    if (gameState.mode === "daily") {
      return window.DUELO.Engine.getDailySecretWord();
    }
    return pickRandomSecretWord(gameState.categoryFilter);
  }

  function startNewMatch(customSpec) {
    stopDailyCountdownTimer();
    const mySerial = ++startMatchSerial;

    if (customSpec) {
      gameState.mode = "practice";
      gameState.isCustomSecret = true;
      savePreferredMode("practice");
    } else {
      gameState.isCustomSecret = false;
    }

    if (gameState.mode === "daily" && !customSpec) {
      const dailyRec = getTodayDailyRecord();
      if (dailyRec) {
        pendingStartPromise = null;
        restoreLockedDailyMatch(dailyRec);
        return;
      }
    }

    gameState.gameCount += 1;
    gameState.secretWord = "";
    gameState.matchToken = null;
    gameState.revealedMeta = null;
    gameState.round = 1;
    gameState.isSolved = false;
    gameState.wasRevealed = false;
    gameState.champion = null;
    gameState.lastDuel = null;
    gameState.history = [];
    gameState.testedWords = [];
    gameState.hintsUsed = 0;
    gameState.revealedHints = { tier1: null, tier2: null, tier3: null };

    window.DUELO.Radar.reset();

    const in1 = qs("#input-round1-word1");
    const in2 = qs("#input-round1-word2");
    const inNext = qs("#input-next-challenger");
    if (in1) in1.value = "";
    if (in2) in2.value = "";
    if (inNext) inNext.value = "";

    hideMissingHighlight();
    hideInlineAlert();

    const hintBox = qs("#hint-display-box");
    if (hintBox) {
      hintBox.classList.add("hidden");
      hintBox.innerHTML = "";
    }

    const victoryBanner = qs("#victory-banner");
    if (victoryBanner) victoryBanner.classList.add("hidden");

    const Api = window.DUELO.Api;
    if (Api && !Api.isOfflineFallback()) {
      const startPayload = customSpec && typeof customSpec === "object"
        ? { mode: "custom", customSecret: customSpec }
        : {
            mode: gameState.mode,
            categoryFilter: gameState.mode === "daily" ? "all" : gameState.categoryFilter,
            excludeWords: getRecentSecrets()
          };

      pendingStartPromise = Api.startMatch(startPayload)
        .then(function (data) {
          if (mySerial !== startMatchSerial) return;
          if (!data) {
            // Fallback offline (localhost sem backend ou file://)
            const chosen = applyLocalSecretFallback(customSpec);
            const resolved = window.DUELO.Engine.resolveWord(chosen);
            gameState.secretWord = resolved ? resolved.canonical : chosen;
            return;
          }
          gameState.matchToken = data.matchToken;
          if (gameState.mode === "daily" && !customSpec) {
            const serverRec = getTodayDailyRecord();
            if (serverRec) {
              restoreLockedDailyMatch(serverRec);
            }
          }
        })
        .catch(function (err) {
          if (mySerial !== startMatchSerial) return;
          showInlineAlert((err && err.message) || "Erro ao iniciar partida no servidor.");
        });
    } else {
      pendingStartPromise = null;
      const chosen = applyLocalSecretFallback(customSpec);
      const resolved = window.DUELO.Engine.resolveWord(chosen);
      gameState.secretWord = resolved ? resolved.canonical : "roda";
    }

    updateUI();
    if (in1) in1.focus();
  }

  function highlightMissingInput(inputEl) {
    if (!inputEl) return;
    inputEl.classList.add("input-missing-pulse");
    inputEl.focus();
    setTimeout(function () {
      inputEl.classList.remove("input-missing-pulse");
    }, 1800);
  }

  function hideMissingHighlight() {
    qsa(".word-input").forEach(function (inp) {
      inp.classList.remove("input-missing-pulse");
    });
  }

  let isEvaluating = false;

  function setBusyState(busy, customText) {
    isEvaluating = busy;
    const btn1 = qs("#btn-submit-round1");
    const btn2 = qs("#btn-submit-round-next");
    if (btn1) {
      btn1.disabled = busy;
      btn1.textContent = busy ? (customText || "Consultando dicionário...") : "Comparar palavras";
    }
    if (btn2) {
      btn2.disabled = busy;
      btn2.textContent = busy ? (customText || "Consultando dicionário...") : "Enviar tentativa";
    }
  }

  async function evaluateGuessList(wordsArr) {
    if (pendingStartPromise) {
      await pendingStartPromise;
    }

    const Api = window.DUELO.Api;
    if (gameState.matchToken && Api) {
      const res = await Api.evaluateWords(gameState.matchToken, wordsArr);
      if (res && res.revealedMeta) {
        gameState.revealedMeta = res.revealedMeta;
      }
      return res ? res.results : [];
    }

    if (Api && !Api.isOfflineFallback()) {
      throw new Error("Partida aguardando resposta do servidor.");
    }

    return await Promise.all(
      wordsArr.map(function (w) {
        return window.DUELO.Engine.evaluateWordAsync(w, gameState.secretWord);
      })
    );
  }

  // ==========================================================================
  // RODADA 1: PROCESSAMENTO DE 2 PALAVRAS
  // ==========================================================================
  async function handleRound1Submit(ev) {
    if (ev) ev.preventDefault();
    if (gameState.isSolved || isEvaluating || isDailyLocked()) return;

    const in1 = qs("#input-round1-word1");
    const in2 = qs("#input-round1-word2");
    let w1Raw = (in1.value || "").trim();
    let w2Raw = (in2.value || "").trim();

    // Se o usuario digitou as duas palavras no 1o campo separadas por espaco (ex: "agua fogo"), divide automaticamente!
    if (w1Raw && !w2Raw && /\s+/.test(w1Raw)) {
      const parts = w1Raw.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        w1Raw = parts[0];
        w2Raw = parts[1];
        in1.value = w1Raw;
        in2.value = w2Raw;
      }
    }

    if (!w1Raw && !w2Raw) {
      highlightMissingInput(in1);
      showInlineAlert("Digite duas palavras para a 1ª rodada (ou clique nas sugestões abaixo).");
      return;
    }
    if (!w1Raw) {
      highlightMissingInput(in1);
      showInlineAlert("Falta preencher a primeira palavra.");
      return;
    }
    if (!w2Raw) {
      highlightMissingInput(in2);
      showInlineAlert("Você digitou '" + w1Raw + "'. Agora digite a segunda palavra ao lado para comparar (ou clique em uma sugestão).");
      return;
    }

    hideMissingHighlight();
    hideInlineAlert();

    try {
      const r1Sync = window.DUELO.Engine.resolveWord(w1Raw, false);
      const r2Sync = window.DUELO.Engine.resolveWord(w2Raw, false);
      if (gameState.matchToken || (r1Sync && (!r1Sync.known || r1Sync.source === "morpheme")) || (r2Sync && (!r2Sync.known || r2Sync.source === "morpheme"))) {
        setBusyState(true, "Consultando servidor...");
      }

      const evalResults = await evaluateGuessList([w1Raw, w2Raw]);
      const eval1 = evalResults && evalResults[0];
      const eval2 = evalResults && evalResults[1];

      if (!eval1 || !eval2) {
        showInlineAlert("Por favor, digite palavras válidas em português.");
        return;
      }

      if (eval1.word === eval2.word) {
        highlightMissingInput(in2);
        showInlineAlert("As duas palavras são iguais (" + eval1.displayWord + "). Digite duas palavras diferentes para comparar.");
        return;
      }

      processDuel(eval1, eval2);
    } catch (err) {
      showInlineAlert((err && err.message) || "Não foi possível avaliar agora. Tente novamente em instantes.");
    } finally {
      setBusyState(false);
    }
  }

  // ==========================================================================
  // RODADAS 2+: CAMPEA VS NOVA PALAVRA
  // ==========================================================================
  async function handleNextRoundSubmit(ev) {
    if (ev) ev.preventDefault();
    if (gameState.isSolved || !gameState.champion || isEvaluating || isDailyLocked()) return;

    const inputEl = qs("#input-next-challenger");
    const challengerRaw = (inputEl.value || "").trim();

    if (!challengerRaw) {
      highlightMissingInput(inputEl);
      showInlineAlert("Digite uma nova palavra para comparar contra " + gameState.champion.displayWord + ".");
      return;
    }

    hideMissingHighlight();
    hideInlineAlert();

    try {
      const rSync = window.DUELO.Engine.resolveWord(challengerRaw, false);
      if (gameState.matchToken || (rSync && (!rSync.known || rSync.source === "morpheme"))) {
        setBusyState(true, "Consultando servidor...");
      }

      const evalResults = await evaluateGuessList([challengerRaw]);
      const evalChallenger = evalResults && evalResults[0];
      if (!evalChallenger) {
        showInlineAlert("Digite uma palavra válida da língua portuguesa.");
        return;
      }

      if (evalChallenger.word === gameState.champion.word) {
        highlightMissingInput(inputEl);
        showInlineAlert("A palavra " + evalChallenger.displayWord + " já é a mais próxima atual! Digite outra.");
        return;
      }

      const alreadyTested = gameState.testedWords.find(function (t) {
        return t.word === evalChallenger.word;
      });
      if (alreadyTested) {
        highlightMissingInput(inputEl);
        showInlineAlert("Você já usou a palavra " + evalChallenger.displayWord + " nesta partida (" + alreadyTested.score.toFixed(1) + "%). Tente uma palavra nova!");
        return;
      }

      inputEl.value = "";
      processDuel(gameState.champion, evalChallenger);
      inputEl.focus();
    } catch (err) {
      showInlineAlert((err && err.message) || "Não foi possível comparar agora. Tente novamente.");
    } finally {
      setBusyState(false);
    }
  }

  // ==========================================================================
  // PROCESSAMENTO DO DUELO
  // ==========================================================================
  function processDuel(leftEval, rightEval) {
    const currentRound = gameState.round;
    const rightWins = rightEval.score >= leftEval.score;
    const winner = rightWins ? rightEval : leftEval;
    const loser = rightWins ? leftEval : rightEval;

    const previousChampionWord = gameState.champion ? gameState.champion.word : null;
    gameState.champion = winner;

    gameState.lastDuel = {
      round: currentRound,
      left: leftEval,
      right: rightEval,
      winner: winner,
      loser: loser,
      winnerSide: rightWins ? "right" : "left",
      changedLeader: previousChampionWord !== winner.word
    };

    registerTestedWord(leftEval, winner.word === leftEval.word);
    registerTestedWord(rightEval, winner.word === rightEval.word);

    gameState.history.unshift({
      round: currentRound,
      left: leftEval,
      right: rightEval,
      winner: winner
    });

    if (winner.isExact) {
      gameState.isSolved = true;
      window.DUELO.Radar.setSolved(winner.displayWord);

      if (!gameState.wasRevealed) {
        window.DUELO.Audio.victory();
        stats.gamesWon += 1;
        stats.totalRoundsPlayed += currentRound;
        if (stats.bestRounds === null || currentRound < stats.bestRounds) {
          stats.bestRounds = currentRound;
        }
        saveStats();
      }

      if (gameState.mode === "daily" && !gameState.isCustomSecret) {
        saveTodayDailyRecord(winner, currentRound, gameState.wasRevealed);
      }

      renderVictoryState(winner, currentRound, gameState.wasRevealed);
    } else {
      gameState.round += 1;
      if (gameState.lastDuel.changedLeader) {
        window.DUELO.Audio.newChampion();
      } else {
        window.DUELO.Audio.championKept();
      }
    }

    updateUI();

    // Consulta definicao no Dicionario Online apenas se a palavra ainda nao tinha explicacao rica local
    if (!winner.isExact && winner.source === "api") {
      window.DUELO.Engine.fetchOnlineDefinition(winner.originalInput || winner.word).then(function (onlineDef) {
        if (onlineDef && onlineDef.definition && gameState.champion && gameState.champion.word === winner.word) {
          const metaEl = qs("#champ-word-meta");
          if (metaEl) {
            metaEl.textContent = onlineDef.definition;
          }
        }
      });
    }
  }

  function registerTestedWord(evalObj, isChampion) {
    window.DUELO.Radar.addOrUpdateWord(evalObj, isChampion);
    const existingIdx = gameState.testedWords.findIndex(function (item) {
      return item.word === evalObj.word;
    });
    if (existingIdx === -1) {
      gameState.testedWords.push(evalObj);
    } else {
      gameState.testedWords[existingIdx] = evalObj;
    }
    gameState.testedWords.sort(function (a, b) {
      return b.score - a.score;
    });
  }

  function updateUI() {
    syncModeControls();
    renderStatsBar();
    renderSuggestionsChips();

    const round1Panel = qs("#panel-round-1");
    const roundNextPanel = qs("#panel-round-next");
    const suggestionsBar = qs("#solo-suggestions-bar");

    if (gameState.isSolved || isDailyLocked()) {
      if (round1Panel) round1Panel.classList.add("hidden");
      if (roundNextPanel) roundNextPanel.classList.add("hidden");
      if (suggestionsBar) suggestionsBar.classList.add("hidden");
    } else {
      if (suggestionsBar) suggestionsBar.classList.remove("hidden");
      if (gameState.round === 1 && !gameState.champion) {
        round1Panel.classList.remove("hidden");
        roundNextPanel.classList.add("hidden");
      } else {
        round1Panel.classList.add("hidden");
        roundNextPanel.classList.remove("hidden");
        renderChampionSlot();
      }
    }

    renderLastDuelVerdict();
    renderHistoryTimeline();
    renderProximityLeaderboard();
  }

  function renderChampionSlot() {
    const ch = gameState.champion;
    if (!ch) return;

    qs("#champ-word-title").textContent = ch.displayWord;
    qs("#champ-word-score").textContent = ch.score.toFixed(1) + "%";
    qs("#champ-word-tier").textContent = ch.tierLabel;
    qs("#champ-word-tier").className = "temp-badge tier-" + ch.tier;
    qs("#champ-word-bar").style.width = Math.min(100, ch.score) + "%";
    qs("#champ-word-bar").className = "meter-fill fill-" + ch.tier;
    qs("#champ-word-meta").textContent = ch.explanation;

    const corrEl = qs("#champ-word-correction");
    if (corrEl) {
      if (ch.correctedFrom) {
        corrEl.textContent = 'Voce digitou "' + ch.correctedFrom + '" -> reconhecido como ' + ch.displayWord;
        corrEl.classList.remove("hidden");
      } else {
        corrEl.classList.add("hidden");
      }
    }
  }

  function renderLastDuelVerdict() {
    const box = qs("#duel-verdict-banner");
    if (!box) return;
    const d = gameState.lastDuel;
    if (!d) {
      box.classList.add("hidden");
      return;
    }

    box.classList.remove("hidden");

    const leftCorrection = d.left.correctedFrom ? ' <span class="text-xs text-zinc-400">(' + d.left.correctedFrom + ')</span>' : '';
    const rightCorrection = d.right.correctedFrom ? ' <span class="text-xs text-zinc-400">(' + d.right.correctedFrom + ')</span>' : '';

    let headline = "";
    if (d.winner.isExact) {
      headline = 'Na mosca! A palavra secreta era <strong>' + d.winner.displayWord + '</strong>.';
    } else if (d.round === 1) {
      headline = '<strong>' + d.winner.displayWord + '</strong> venceu a abertura e está mais próxima do que ' + d.loser.displayWord + '.';
    } else if (d.winnerSide === "right") {
      headline = '<strong>' + d.winner.displayWord + '</strong> (' + d.winner.score.toFixed(1) + '%) superou ' + d.loser.displayWord + ' (' + d.loser.score.toFixed(1) + '%) e assumiu o posto.';
    } else {
      headline = '<strong>' + d.winner.displayWord + '</strong> (' + d.winner.score.toFixed(1) + '%) continua mais próxima do que ' + d.loser.displayWord + ' (' + d.loser.score.toFixed(1) + '%).';
    }

    box.innerHTML =
      '<div class="verdict-header">' +
        '<span class="editorial-kicker">Resultado da Rodada ' + d.round + '</span>' +
        '<p class="verdict-headline">' + headline + '</p>' +
      '</div>' +
      '<div class="verdict-cards-row">' +
        '<div class="verdict-mini-card ' + (d.winnerSide === "left" ? "is-winner" : "is-loser") + '">' +
          '<div class="flex justify-between items-center">' +
            '<span class="font-bold text-white">' + d.left.displayWord + leftCorrection + '</span>' +
            '<span class="font-mono font-bold">' + d.left.score.toFixed(1) + '%</span>' +
          '</div>' +
          '<div class="meter-track mt-1"><div class="meter-fill fill-' + d.left.tier + '" style="width:' + d.left.score + '%"></div></div>' +
          '<span class="text-xs text-zinc-400 mt-1">' + (d.winnerSide === "left" ? "Mais próxima" : "Menos próxima") + ' · ' + d.left.tierLabel + '</span>' +
        '</div>' +
        '<div class="verdict-vs-pill">VS</div>' +
        '<div class="verdict-mini-card ' + (d.winnerSide === "right" ? "is-winner" : "is-loser") + '">' +
          '<div class="flex justify-between items-center">' +
            '<span class="font-bold text-white">' + d.right.displayWord + rightCorrection + '</span>' +
            '<span class="font-mono font-bold">' + d.right.score.toFixed(1) + '%</span>' +
          '</div>' +
          '<div class="meter-track mt-1"><div class="meter-fill fill-' + d.right.tier + '" style="width:' + d.right.score + '%"></div></div>' +
          '<span class="text-xs text-zinc-400 mt-1">' + (d.winnerSide === "right" ? "Mais próxima" : "Menos próxima") + ' · ' + d.right.tierLabel + '</span>' +
        '</div>' +
      '</div>';
  }

  function renderVictoryState(winner, totalRounds, wasRevealed, customChain) {
    const banner = qs("#victory-banner");
    if (!banner) return;
    const secretEntry = gameState.secretWord ? window.DUELO_DATA.WORDS[gameState.secretWord] : null;
    const hintText = (gameState.revealedMeta && gameState.revealedMeta.hint) || (secretEntry ? secretEntry.hint : "");
    const isDaily = gameState.mode === "daily" && !gameState.isCustomSecret;

    const chain = Array.isArray(customChain) && customChain.length > 0
      ? customChain
      : buildWinChain(gameState.history);

    let kicker = "Palavra Descoberta";
    if (isDaily) {
      kicker = wasRevealed ? "Palavra do Dia Revelada" : "Palavra do Dia Concluída";
    } else if (wasRevealed) {
      kicker = "Palavra Revelada";
    }

    const subtitle = wasRevealed
      ? (isDaily
          ? "Você revelou a Palavra do Dia de hoje. Este computador não pode tentar novamente até amanhã."
          : "Você revelou a resposta após " + totalRounds + " " + (totalRounds === 1 ? "rodada" : "rodadas") + ".")
      : (isDaily
          ? "Você descobriu a Palavra do Dia de hoje em " + totalRounds + " " + (totalRounds === 1 ? "rodada" : "rodadas") + "! Uma nova palavra libera amanhã."
          : "Você acertou em " + totalRounds + " " + (totalRounds === 1 ? "rodada" : "rodadas") + ".");

    const dailyNoticeHtml = isDaily
      ? '<p class="text-xs text-zinc-300 mt-2">Próxima Palavra do Dia em <strong id="daily-countdown-text" class="font-mono text-amber-300">' + formatTimeUntilTomorrow() + '</strong>.</p>'
      : '';

    const shareButtonHtml = !wasRevealed
      ? '<button type="button" id="btn-share-solo-result" class="btn-secondary">Compartilhar Resultado</button>'
      : '';

    const primaryActionHtml = isDaily
      ? '<button type="button" id="btn-victory-next" class="btn-primary">Treinar no Modo Livre</button>'
      : '<button type="button" id="btn-victory-next" class="btn-primary">Jogar Próxima Palavra</button>';

    const chainHtml = chain.length > 0
      ? '<div class="evolution-chain-box mt-3">' +
          '<span class="text-xs uppercase tracking-wider text-zinc-400">Caminho das vencedoras:</span>' +
          '<p class="font-mono text-sm text-emerald-400 mt-1">' + chain.join(" -> ") + '</p>' +
        '</div>'
      : '';

    banner.classList.remove("hidden");
    banner.innerHTML =
      '<div class="victory-celebration-card">' +
        '<span class="editorial-kicker">' + kicker + '</span>' +
        '<h2 class="victory-word-heading">' + winner.displayWord + '</h2>' +
        '<p class="text-sm text-zinc-300 mt-1">' + hintText + '</p>' +
        '<p class="text-xs font-mono text-amber-300 mt-2">' + subtitle + '</p>' +
        dailyNoticeHtml +
        chainHtml +
        '<div class="mt-4 flex flex-wrap justify-center gap-3">' +
          shareButtonHtml +
          primaryActionHtml +
        '</div>' +
      '</div>';

    if (isDaily) {
      startDailyCountdownTimer();
    }

    const shareBtn = qs("#btn-share-solo-result");
    if (shareBtn) {
      shareBtn.addEventListener("click", function () {
        const gameUrl = window.location.origin + window.location.pathname;
        const sharePrefix = isDaily ? "Duelo Semântico (Palavra do Dia): " : "Duelo Semântico: ";
        const shareText = sharePrefix + "acertei a palavra em " + totalRounds + (totalRounds === 1 ? " rodada" : " rodadas") + "! Jogue também: " + gameUrl;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareText).then(function () {
            shareBtn.textContent = "Copiado para o WhatsApp!";
            setTimeout(function () { shareBtn.textContent = "Compartilhar Resultado"; }, 2200);
          }).catch(function () {});
        }
      });
    }

    const nextBtn = qs("#btn-victory-next");
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        if (isDaily) {
          gameState.mode = "practice";
          savePreferredMode("practice");
          const modeSelect = qs("#select-game-mode");
          if (modeSelect) modeSelect.value = "practice";
        }
        startNewMatch();
      });
    }
  }

  function renderHistoryTimeline() {
    const container = qs("#duel-history-list");
    if (!container) return;

    if (gameState.history.length === 0) {
      container.innerHTML = '<div class="empty-box">Nenhuma rodada disputada ainda. Digite duas palavras acima para começar.</div>';
      return;
    }

    container.innerHTML = gameState.history.map(function (h) {
      return (
        '<div class="history-duel-row">' +
          '<span class="history-round-tag">R' + h.round + '</span>' +
          '<div class="history-pair">' +
            '<span class="' + (h.winner.word === h.left.word ? "is-win-word" : "is-lose-word") + '">' +
              h.left.displayWord + ' (' + h.left.score.toFixed(0) + '%)' +
            '</span>' +
            '<span class="text-xs text-zinc-500">vs</span>' +
            '<span class="' + (h.winner.word === h.right.word ? "is-win-word" : "is-lose-word") + '">' +
              h.right.displayWord + ' (' + h.right.score.toFixed(0) + '%)' +
            '</span>' +
          '</div>' +
          '<span class="history-winner-pill">Ficou: ' + h.winner.displayWord + '</span>' +
        '</div>'
      );
    }).join("");
  }

  function renderProximityLeaderboard() {
    const listEl = qs("#tested-words-ranking");
    if (!listEl) return;

    if (gameState.testedWords.length === 0) {
      listEl.innerHTML = '<div class="empty-box">Suas tentativas aparecerão aqui ordenadas da mais próxima para a mais distante.</div>';
      return;
    }

    listEl.innerHTML = gameState.testedWords.map(function (item, idx) {
      const isChamp = gameState.champion && gameState.champion.word === item.word;
      return (
        '<div class="ranking-word-row ' + (isChamp ? "is-current-champ" : "") + '">' +
          '<div class="flex items-center gap-2">' +
            '<span class="ranking-pos">#' + (idx + 1) + '</span>' +
            '<span class="font-bold text-sm text-white">' + item.displayWord + '</span>' +
            (isChamp ? '<span class="champ-mini-tag">Mais Próxima</span>' : '') +
          '</div>' +
          '<div class="flex items-center gap-3">' +
            '<div class="ranking-mini-bar"><div class="meter-fill fill-' + item.tier + '" style="width:' + item.score + '%"></div></div>' +
            '<span class="font-mono text-xs font-bold text-amber-300 w-12 text-right">' + item.score.toFixed(1) + '%</span>' +
          '</div>' +
        '</div>'
      );
    }).join("");
  }

  async function handleRequestHint() {
    if (gameState.isSolved || isDailyLocked() || isEvaluating || gameState.hintsUsed >= 3) return;
    const hintBox = qs("#hint-display-box");
    if (!hintBox) return;

    const champScore = gameState.champion ? gameState.champion.score : 15;
    const nextLevel = Math.min(3, gameState.hintsUsed + 1);
    const excludeWords = (gameState.testedWords || []).map(function (t) { return t.word; });

    try {
      if (pendingStartPromise) await pendingStartPromise;

      let bundle = null;
      const Api = window.DUELO.Api;
      if (gameState.matchToken && Api) {
        bundle = await Api.requestHint(gameState.matchToken, nextLevel, champScore, excludeWords);
      } else if (Api && !Api.isOfflineFallback()) {
        showInlineAlert("Aguardando conexão com o servidor.");
        return;
      } else {
        bundle = window.DUELO.Engine.getHintBundle(gameState.secretWord, champScore, nextLevel, excludeWords);
      }

      if (!gameState.revealedHints.tier1 && bundle.tier1) {
        gameState.revealedHints.tier1 = bundle.tier1;
      }
      if (nextLevel >= 2 && !gameState.revealedHints.tier2 && bundle.tier2) {
        gameState.revealedHints.tier2 = bundle.tier2;
      }
      if (nextLevel >= 3 && !gameState.revealedHints.tier3 && bundle.tier3) {
        gameState.revealedHints.tier3 = bundle.tier3;
      }

      window.DUELO.Audio.hint();
      gameState.hintsUsed = nextLevel;
      syncModeControls();
      hintBox.classList.remove("hidden");

      let html = '<div class="space-y-1">';
      if (gameState.revealedHints.tier1) {
        html += '<p class="text-xs font-semibold text-amber-300">' + gameState.revealedHints.tier1 + '</p>';
      }
      if (gameState.hintsUsed >= 2 && gameState.revealedHints.tier2) {
        html += '<p class="text-xs text-sky-300">' + gameState.revealedHints.tier2 + '</p>';
      }
      if (gameState.hintsUsed >= 3 && gameState.revealedHints.tier3) {
        html += '<p class="text-xs text-emerald-400">' + gameState.revealedHints.tier3 + '</p>';
      }
      html += '</div>';

      hintBox.innerHTML = html;
    } catch (err) {
      showInlineAlert((err && err.message) || "Não foi possível carregar a dica agora.");
    }
  }

  async function handleGiveUpReveal() {
    if (gameState.isSolved || isDailyLocked() || isEvaluating) return;

    try {
      if (pendingStartPromise) await pendingStartPromise;
      let evalExact = null;

      const Api = window.DUELO.Api;
      if (gameState.matchToken && Api) {
        const res = await Api.revealSecret(gameState.matchToken);
        evalExact = res ? res.evalExact : null;
        if (res && res.revealedMeta) {
          gameState.revealedMeta = res.revealedMeta;
        }
      } else if (Api && !Api.isOfflineFallback()) {
        showInlineAlert("Aguardando conexão com o servidor.");
        return;
      } else {
        evalExact = window.DUELO.Engine.calculateProximity(gameState.secretWord, gameState.secretWord);
      }

      if (!evalExact) return;

      gameState.wasRevealed = true;
      window.DUELO.Audio.hint();
      const left = gameState.champion || evalExact;
      processDuel(left, evalExact);
    } catch (err) {
      showInlineAlert((err && err.message) || "Não foi possível revelar a palavra agora.");
    }
  }

  function showInlineAlert(msg) {
    const el = qs("#inline-alert-box");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    if (el.scrollIntoView) {
      try { el.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (e) {}
    }
  }

  function hideInlineAlert() {
    const el = qs("#inline-alert-box");
    if (!el) return;
    el.classList.add("hidden");
  }

  function bindEvents() {
    const btnShuffle = qs("#btn-shuffle-suggestions");
    if (btnShuffle) {
      btnShuffle.addEventListener("click", function () {
        suggestionPage = (suggestionPage + 1) % SUGGESTION_SETS.length;
        renderSuggestionsChips();
      });
    }

    qsa("[data-main-tab]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        switchMainTab(btn.getAttribute("data-main-tab"));
      });
    });

    const formR1 = qs("#form-round-1");
    if (formR1) formR1.addEventListener("submit", handleRound1Submit);

    const formNext = qs("#form-round-next");
    if (formNext) formNext.addEventListener("submit", handleNextRoundSubmit);

    // Se o usuario der Enter no Campo 1, avanca para o Campo 2 suavemente!
    const in1 = qs("#input-round1-word1");
    const in2 = qs("#input-round1-word2");
    if (in1 && in2) {
      in1.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" && !in2.value.trim()) {
          ev.preventDefault();
          in2.focus();
        }
      });
      in1.addEventListener("input", function () {
        hideMissingHighlight();
        hideInlineAlert();
      });
      in2.addEventListener("input", function () {
        hideMissingHighlight();
        hideInlineAlert();
      });
    }

    const btnDemo = qs("#btn-fill-example");
    if (btnDemo) {
      btnDemo.addEventListener("click", function () {
        qs("#input-round1-word1").value = "casa";
        qs("#input-round1-word2").value = "carro";
        handleRound1Submit();
      });
    }

    const btnHint = qs("#btn-get-hint");
    if (btnHint) btnHint.addEventListener("click", handleRequestHint);

    const btnNewWord = qs("#btn-new-secret");
    if (btnNewWord) {
      btnNewWord.addEventListener("click", function () {
        startNewMatch();
      });
    }

    const btnReveal = qs("#btn-reveal-secret");
    if (btnReveal) btnReveal.addEventListener("click", handleGiveUpReveal);

    const catSelect = qs("#select-category-filter");
    if (catSelect) {
      catSelect.addEventListener("change", function () {
        gameState.categoryFilter = catSelect.value;
        if (gameState.mode === "daily") {
          gameState.mode = "practice";
          savePreferredMode("practice");
        }
        startNewMatch();
      });
    }

    // Seletor de Modo: Treino Livre vs Palavra do Dia
    const modeSelect = qs("#select-game-mode");
    if (modeSelect) {
      modeSelect.addEventListener("change", function () {
        gameState.mode = modeSelect.value === "daily" ? "daily" : "practice";
        savePreferredMode(gameState.mode);
        startNewMatch();
      });
    }

    const btnAudio = qs("#btn-toggle-sound");
    if (btnAudio) {
      btnAudio.addEventListener("click", function () {
        const muted = window.DUELO.Audio.toggleMute();
        btnAudio.textContent = muted ? "Som: Mudo" : "Som: Ativo";
      });
    }

    // Modal Criar Palavra / 2 Jogadores
    const btnOpenCustom = qs("#btn-open-custom-modal");
    const modalCustom = qs("#modal-custom-word");
    const btnCloseCustom = qs("#btn-close-custom-modal");

    if (btnOpenCustom && modalCustom) {
      btnOpenCustom.addEventListener("click", function () {
        modalCustom.classList.remove("hidden");
        qs("#input-custom-secret").focus();
      });
    }
    if (btnCloseCustom && modalCustom) {
      btnCloseCustom.addEventListener("click", function () {
        modalCustom.classList.add("hidden");
      });
    }

    const formCustom = qs("#form-custom-word");
    if (formCustom) {
      formCustom.addEventListener("submit", function (ev) {
        ev.preventDefault();
        const rawWord = (qs("#input-custom-secret").value || "").trim().toLowerCase();
        const rawHint = (qs("#input-custom-hint").value || "").trim();
        const rawLinks = (qs("#input-custom-links").value || "").trim();
        const clusterKey = qs("#select-custom-cluster").value || "transporte_rodas";

        if (!rawWord) return;

        modalCustom.classList.add("hidden");
        formCustom.reset();
        startNewMatch({
          word: rawWord,
          hint: rawHint,
          links: rawLinks,
          cluster: clusterKey
        });
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
