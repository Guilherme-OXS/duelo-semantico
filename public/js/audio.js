/**
 * ============================================================================
 * SINTETIZADOR DE AUDIO NATIVO - WEB AUDIO API (js/audio.js)
 * ============================================================================
 * 100% Offline e Portatil. Gera efeitos sonoros tateis para os duelos de palavras.
 */
window.DUELO = window.DUELO || {};

window.DUELO.Audio = (function () {
  let ctx = null;
  let muted = false;

  function ensureContext() {
    if (muted) return null;
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) ctx = new AudioCtx();
    }
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(function () {});
    }
    return ctx;
  }

  function playTone(freq, type, duration, vol, slideTo) {
    const c = ensureContext();
    if (!c) return;
    try {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freq, c.currentTime);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), c.currentTime + duration);
      }
      gain.gain.setValueAtTime(vol || 0.1, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + duration);
    } catch (e) {}
  }

  return {
    toggleMute: function () {
      muted = !muted;
      return muted;
    },
    isMuted: function () {
      return muted;
    },
    newChampion: function () {
      playTone(440, "triangle", 0.14, 0.11, 587.33);
      setTimeout(function () {
        playTone(659.25, "sine", 0.25, 0.12);
      }, 90);
    },
    championKept: function () {
      playTone(349.23, "sine", 0.16, 0.09, 293.66);
    },
    hint: function () {
      playTone(587.33, "sine", 0.12, 0.08);
      setTimeout(function () {
        playTone(880, "sine", 0.22, 0.09);
      }, 80);
    },
    victory: function () {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach(function (n, idx) {
        setTimeout(function () {
          playTone(n, "triangle", 0.42, 0.13);
        }, idx * 85);
      });
    }
  };
})();
