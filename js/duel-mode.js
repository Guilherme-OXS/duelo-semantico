/**
 * ============================================================================
 * MODO DUELO 1v1 ONLINE P2P (WebRTC / PeerJS + BroadcastChannel + Bot IA)
 * Arquivo: js/duel-mode.js
 * ============================================================================
 * Arquitetura sem servidor proprio:
 * - O navegador do Host atua como autoridade da sala (guarda a palavra secreta
 *   e avalia todas as jogadas para evitar trapaças).
 * - Conecta jogadores na internet via WebRTC (PeerJS) ou entre abas locais
 *   via BroadcastChannel.
 * - Matchmaking com cronometro de 10s: se demorar para achar outro player,
 *   um Bot Estrategista entra automaticamente no Lado Direito!
 */
window.DUELO = window.DUELO || {};

window.DUELO.DuelMode = (function () {
  const QUEUE_PREFIX = "duelo-sem-fila-v1-";
  const ROOM_PREFIX = "duelo-sem-sala-v1-";
  const BC_CHANNEL_NAME = "duelo_semantico_local_p2p";

  let peer = null;
  let conn = null;
  let bc = null;
  let searchTimer = null;
  let searchCountdown = 10;
  let turnTimer = null;

  let state = {
    phase: "lobby", // "lobby" | "searching" | "waiting_room" | "playing" | "finished"
    role: "host",   // "host" | "guest"
    isBot: false,
    roomCode: "",
    turnDuration: 30, // 30s nas partidas normais; personalizavel em salas privadas (0 = sem limite)
    turnRemaining: 30,
    myName: "Voce",
    oppName: "Adversario",
    secretWord: "",
    round: 1,
    champion: null, // { word, displayWord, score, tier, tierLabel, ownerRole, ownerName }
    myPendingWord: null,
    oppPendingWord: null,
    myReady: false,
    oppReady: false,
    scores: { host: 0, guest: 0 },
    usedWords: [],
    history: [],
    winnerRole: null,
    revealedSecret: null
  };

  function qs(sel) { return document.querySelector(sel); }
  function qsa(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function init() {
    bindEvents();
    checkUrlRoomParam();
    render();
  }

  function checkUrlRoomParam() {
    try {
      const params = new URLSearchParams(window.location.search);
      const sala = params.get("sala");
      if (sala && sala.trim()) {
        // Abre automaticamente a aba de Duelo e preenche o codigo da sala
        if (window.DUELO.SwitchTab) {
          window.DUELO.SwitchTab("duel");
        }
        const codeInput = qs("#duel-join-code");
        if (codeInput) codeInput.value = sala.trim().toUpperCase();
        joinRoomByCode(sala.trim().toUpperCase());
      }
    } catch (e) {}
  }

  function generateShortCode() {
    const num = Math.floor(1000 + Math.random() * 9000);
    return "AET-" + num;
  }

  function stopTurnTimer() {
    if (turnTimer) {
      clearInterval(turnTimer);
      turnTimer = null;
    }
  }

  function updateTurnTimerUI() {
    const el = qs("#duel-turn-timer");
    if (!el) return;
    if (!state.turnDuration || state.turnDuration <= 0) {
      el.textContent = "Sem limite";
      el.className = "duel-timer-pill";
      return;
    }
    el.textContent = state.turnRemaining + "s";
    if (state.turnRemaining <= 5) {
      el.className = "duel-timer-pill is-danger";
    } else if (state.turnRemaining <= 10) {
      el.className = "duel-timer-pill is-warning";
    } else {
      el.className = "duel-timer-pill";
    }
  }

  function startTurnTimer() {
    stopTurnTimer();
    if (state.phase !== "playing" || !state.turnDuration || state.turnDuration <= 0) {
      state.turnRemaining = 0;
      updateTurnTimerUI();
      return;
    }
    state.turnRemaining = state.turnDuration;
    updateTurnTimerUI();

    turnTimer = setInterval(function () {
      if (state.phase !== "playing") {
        stopTurnTimer();
        return;
      }
      state.turnRemaining = Math.max(0, state.turnRemaining - 1);
      updateTurnTimerUI();

      if (state.turnRemaining <= 0) {
        stopTurnTimer();
        if (state.role === "host") {
          handleTurnTimeoutOnHost();
        }
      }
    }, 1000);
  }

  function cleanupConnections() {
    stopTurnTimer();
    if (searchTimer) {
      clearInterval(searchTimer);
      searchTimer = null;
    }
    if (conn) {
      try { conn.close(); } catch (e) {}
      conn = null;
    }
    if (peer) {
      try { peer.destroy(); } catch (e) {}
      peer = null;
    }
    if (bc) {
      try { bc.close(); } catch (e) {}
      bc = null;
    }
  }

  function pickSecretWordForDuel() {
    const pool = (window.DUELO_DATA && window.DUELO_DATA.SECRET_POOL) || ["carro", "casa", "agua", "vida"];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function getMyNickname() {
    const inp = qs("#duel-player-name");
    const val = inp ? inp.value.trim() : "";
    return val || "Jogador";
  }

  // ==========================================================================
  // 1. TRANSPORTE P2P (PeerJS WebRTC + BroadcastChannel para abas locais)
  // ==========================================================================
  function setupBroadcastChannel(roomId) {
    if (!("BroadcastChannel" in window)) return;
    bc = new BroadcastChannel(BC_CHANNEL_NAME + "_" + roomId);
    bc.onmessage = function (ev) {
      if (ev && ev.data) {
        handleIncomingMessage(ev.data, "bc");
      }
    };
  }

  function sendToOpponent(payload) {
    if (state.isBot) return;
    if (conn && conn.open) {
      try { conn.send(payload); } catch (e) {}
    }
    if (bc) {
      try { bc.postMessage(Object.assign({ _senderRole: state.role }, payload)); } catch (e) {}
    }
  }

  function handleIncomingMessage(msg, transport) {
    if (!msg || !msg.type) return;
    if (transport === "bc" && msg._senderRole === state.role) return;

    if (msg.type === "hello_guest" && state.role === "host") {
      // Guest entrou na sala! Para o cronometro de busca e inicia partida
      if (searchTimer) {
        clearInterval(searchTimer);
        searchTimer = null;
      }
      state.isBot = false;
      state.oppName = msg.name || "Desafiante";
      state.phase = "playing";
      resetMatchData(true);

      sendToOpponent({
        type: "match_start",
        hostName: state.myName,
        roomCode: state.roomCode,
        turnDuration: state.turnDuration
      });
      window.DUELO.Audio.newChampion();
      startTurnTimer();
      render();
    } else if (msg.type === "match_start" && state.role === "guest") {
      if (searchTimer) {
        clearInterval(searchTimer);
        searchTimer = null;
      }
      state.isBot = false;
      state.oppName = msg.hostName || "Anfitriao";
      state.turnDuration = typeof msg.turnDuration === "number" ? msg.turnDuration : 30;
      state.phase = "playing";
      resetMatchData(false);
      window.DUELO.Audio.newChampion();
      startTurnTimer();
      render();
    } else if (msg.type === "submit_word" && state.role === "host") {
      // Guest enviou a palavra dele
      if (state.phase !== "playing" || state.oppReady) return;
      state.oppPendingWord = msg.word;
      state.oppReady = true;
      render();
      tryResolveRoundOnHost();
    } else if (msg.type === "opp_ready_ack" && state.role === "guest") {
      state.oppReady = true;
      render();
    } else if (msg.type === "round_result" && state.role === "guest") {
      applyRoundResultFromHost(msg);
    } else if (msg.type === "round_timeout_skip" && state.role === "guest") {
      applyTimeoutSkip(msg.round);
    } else if (msg.type === "duel_error" && state.role === "guest") {
      showDuelAlert(msg.message);
      state.myReady = false;
      state.myPendingWord = null;
      render();
    } else if (msg.type === "rematch_request") {
      if (state.role === "host") {
        resetMatchData(true);
        sendToOpponent({
          type: "match_start",
          hostName: state.myName,
          roomCode: state.roomCode,
          turnDuration: state.turnDuration
        });
        startTurnTimer();
        render();
      }
    }
  }

  function resetMatchData(isHost) {
    state.round = 1;
    state.champion = null;
    state.myPendingWord = null;
    state.oppPendingWord = null;
    state.myReady = false;
    state.oppReady = false;
    state.scores = { host: 0, guest: 0 };
    state.usedWords = [];
    state.history = [];
    state.winnerRole = null;
    state.revealedSecret = null;
    state.secretWord = isHost ? pickSecretWordForDuel() : "";
  }

  // ==========================================================================
  // 2. CRIAR SALA, ENTRAR POR CODIGO & MATCHMAKING COM FALLBACK PARA BOT
  // ==========================================================================
  function createPrivateRoom() {
    cleanupConnections();
    const limitSel = qs("#duel-room-time-limit");
    const customSec = limitSel ? parseInt(limitSel.value, 10) : 30;
    state.myName = getMyNickname();
    state.role = "host";
    state.isBot = false;
    state.turnDuration = isNaN(customSec) ? 30 : customSec;
    state.roomCode = generateShortCode();
    state.phase = "waiting_room";
    resetMatchData(true);

    const peerId = ROOM_PREFIX + state.roomCode;
    setupBroadcastChannel(state.roomCode);

    if (typeof window.Peer !== "undefined") {
      try {
        peer = new window.Peer(peerId);
        peer.on("connection", function (incomingConn) {
          conn = incomingConn;
          conn.on("data", function (data) { handleIncomingMessage(data, "peer"); });
          conn.on("close", function () { handleOpponentDisconnect(); });
        });
        peer.on("error", function () {
          // Mantem sala funcionando via BroadcastChannel ou Bot
        });
      } catch (e) {}
    }

    render();
  }

  function joinRoomByCode(rawCode) {
    const code = (rawCode || "").trim().toUpperCase();
    if (!code) {
      showDuelAlert("Digite o codigo da sala (ex: AET-4821) para entrar.");
      return;
    }

    cleanupConnections();
    state.myName = getMyNickname();
    state.role = "guest";
    state.isBot = false;
    state.roomCode = code;
    state.phase = "searching";
    state.oppName = "Conectando...";

    const targetPeerId = ROOM_PREFIX + code;
    setupBroadcastChannel(code);

    // Tenta conectar via BroadcastChannel primeiro (mesmo navegador/PC)
    sendToOpponent({ type: "hello_guest", name: state.myName });

    if (typeof window.Peer !== "undefined") {
      try {
        peer = new window.Peer();
        peer.on("open", function () {
          conn = peer.connect(targetPeerId, { reliable: true });
          conn.on("open", function () {
            sendToOpponent({ type: "hello_guest", name: state.myName });
          });
          conn.on("data", function (data) { handleIncomingMessage(data, "peer"); });
          conn.on("close", function () { handleOpponentDisconnect(); });
        });
        peer.on("error", function () {
          showDuelAlert("Sala nao encontrada ou bloqueada pela rede. Voce pode criar uma sala ou enfrentar o Bot!");
          state.phase = "lobby";
          render();
        });
      } catch (e) {}
    }

    // Timeout de 8s caso nao encontre o Host
    searchCountdown = 8;
    searchTimer = setInterval(function () {
      searchCountdown -= 1;
      const cdEl = qs("#duel-search-countdown");
      if (cdEl) cdEl.textContent = searchCountdown + "s";
      if (searchCountdown <= 0) {
        clearInterval(searchTimer);
        searchTimer = null;
        if (state.phase === "searching") {
          showDuelAlert("Nao foi possivel conectar a sala " + code + ". Tente novamente ou jogue contra o Bot!");
          cleanupConnections();
          state.phase = "lobby";
          render();
        }
      }
    }, 1000);

    render();
  }

  function startQuickMatchmaking() {
    cleanupConnections();
    state.myName = getMyNickname();
    state.phase = "searching";
    state.isBot = false;
    state.oppName = "Procurando adversario...";
    searchCountdown = 10;

    const queueId = QUEUE_PREFIX + "slot1";
    setupBroadcastChannel("QUEUE_SLOT1");

    // Primeiro tenta entrar como Guest se ja houver um Host esperando na fila
    let becameHost = false;

    function startWaitAsHost() {
      if (becameHost) return;
      becameHost = true;
      state.role = "host";
      state.turnDuration = 30; // Partidas normais usam 30 segundos
      state.roomCode = "FILA-RAPIDA";
      resetMatchData(true);

      if (typeof window.Peer !== "undefined") {
        try {
          if (peer) peer.destroy();
          peer = new window.Peer(queueId);
          peer.on("connection", function (incomingConn) {
            conn = incomingConn;
            conn.on("data", function (data) { handleIncomingMessage(data, "peer"); });
            conn.on("close", function () { handleOpponentDisconnect(); });
          });
        } catch (e) {}
      }
    }

    if (typeof window.Peer !== "undefined") {
      try {
        peer = new window.Peer();
        peer.on("open", function () {
          const probe = peer.connect(queueId, { reliable: true });
          let connected = false;
          probe.on("open", function () {
            connected = true;
            conn = probe;
            state.role = "guest";
            state.roomCode = "FILA-RAPIDA";
            conn.on("data", function (data) { handleIncomingMessage(data, "peer"); });
            conn.on("close", function () { handleOpponentDisconnect(); });
            sendToOpponent({ type: "hello_guest", name: state.myName });
          });
          setTimeout(function () {
            if (!connected && state.phase === "searching") {
              try { probe.close(); } catch (e) {}
              startWaitAsHost();
            }
          }, 1600);
        });
        peer.on("error", function () {
          startWaitAsHost();
        });
      } catch (e) {
        startWaitAsHost();
      }
    } else {
      startWaitAsHost();
    }

    // Tambem anuncia na aba local via BroadcastChannel
    bc.postMessage({ _senderRole: "guest", type: "hello_guest", name: state.myName });

    searchTimer = setInterval(function () {
      searchCountdown -= 1;
      const cdEl = qs("#duel-search-countdown");
      if (cdEl) cdEl.textContent = searchCountdown + "s";
      if (searchCountdown <= 0) {
        clearInterval(searchTimer);
        searchTimer = null;
        if (state.phase === "searching") {
          startMatchAgainstBot();
        }
      }
    }, 1000);

    render();
  }

  function startMatchAgainstBot() {
    cleanupConnections();
    state.myName = getMyNickname();
    state.role = "host";
    state.isBot = true;
    state.turnDuration = 30; // Partidas normais contra Bot usam 30 segundos
    state.oppName = "Bot Estrategista";
    state.roomCode = "ARENA-BOT";
    state.phase = "playing";
    resetMatchData(true);
    window.DUELO.Audio.newChampion();
    startTurnTimer();
    render();
  }

  function handleOpponentDisconnect() {
    if (state.phase === "playing") {
      showDuelAlert("O adversario desconectou. Voce pode continuar contra o Bot Estrategista ou voltar ao lobby!");
      state.isBot = true;
      state.oppName = "Bot Estrategista (Substituto)";
      if (state.role === "guest") {
        // Promove o cliente para finalizar contra o bot
        state.role = "host";
        if (!state.secretWord) state.secretWord = pickSecretWordForDuel();
      }
      render();
      if (state.myReady && !state.oppReady) {
        triggerBotMove();
      }
    }
  }

  // ==========================================================================
  // 3. JOGABILIDADE DAS RODADAS & IA DO BOT
  // ==========================================================================
  async function submitMyDuelWord(ev) {
    if (ev) ev.preventDefault();
    if (state.phase !== "playing" || state.myReady) return;

    const inp = qs("#duel-my-word-input");
    const raw = (inp ? inp.value : "").trim();
    if (!raw) {
      showDuelAlert("Digite uma palavra em portugues para enviar ao duelo!");
      return;
    }

    const resolvedCheck = window.DUELO.Engine.resolveWord(raw, false);
    if (state.usedWords.indexOf(resolvedCheck.canonical) !== -1) {
      showDuelAlert("A palavra '" + resolvedCheck.canonical.toUpperCase() + "' ja foi usada nesta partida!");
      return;
    }

    hideDuelAlert();
    state.myReady = true;
    state.myPendingWord = raw;
    if (inp) inp.value = "";
    render();

    if (state.role === "guest") {
      sendToOpponent({ type: "submit_word", word: raw });
    } else {
      sendToOpponent({ type: "opp_ready_ack" });
      if (state.isBot && !state.oppReady) {
        triggerBotMove();
      } else {
        await tryResolveRoundOnHost();
      }
    }
  }

  function triggerBotMove() {
    setTimeout(async function () {
      if (state.phase !== "playing" || state.oppReady) return;
      const botWord = chooseSmartBotWord();
      state.oppPendingWord = botWord;
      state.oppReady = true;
      render();
      await tryResolveRoundOnHost();
    }, 1150);
  }

  function chooseSmartBotWord() {
    const pool = (window.DUELO_DATA && window.DUELO_DATA.SECRET_POOL) || [];
    const available = pool.filter(function (w) {
      return state.usedWords.indexOf(w) === -1 && w !== state.myPendingWord;
    });
    if (available.length === 0) return "tempo";

    // Nas rodadas iniciais, o Bot joga de forma equilibrada sem saber a resposta exata
    const scored = available.map(function (w) {
      return {
        word: w,
        score: window.DUELO.Engine.calculateProximity(w, state.secretWord, false).score
      };
    }).sort(function (a, b) { return a.score - b.score; });

    const champScore = state.champion ? state.champion.score : 15;
    if (state.round === 1) {
      const idx = Math.floor(Math.random() * Math.min(scored.length, Math.floor(scored.length * 0.7)));
      return scored[idx].word;
    }

    // Nas rodadas seguintes, tenta achar algo perto ou um pouco acima do trono atual (sem roubar acertando 100% logo no inicio)
    const nonExact = scored.filter(function (item) {
      if (state.round < 5 && item.score >= 100) return false;
      return true;
    });
    const aboveChamp = nonExact.filter(function (item) {
      return item.score > champScore && item.score <= champScore + 28;
    });

    if (aboveChamp.length > 0 && Math.random() < 0.72) {
      return aboveChamp[Math.floor(Math.random() * aboveChamp.length)].word;
    }

    const midPool = nonExact.slice(Math.floor(nonExact.length * 0.35));
    const pick = midPool[Math.floor(Math.random() * midPool.length)] || scored[0];
    return pick.word;
  }

  function createTimeoutEval() {
    return {
      word: "tempo-esgotado",
      displayWord: "TEMPO ESGOTADO",
      originalInput: "",
      correctedFrom: null,
      category: "Tempo Esgotado",
      source: "timeout",
      score: 0.0,
      isExact: false,
      isTimeout: true,
      tier: "cold",
      tierLabel: "Nao respondeu a tempo",
      explanation: "Tempo da rodada esgotado."
    };
  }

  async function handleTurnTimeoutOnHost() {
    if (state.role !== "host" || state.phase !== "playing") return;

    if (!state.myReady && !state.oppReady) {
      // Nenhum dos dois respondeu: avanca a rodada sem pontuar
      sendToOpponent({ type: "round_timeout_skip", round: state.round });
      applyTimeoutSkip(state.round);
      return;
    }

    const myEval = state.myReady
      ? await window.DUELO.Engine.evaluateWordAsync(state.myPendingWord, state.secretWord)
      : createTimeoutEval();

    const oppEval = state.oppReady
      ? await window.DUELO.Engine.evaluateWordAsync(state.oppPendingWord, state.secretWord)
      : createTimeoutEval();

    await resolveRoundWithEvals(myEval, oppEval);
  }

  function applyTimeoutSkip(roundNum) {
    state.myReady = false;
    state.oppReady = false;
    state.myPendingWord = null;
    state.oppPendingWord = null;
    state.round += 1;
    showDuelAlert("Tempo da rodada " + roundNum + " esgotado! Ninguem enviou palavra. Nova rodada iniciada!");
    startTurnTimer();
    render();
  }

  async function tryResolveRoundOnHost() {
    if (state.role !== "host" || !state.myReady || !state.oppReady) return;
    stopTurnTimer();

    const myEval = await window.DUELO.Engine.evaluateWordAsync(state.myPendingWord, state.secretWord);
    const oppEval = await window.DUELO.Engine.evaluateWordAsync(state.oppPendingWord, state.secretWord);

    await resolveRoundWithEvals(myEval, oppEval);
  }

  async function resolveRoundWithEvals(myEval, oppEval) {
    if (!myEval || !oppEval) return;
    stopTurnTimer();

    const hostWonRound = myEval.score >= oppEval.score;
    const roundBest = hostWonRound ? myEval : oppEval;
    const roundBestOwner = hostWonRound ? "host" : "guest";
    const roundBestName = hostWonRound ? state.myName : state.oppName;

    if (!myEval.isTimeout && state.usedWords.indexOf(myEval.word) === -1) state.usedWords.push(myEval.word);
    if (!oppEval.isTimeout && state.usedWords.indexOf(oppEval.word) === -1) state.usedWords.push(oppEval.word);

    let newChampion = state.champion;
    let throneChanged = false;

    if (!roundBest.isTimeout && (!newChampion || roundBest.score >= newChampion.score)) {
      throneChanged = !newChampion || newChampion.word !== roundBest.word;
      newChampion = {
        word: roundBest.word,
        displayWord: roundBest.displayWord,
        score: roundBest.score,
        tier: roundBest.tier,
        tierLabel: roundBest.tierLabel,
        explanation: roundBest.explanation,
        ownerRole: roundBestOwner,
        ownerName: roundBestName
      };
    }

    if (hostWonRound && !myEval.isTimeout) state.scores.host += 1;
    else if (!hostWonRound && !oppEval.isTimeout) state.scores.guest += 1;

    let finished = false;
    let winnerRole = null;
    if (myEval.isExact || oppEval.isExact) {
      finished = true;
      winnerRole = myEval.isExact ? "host" : "guest";
    }

    const roundEntry = {
      round: state.round,
      hostWord: myEval,
      guestWord: oppEval,
      roundWinnerRole: roundBestOwner,
      throneWord: newChampion ? newChampion.displayWord : "--",
      throneScore: newChampion ? newChampion.score : 0
    };

    const payload = {
      type: "round_result",
      round: state.round,
      hostEval: myEval,
      guestEval: oppEval,
      champion: newChampion,
      throneChanged: throneChanged,
      scores: state.scores,
      usedWords: state.usedWords,
      roundEntry: roundEntry,
      finished: finished,
      winnerRole: winnerRole,
      revealedSecret: finished ? state.secretWord.toUpperCase() : null
    };

    sendToOpponent(payload);
    applyRoundResultState(payload, true);
  }

  function applyRoundResultFromHost(msg) {
    applyRoundResultState(msg, false);
  }

  function applyRoundResultState(payload, isHostPerspective) {
    state.champion = payload.champion;
    state.scores = payload.scores;
    state.usedWords = payload.usedWords || [];
    state.history.unshift(payload.roundEntry);
    state.myReady = false;
    state.oppReady = false;
    state.myPendingWord = null;
    state.oppPendingWord = null;

    if (payload.finished) {
      stopTurnTimer();
      state.phase = "finished";
      state.winnerRole = payload.winnerRole;
      state.revealedSecret = payload.revealedSecret;
      if (state.winnerRole === state.role) {
        window.DUELO.Audio.victory();
      } else {
        window.DUELO.Audio.championKept();
      }
    } else {
      state.round += 1;
      if (payload.throneChanged) window.DUELO.Audio.newChampion();
      else window.DUELO.Audio.championKept();
      startTurnTimer();
    }

    render();

    const inp = qs("#duel-my-word-input");
    if (inp && state.phase === "playing") inp.focus();
  }

  // ==========================================================================
  // 4. RENDERIZACAO DA ABA DE DUELO
  // ==========================================================================
  function render() {
    const lobbyPanel = qs("#duel-phase-lobby");
    const searchPanel = qs("#duel-phase-searching");
    const arenaPanel = qs("#duel-phase-arena");
    if (!lobbyPanel || !searchPanel || !arenaPanel) return;

    lobbyPanel.classList.toggle("hidden", state.phase !== "lobby");
    searchPanel.classList.toggle("hidden", state.phase !== "searching" && state.phase !== "waiting_room");
    arenaPanel.classList.toggle("hidden", state.phase !== "playing" && state.phase !== "finished");

    if (state.phase === "waiting_room" || state.phase === "searching") {
      renderWaitingOrSearching();
    } else if (state.phase === "playing" || state.phase === "finished") {
      renderArena();
    }
  }

  function renderWaitingOrSearching() {
    const titleEl = qs("#duel-wait-title");
    const descEl = qs("#duel-wait-desc");
    const codeBadge = qs("#duel-room-code-display");
    const copyBtn = qs("#btn-duel-copy-link");

    if (state.phase === "waiting_room") {
      const timeDesc = state.turnDuration > 0 ? state.turnDuration + "s por rodada" : "Sem limite de tempo";
      if (titleEl) titleEl.textContent = "Sala Privada Aberta (" + timeDesc + ")";
      if (descEl) descEl.textContent = "Envie o codigo ou o link abaixo para seu amigo entrar no Lado Direito — ou clique em 'Enfrentar Bot Agora'.";
      if (codeBadge) {
        codeBadge.textContent = state.roomCode;
        codeBadge.classList.remove("hidden");
      }
      if (copyBtn) copyBtn.classList.remove("hidden");
    } else {
      if (titleEl) titleEl.textContent = "Procurando Oponente Online...";
      if (descEl) descEl.innerHTML = 'Buscando outro jogador na fila... Se ninguem aparecer em <strong id="duel-search-countdown" class="text-amber-300 font-mono">' + searchCountdown + 's</strong>, o <strong>Bot Estrategista</strong> entra automaticamente!';
      if (codeBadge) codeBadge.classList.add("hidden");
      if (copyBtn) copyBtn.classList.add("hidden");
    }
  }

  function renderArena() {
    const myScore = state.role === "host" ? state.scores.host : state.scores.guest;
    const oppScore = state.role === "host" ? state.scores.guest : state.scores.host;

    qs("#duel-my-label").textContent = state.myName + " (Voce)";
    qs("#duel-opp-label").textContent = state.oppName;
    qs("#duel-my-score").textContent = myScore + " pts";
    qs("#duel-opp-score").textContent = oppScore + " pts";
    qs("#duel-round-badge").textContent = "Rodada " + state.round;
    updateTurnTimerUI();

    // Estado de espera de cada lado
    const myStatus = qs("#duel-my-status");
    const oppStatus = qs("#duel-opp-status");
    const myInput = qs("#duel-my-word-input");
    const myBtn = qs("#btn-duel-send-word");

    if (state.phase === "finished") {
      if (myInput) myInput.disabled = true;
      if (myBtn) myBtn.disabled = true;
    } else {
      if (myInput) myInput.disabled = state.myReady;
      if (myBtn) myBtn.disabled = state.myReady;
    }

    if (myStatus) {
      myStatus.textContent = state.myReady ? "Palavra enviada! Aguardando " + state.oppName + "..." : "Sua vez: digite uma palavra.";
    }
    if (oppStatus) {
      if (state.oppReady) {
        oppStatus.textContent = state.oppName + " ja enviou a palavra!";
        oppStatus.className = "text-xs font-semibold text-emerald-400";
      } else {
        oppStatus.textContent = state.oppName + " esta pensando...";
        oppStatus.className = "text-xs text-zinc-400";
      }
    }

    // Trono Central (Palavra Mais Proxima Atual)
    const throneBox = qs("#duel-throne-card");
    if (throneBox) {
      if (!state.champion) {
        throneBox.innerHTML = '<span class="text-xs text-zinc-400">Trono Vazio — A primeira rodada decide quem comeca na lideranca!</span>';
      } else {
        const ch = state.champion;
        throneBox.innerHTML =
          '<div class="flex justify-between items-center">' +
            '<span class="text-xs font-bold uppercase tracking-wider text-amber-300">No Trono (Lider: ' + ch.ownerName + ')</span>' +
            '<span class="temp-badge tier-' + ch.tier + '">' + ch.tierLabel + '</span>' +
          '</div>' +
          '<div class="champion-word-display">' + ch.displayWord + ' <span class="font-mono text-base text-amber-300">(' + ch.score.toFixed(1) + '%)</span></div>' +
          '<div class="meter-track"><div class="meter-fill fill-' + ch.tier + '" style="width:' + ch.score + '%"></div></div>';
      }
    }

    // Banner de Fim de Duelo
    const finishBox = qs("#duel-finish-banner");
    if (finishBox) {
      if (state.phase === "finished") {
        const iWon = state.winnerRole === state.role;
        finishBox.classList.remove("hidden");
        finishBox.innerHTML =
          '<div class="victory-celebration-card">' +
            '<span class="editorial-kicker">' + (iWon ? "Vitória no Duelo" : "Fim do Duelo") + '</span>' +
            '<h3 class="victory-word-heading">' + (state.revealedSecret || "") + '</h3>' +
            '<p class="text-sm text-zinc-300 mt-1">' +
              (iWon ? "Parabéns! Você acertou a palavra secreta antes de " + state.oppName + "." : state.oppName + " acertou a palavra secreta primeiro.") +
            '</p>' +
            '<div class="mt-4 flex flex-wrap justify-center gap-3">' +
              '<button type="button" id="btn-duel-rematch" class="btn-primary">Jogar Revanche</button>' +
              '<button type="button" id="btn-duel-back-lobby" class="btn-secondary">Voltar ao Início</button>' +
            '</div>' +
          '</div>';

        const btnRematch = qs("#btn-duel-rematch");
        if (btnRematch) {
          btnRematch.addEventListener("click", function () {
            if (state.isBot) {
              startMatchAgainstBot();
            } else if (state.role === "host") {
              resetMatchData(true);
              sendToOpponent({
                type: "match_start",
                hostName: state.myName,
                roomCode: state.roomCode,
                turnDuration: state.turnDuration
              });
              startTurnTimer();
              render();
            } else {
              sendToOpponent({ type: "rematch_request" });
              showDuelAlert("Pedido de revanche enviado para o anfitriao!");
            }
          });
        }
        const btnLobby = qs("#btn-duel-back-lobby");
        if (btnLobby) {
          btnLobby.addEventListener("click", leaveDuelToLobby);
        }
      } else {
        finishBox.classList.add("hidden");
      }
    }

    // Historico do Duelo
    const histEl = qs("#duel-pvp-history");
    if (histEl) {
      if (state.history.length === 0) {
        histEl.innerHTML = '<div class="empty-box">As jogadas dos dois lados aparecem aqui assim que ambos enviarem na rodada!</div>';
      } else {
        histEl.innerHTML = state.history.map(function (h) {
          const leftW = state.role === "host" ? h.hostWord : h.guestWord;
          const rightW = state.role === "host" ? h.guestWord : h.hostWord;
          const iWonR = h.roundWinnerRole === state.role;
          return (
            '<div class="history-duel-row">' +
              '<span class="history-round-tag">R' + h.round + '</span>' +
              '<div class="history-pair">' +
                '<span class="' + (iWonR ? "is-win-word" : "is-lose-word") + '">' + state.myName + ': ' + leftW.displayWord + ' (' + leftW.score.toFixed(1) + '%)</span>' +
                '<span class="text-xs text-zinc-500">vs</span>' +
                '<span class="' + (!iWonR ? "is-win-word" : "is-lose-word") + '">' + state.oppName + ': ' + rightW.displayWord + ' (' + rightW.score.toFixed(1) + '%)</span>' +
              '</div>' +
              '<span class="history-winner-pill">Trono: ' + h.throneWord + ' (' + h.throneScore.toFixed(0) + '%)</span>' +
            '</div>'
          );
        }).join("");
      }
    }
  }

  function leaveDuelToLobby() {
    cleanupConnections();
    state.phase = "lobby";
    hideDuelAlert();
    render();
  }

  function showDuelAlert(msg) {
    const el = qs("#duel-alert-box");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
  }

  function hideDuelAlert() {
    const el = qs("#duel-alert-box");
    if (!el) return;
    el.classList.add("hidden");
  }

  function bindEvents() {
    const btnQuick = qs("#btn-duel-quick-match");
    if (btnQuick) btnQuick.addEventListener("click", startQuickMatchmaking);

    const btnCreate = qs("#btn-duel-create-room");
    if (btnCreate) btnCreate.addEventListener("click", createPrivateRoom);

    const btnJoin = qs("#btn-duel-join-room");
    if (btnJoin) {
      btnJoin.addEventListener("click", function () {
        const code = qs("#duel-join-code").value;
        joinRoomByCode(code);
      });
    }

    const btnBotNow = qs("#btn-duel-force-bot");
    if (btnBotNow) btnBotNow.addEventListener("click", startMatchAgainstBot);

    const btnWaitBot = qs("#btn-duel-wait-bot");
    if (btnWaitBot) btnWaitBot.addEventListener("click", startMatchAgainstBot);

    const btnCancelSearch = qs("#btn-duel-cancel-wait");
    if (btnCancelSearch) btnCancelSearch.addEventListener("click", leaveDuelToLobby);

    const btnLeaveArena = qs("#btn-duel-leave-arena");
    if (btnLeaveArena) btnLeaveArena.addEventListener("click", leaveDuelToLobby);

    const btnCopy = qs("#btn-duel-copy-link");
    if (btnCopy) {
      btnCopy.addEventListener("click", function () {
        const base = window.location.origin + window.location.pathname;
        const shareUrl = base + "?sala=" + encodeURIComponent(state.roomCode);
        const inviteMsg = "Bora jogar Duelo Semântico 1v1? Entra na minha sala (" + state.roomCode + "): " + shareUrl;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(inviteMsg).then(function () {
            btnCopy.textContent = "Convite Copiado!";
            setTimeout(function () { btnCopy.textContent = "Copiar Convite para Amigos"; }, 2200);
          }).catch(function () {});
        }
      });
    }

    const formSubmit = qs("#form-duel-turn");
    if (formSubmit) formSubmit.addEventListener("submit", submitMyDuelWord);
  }

  return {
    init: init
  };
})();
