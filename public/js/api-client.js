/**
 * ============================================================================
 * CLIENTE SEGURO DA API SERVERLESS (/api/game) COM FALLBACK PORTATIL OFFLINE
 * ============================================================================
 * - Em producao (Vercel), todas as palavras secretas e calculos acontecem
 *   exclusivamente no servidor (/api/game), impedindo leitura via F12.
 * - Em uso local offline (Iniciar-Jogo.bat / file:// / localhost sem API),
 *   ativa automaticamente o motor local offline.
 */
window.DUELO = window.DUELO || {};

window.DUELO.Api = (function () {
  const loc = (typeof window !== "undefined" && window.location) || { protocol: "file:", hostname: "" };
  const isFile = loc.protocol === "file:";
  const isLocalHost = /^(localhost|127\.0\.0\.1)$/i.test(loc.hostname || "");

  // Em hospedagem real (https://*.vercel.app), nunca rebaixa para segredos locais
  let backendMode = isFile ? "offline" : (isLocalHost ? "unknown" : "required");
  let lastServerDateInfo = null;

  function isOfflineFallback() {
    return backendMode === "offline";
  }

  function isHostedStrict() {
    return backendMode === "required" || backendMode === "online";
  }

  function getServerDateInfo() {
    return lastServerDateInfo;
  }

  async function postApi(payload) {
    if (backendMode === "offline") {
      return null;
    }

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(function () { controller.abort(); }, 12000) : null;

    try {
      const res = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller ? controller.signal : undefined
      });
      if (timeoutId) clearTimeout(timeoutId);

      const hasBackendHeader = res.headers && typeof res.headers.get === "function" && res.headers.get("x-duelo-backend") === "1";

      // Em localhost (python -m http.server), POST retorna 404/501 sem X-Duelo-Backend -> ativa fallback offline
      if (!hasBackendHeader && (res.status === 404 || res.status === 405 || res.status === 501)) {
        if (isLocalHost) {
          backendMode = "offline";
          return null;
        }
        throw new Error("Servidor do jogo indisponível neste momento.");
      }

      let data = null;
      try {
        data = await res.json();
      } catch (parseErr) {
        if (isLocalHost && backendMode === "unknown") {
          backendMode = "offline";
          return null;
        }
        throw new Error("Resposta inválida do servidor.");
      }

      if (hasBackendHeader || (data && (data.backend === "vercel" || data.ok === true))) {
        backendMode = "online";
      }

      if (data && data.dateKey) {
        lastServerDateInfo = {
          dateKey: data.dateKey,
          nextDailyAtMs: data.nextDailyAtMs || null
        };
      }

      if (!res.ok || !data || data.ok === false) {
        throw new Error((data && data.error) || "Erro ao consultar o servidor.");
      }

      return data;
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);

      // Se estava apenas sondando em localhost (sem backend Node/Vercel), usa modo offline
      if (isLocalHost && backendMode === "unknown") {
        backendMode = "offline";
        return null;
      }

      if (err && err.name === "AbortError") {
        throw new Error("O servidor demorou para responder. Tente novamente.");
      }
      throw err instanceof Error ? err : new Error("Falha de conexão com o servidor.");
    }
  }

  return {
    isOfflineFallback: isOfflineFallback,
    isHostedStrict: isHostedStrict,
    getServerDateInfo: getServerDateInfo,
    ping: function () {
      return postApi({ action: "ping" });
    },
    startMatch: function (opts) {
      return postApi(Object.assign({ action: "start" }, opts || {}));
    },
    evaluateWords: function (matchToken, words) {
      return postApi({ action: "evaluate", matchToken: matchToken, words: words });
    },
    requestHint: function (matchToken, hintLevel, champScore, excludeWords) {
      return postApi({ action: "hint", matchToken: matchToken, hintLevel: hintLevel, champScore: champScore, excludeWords: excludeWords });
    },
    revealSecret: function (matchToken) {
      return postApi({ action: "reveal", matchToken: matchToken });
    },
    pickBotWord: function (matchToken, opts) {
      return postApi(Object.assign({ action: "bot_pick", matchToken: matchToken }, opts || {}));
    }
  };
})();

