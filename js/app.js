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

  let gameState = {
    mode: "practice",    // "practice" (modo teste livre) ou "daily" (palavra do dia estilo Termo)
    gameCount: 0,
    secretWord: "",
    categoryFilter: "all",
    round: 1,
    isSolved: false,
    champion: null,
    lastDuel: null,
    history: [],
    testedWords: [],
    hintsUsed: 0
  };

  let stats = {
    gamesWon: 0,
    bestRounds: null,
    totalRoundsPlayed: 0
  };

  const SUGGESTIONS = ["carro", "casa", "vida", "tempo", "arvore", "pneu", "futebol", "computador", "paz", "agua"];

  function qs(sel) { return document.querySelector(sel); }
  function qsa(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

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
    loadStats();
    window.DUELO.Radar.init(qs("#semantic-radar-canvas"));
    bindEvents();
    renderSuggestionsChips();
    startNewMatch(); // Sempre sorteia uma palavra secreta aleatoria diferente!
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
    if (roundEl) roundEl.textContent = "Rodada " + gameState.round;
  }

  function renderSuggestionsChips() {
    const container = qs("#quick-suggestions-cluster");
    if (!container) return;

    const usedSet = {};
    (gameState.testedWords || []).forEach(function (t) {
      usedSet[t.word] = true;
    });

    container.innerHTML = SUGGESTIONS.map(function (w) {
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

  function startNewMatch(forcedSecretWord) {
    let chosen = forcedSecretWord;
    if (!chosen) {
      if (gameState.mode === "daily") {
        chosen = window.DUELO.Engine.getDailySecretWord();
      } else {
        chosen = pickRandomSecretWord(gameState.categoryFilter);
      }
    }

    const resolved = window.DUELO.Engine.resolveWord(chosen);
    const canonicalSecret = resolved ? resolved.canonical : "roda";

    gameState.gameCount += 1;
    gameState.secretWord = canonicalSecret;
    gameState.round = 1;
    gameState.isSolved = false;
    gameState.champion = null;
    gameState.lastDuel = null;
    gameState.history = [];
    gameState.testedWords = [];
    gameState.hintsUsed = 0;

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
      btn1.textContent = busy ? (customText || "Analisando Dicionario...") : "Comparar as 2 Palavras";
    }
    if (btn2) {
      btn2.disabled = busy;
      btn2.textContent = busy ? (customText || "Analisando Dicionario...") : "Comparar com a Campea Atual";
    }
  }

  // ==========================================================================
  // RODADA 1: PROCESSAMENTO DE 2 PALAVRAS
  // ==========================================================================
  async function handleRound1Submit(ev) {
    if (ev) ev.preventDefault();
    if (gameState.isSolved || isEvaluating) return;

    const in1 = qs("#input-round1-word1");
    const in2 = qs("#input-round1-word2");
    const w1Raw = (in1.value || "").trim();
    const w2Raw = (in2.value || "").trim();

    if (!w1Raw && !w2Raw) {
      highlightMissingInput(in1);
      showInlineAlert("Digite duas palavras para o primeiro duelo (ou clique em um dos exemplos abaixo).");
      return;
    }
    if (!w1Raw) {
      highlightMissingInput(in1);
      showInlineAlert("Falta preencher a primeira palavra!");
      return;
    }
    if (!w2Raw) {
      highlightMissingInput(in2);
      showInlineAlert("Voce digitou '" + w1Raw + "'. Agora digite a segunda palavra para duelar contra ela (ex: carro, tempo...) ou clique nas sugestoes abaixo!");
      return;
    }

    hideMissingHighlight();
    hideInlineAlert();

    const r1Sync = window.DUELO.Engine.resolveWord(w1Raw, false);
    const r2Sync = window.DUELO.Engine.resolveWord(w2Raw, false);
    if ((r1Sync && (!r1Sync.known || r1Sync.source === "morpheme")) || (r2Sync && (!r2Sync.known || r2Sync.source === "morpheme"))) {
      setBusyState(true, "Consultando Dicionario Online...");
    }

    const [eval1, eval2] = await Promise.all([
      window.DUELO.Engine.evaluateWordAsync(w1Raw, gameState.secretWord),
      window.DUELO.Engine.evaluateWordAsync(w2Raw, gameState.secretWord)
    ]);
    setBusyState(false);

    if (!eval1 || !eval2) {
      showInlineAlert("Por favor, digite termos validos em portugues.");
      return;
    }

    if (eval1.word === eval2.word) {
      highlightMissingInput(in2);
      showInlineAlert("As duas palavras sao iguais (" + eval1.displayWord + "). Digite duas palavras diferentes para o programa comparar!");
      return;
    }

    processDuel(eval1, eval2);
  }

  // ==========================================================================
  // RODADAS 2+: CAMPEA VS NOVA PALAVRA
  // ==========================================================================
  async function handleNextRoundSubmit(ev) {
    if (ev) ev.preventDefault();
    if (gameState.isSolved || !gameState.champion || isEvaluating) return;

    const inputEl = qs("#input-next-challenger");
    const challengerRaw = (inputEl.value || "").trim();

    if (!challengerRaw) {
      highlightMissingInput(inputEl);
      showInlineAlert("Digite uma nova palavra para comparar contra " + gameState.champion.displayWord + ".");
      return;
    }

    hideMissingHighlight();
    hideInlineAlert();

    const rSync = window.DUELO.Engine.resolveWord(challengerRaw, false);
    if (rSync && (!rSync.known || rSync.source === "morpheme")) {
      setBusyState(true, "Consultando Dicionario Online...");
    }

    const evalChallenger = await window.DUELO.Engine.evaluateWordAsync(challengerRaw, gameState.secretWord);
    setBusyState(false);
    if (!evalChallenger) {
      showInlineAlert("Digite uma palavra valida da lingua portuguesa.");
      return;
    }

    if (evalChallenger.word === gameState.champion.word) {
      highlightMissingInput(inputEl);
      showInlineAlert("A palavra " + evalChallenger.displayWord + " ja e a palavra mais proxima atual! Digite outra palavra.");
      return;
    }

    const alreadyTested = gameState.testedWords.find(function (t) {
      return t.word === evalChallenger.word;
    });
    if (alreadyTested) {
      highlightMissingInput(inputEl);
      showInlineAlert("Voce ja usou a palavra " + evalChallenger.displayWord + " nesta partida (" + alreadyTested.score.toFixed(1) + "%). Digite uma palavra nova!");
      return;
    }

    inputEl.value = "";
    processDuel(gameState.champion, evalChallenger);
    inputEl.focus();
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
      window.DUELO.Audio.victory();

      stats.gamesWon += 1;
      stats.totalRoundsPlayed += currentRound;
      if (stats.bestRounds === null || currentRound < stats.bestRounds) {
        stats.bestRounds = currentRound;
      }
      saveStats();
      renderVictoryState(winner, currentRound);
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
    renderStatsBar();
    renderSuggestionsChips();

    const round1Panel = qs("#panel-round-1");
    const roundNextPanel = qs("#panel-round-next");

    if (gameState.round === 1 && !gameState.champion) {
      round1Panel.classList.remove("hidden");
      roundNextPanel.classList.add("hidden");
    } else {
      round1Panel.classList.add("hidden");
      roundNextPanel.classList.remove("hidden");
      renderChampionSlot();
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
      headline = 'NA MOSCA! A palavra secreta era <strong>' + d.winner.displayWord + '</strong>!';
    } else if (d.round === 1) {
      headline = 'O programa escolheu <strong>' + d.winner.displayWord + '</strong>! Ela esta mais proxima da palavra secreta do que ' + d.loser.displayWord + '.';
    } else if (d.winnerSide === "right") {
      headline = 'NOVA CAMPEA! <strong>' + d.winner.displayWord + '</strong> (' + d.winner.score.toFixed(1) + '%) superou ' + d.loser.displayWord + ' (' + d.loser.score.toFixed(1) + '%) e assumiu a lideranca!';
    } else {
      headline = '<strong>' + d.winner.displayWord + '</strong> (' + d.winner.score.toFixed(1) + '%) continua mais proxima do que ' + d.loser.displayWord + ' (' + d.loser.score.toFixed(1) + '%). Tente outra palavra!';
    }

    box.innerHTML =
      '<div class="verdict-header">' +
        '<span class="tag-pill">Resultado da Rodada ' + d.round + '</span>' +
        '<p class="verdict-headline">' + headline + '</p>' +
      '</div>' +
      '<div class="verdict-cards-row">' +
        '<div class="verdict-mini-card ' + (d.winnerSide === "left" ? "is-winner" : "is-loser") + '">' +
          '<div class="flex justify-between items-center">' +
            '<span class="font-bold text-white">' + d.left.displayWord + leftCorrection + '</span>' +
            '<span class="font-mono font-bold">' + d.left.score.toFixed(1) + '%</span>' +
          '</div>' +
          '<div class="meter-track mt-1"><div class="meter-fill fill-' + d.left.tier + '" style="width:' + d.left.score + '%"></div></div>' +
          '<span class="text-xs text-zinc-400 mt-1">' + (d.winnerSide === "left" ? "ESCOLHIDA (Mais Proxima)" : "Menos proxima") + ' - ' + d.left.tierLabel + '</span>' +
        '</div>' +
        '<div class="verdict-vs-pill">VS</div>' +
        '<div class="verdict-mini-card ' + (d.winnerSide === "right" ? "is-winner" : "is-loser") + '">' +
          '<div class="flex justify-between items-center">' +
            '<span class="font-bold text-white">' + d.right.displayWord + rightCorrection + '</span>' +
            '<span class="font-mono font-bold">' + d.right.score.toFixed(1) + '%</span>' +
          '</div>' +
          '<div class="meter-track mt-1"><div class="meter-fill fill-' + d.right.tier + '" style="width:' + d.right.score + '%"></div></div>' +
          '<span class="text-xs text-zinc-400 mt-1">' + (d.winnerSide === "right" ? "ESCOLHIDA (Mais Proxima)" : "Menos proxima") + ' - ' + d.right.tierLabel + '</span>' +
        '</div>' +
      '</div>';
  }

  function renderVictoryState(winner, totalRounds) {
    const banner = qs("#victory-banner");
    if (!banner) return;
    const secretEntry = window.DUELO_DATA.WORDS[gameState.secretWord];
    const hintText = secretEntry ? secretEntry.hint : "";

    const chain = [];
    for (let i = gameState.history.length - 1; i >= 0; i--) {
      const w = gameState.history[i].winner.displayWord;
      if (chain.length === 0 || chain[chain.length - 1] !== w) {
        chain.push(w);
      }
    }

    banner.classList.remove("hidden");
    banner.innerHTML =
      '<div class="victory-celebration-card">' +
        '<span class="tag-pill">Palavra Secreta Descoberta!</span>' +
        '<h2 class="victory-word-heading">' + winner.displayWord + '</h2>' +
        '<p class="text-sm text-zinc-300 mt-1">' + hintText + '</p>' +
        '<p class="text-xs font-mono text-amber-300 mt-2">Voce chegou na resposta em ' + totalRounds + ' ' + (totalRounds === 1 ? 'rodada' : 'rodadas') + '!</p>' +
        '<div class="evolution-chain-box mt-3">' +
          '<span class="text-xs uppercase tracking-wider text-zinc-400">Trilha das Escolhas do Programa:</span>' +
          '<p class="font-mono text-sm text-emerald-400 mt-1">' + chain.join(" -> ") + '</p>' +
        '</div>' +
        '<div class="mt-4 flex flex-wrap justify-center gap-3">' +
          '<button type="button" id="btn-victory-next" class="btn-primary">Jogar Proxima Palavra</button>' +
        '</div>' +
      '</div>';

    const nextBtn = qs("#btn-victory-next");
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        startNewMatch();
      });
    }
  }

  function renderHistoryTimeline() {
    const container = qs("#duel-history-list");
    if (!container) return;

    if (gameState.history.length === 0) {
      container.innerHTML = '<div class="empty-box">Nenhuma rodada disputada ainda. Digite duas palavras acima para comecar!</div>';
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
          '<span class="history-winner-pill">Escolhida: ' + h.winner.displayWord + '</span>' +
        '</div>'
      );
    }).join("");
  }

  function renderProximityLeaderboard() {
    const listEl = qs("#tested-words-ranking");
    if (!listEl) return;

    if (gameState.testedWords.length === 0) {
      listEl.innerHTML = '<div class="empty-box">As palavras que voce testar ficarao listadas aqui por ordem de proximidade.</div>';
      return;
    }

    listEl.innerHTML = gameState.testedWords.map(function (item, idx) {
      const isChamp = gameState.champion && gameState.champion.word === item.word;
      return (
        '<div class="ranking-word-row ' + (isChamp ? "is-current-champ" : "") + '">' +
          '<div class="flex items-center gap-2">' +
            '<span class="ranking-pos">#' + (idx + 1) + '</span>' +
            '<span class="font-bold text-sm text-white">' + item.displayWord + '</span>' +
            (isChamp ? '<span class="champ-mini-tag">Mais Proxima</span>' : '') +
          '</div>' +
          '<div class="flex items-center gap-3">' +
            '<div class="ranking-mini-bar"><div class="meter-fill fill-' + item.tier + '" style="width:' + item.score + '%"></div></div>' +
            '<span class="font-mono text-xs font-bold text-amber-300 w-12 text-right">' + item.score.toFixed(1) + '%</span>' +
          '</div>' +
        '</div>'
      );
    }).join("");
  }

  function handleRequestHint() {
    if (gameState.isSolved) return;
    window.DUELO.Audio.hint();
    gameState.hintsUsed += 1;

    const secretEntry = window.DUELO_DATA.WORDS[gameState.secretWord] || {
      category: "Cotidiano",
      hint: "Palavra da lingua portuguesa.",
      links: []
    };

    const hintBox = qs("#hint-display-box");
    if (!hintBox) return;
    hintBox.classList.remove("hidden");

    const champScore = gameState.champion ? gameState.champion.score : 15;
    const bridge = window.DUELO.Engine.getBridgeHint(gameState.secretWord, champScore);

    let html = '<div class="space-y-1">';
    html += '<p class="text-xs font-semibold text-amber-300">DICA 1 (Tema & Tamanho): Categoria "' + secretEntry.category + '" | Possui ' + gameState.secretWord.length + ' letras.</p>';

    if (gameState.hintsUsed >= 2 && bridge) {
      html += '<p class="text-xs text-sky-300">DICA 2 (Palavra-Ponte Mais Proxima): Experimente testar <strong>' + bridge.displayWord + '</strong> (' + bridge.score.toFixed(1) + '%).</p>';
    }
    if (gameState.hintsUsed >= 3) {
      html += '<p class="text-xs text-emerald-400">DICA 3 (Definicao & Inicial): Comeca com a letra <strong>"' + gameState.secretWord.charAt(0).toUpperCase() + '"</strong> — ' + secretEntry.hint + '</p>';
    }
    html += '</div>';

    hintBox.innerHTML = html;
  }

  function handleGiveUpReveal() {
    if (gameState.isSolved) return;
    const evalExact = window.DUELO.Engine.calculateProximity(gameState.secretWord, gameState.secretWord);
    if (!evalExact) return;

    const left = gameState.champion || evalExact;
    processDuel(left, evalExact);
  }

  function showInlineAlert(msg) {
    const el = qs("#inline-alert-box");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
  }

  function hideInlineAlert() {
    const el = qs("#inline-alert-box");
    if (!el) return;
    el.classList.add("hidden");
  }

  function bindEvents() {
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
        startNewMatch();
      });
    }

    // Seletor de Modo: Treino Livre vs Palavra do Dia
    const modeSelect = qs("#select-game-mode");
    if (modeSelect) {
      modeSelect.addEventListener("change", function () {
        gameState.mode = modeSelect.value;
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
        const resolved = window.DUELO.Engine.resolveWord(rawWord);
        const cleanWord = resolved ? resolved.canonical : rawWord;

        const sampleKey = Object.keys(window.DUELO_DATA.WORDS).find(function (k) {
          return window.DUELO_DATA.WORDS[k].cluster === clusterKey;
        }) || "carro";
        const sample = window.DUELO_DATA.WORDS[sampleKey];

        const customLinks = rawLinks
          ? rawLinks.split(",").map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean)
          : sample.links.slice(0, 6);

        window.DUELO_DATA.WORDS[cleanWord] = {
          word: cleanWord,
          category: sample.category,
          cluster: clusterKey,
          sub: cleanWord,
          vec: sample.vec.slice(),
          links: customLinks,
          hint: rawHint || ("Palavra secreta personalizada na categoria " + sample.category + ".")
        };

        modalCustom.classList.add("hidden");
        formCustom.reset();
        startNewMatch(cleanWord);
      });
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
