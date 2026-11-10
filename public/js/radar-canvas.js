/**
 * ============================================================================
 * RADAR GRAVITACIONAL DE PROXIMIDADE SEMANTICA EM CANVAS 2D (js/radar-canvas.js)
 * ============================================================================
 * Plota visualmente o quao perto cada palavra testada esta do nucleo secreto.
 */
window.DUELO = window.DUELO || {};

window.DUELO.Radar = (function () {
  let canvas = null;
  let ctx = null;
  let nodes = [];
  let championChain = [];
  let isSolved = false;
  let secretLabel = "?";
  let tick = 0;
  let animId = null;

  function init(canvasEl) {
    canvas = canvasEl;
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    canvas.width = 500;
    canvas.height = 360;
    if (!animId) {
      loop();
    }
  }

  function reset() {
    nodes = [];
    championChain = [];
    isSolved = false;
    secretLabel = "?";
  }

  function setSolved(secretWordUpper) {
    isSolved = true;
    secretLabel = secretWordUpper;
  }

  function addOrUpdateWord(evalResult, becameChampion) {
    if (!evalResult) return;
    const existing = nodes.find(function (n) { return n.word === evalResult.word; });
    if (!existing) {
      // Calcula angulo bem distribuido em espiral aurea
      const idx = nodes.length;
      const goldenAngle = idx * 2.39996 + 0.5;
      nodes.push({
        word: evalResult.word,
        label: evalResult.displayWord,
        score: evalResult.score,
        tier: evalResult.tier,
        angle: goldenAngle,
        isChampion: !!becameChampion
      });
    } else if (becameChampion) {
      existing.isChampion = true;
    }

    if (becameChampion) {
      nodes.forEach(function (n) {
        n.isChampion = (n.word === evalResult.word);
      });
      if (championChain.length === 0 || championChain[championChain.length - 1] !== evalResult.word) {
        championChain.push(evalResult.word);
      }
    }
  }

  function getPointCoords(node, cx, cy, maxRadius) {
    if (node.score >= 100) {
      return { x: cx, y: cy };
    }
    // Converte score (0..100) em distancia radial do centro
    const norm = Math.max(0, Math.min(1, (100 - node.score) / 95));
    const r = 34 + norm * (maxRadius - 38);
    return {
      x: cx + Math.cos(node.angle) * r,
      y: cy + Math.sin(node.angle) * r * 0.78
    };
  }

  function loop() {
    tick += 1;
    render();
    animId = requestAnimationFrame(loop);
  }

  function render() {
    if (!ctx || !canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(cx, cy) - 18;

    ctx.clearRect(0, 0, w, h);

    // 1. Aneis de Temperatura do Radar
    const rings = [
      { r: maxR * 0.92, color: "rgba(56, 189, 248, 0.14)", label: "Frio" },
      { r: maxR * 0.64, color: "rgba(251, 191, 36, 0.18)", label: "Quente" },
      { r: maxR * 0.34, color: "rgba(16, 185, 129, 0.25)", label: "Fervendo" }
    ];

    rings.forEach(function (ring) {
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, ring.r * 1.18, ring.r * 0.92, 0, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Eixos cruzados sutis
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.beginPath();
    ctx.moveTo(20, cy);
    ctx.lineTo(w - 20, cy);
    ctx.moveTo(cx, 20);
    ctx.lineTo(cx, h - 20);
    ctx.stroke();

    // 2. Trilha Luminosa Conectando a Evolucao das Palavras Campeas
    if (championChain.length > 1) {
      ctx.strokeStyle = "rgba(245, 158, 11, 0.55)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      for (let i = 0; i < championChain.length; i++) {
        const nd = nodes.find(function (n) { return n.word === championChain[i]; });
        if (!nd) continue;
        const pt = getPointCoords(nd, cx, cy, maxR);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 3. Nucleo Central (Palavra Secreta)
    const pulse = 20 + Math.sin(tick * 0.08) * 3;
    const coreGrad = ctx.createRadialGradient(cx, cy, 3, cx, cy, pulse * 1.9);
    if (isSolved) {
      coreGrad.addColorStop(0, "rgba(16, 185, 129, 0.85)");
      coreGrad.addColorStop(1, "rgba(16, 185, 129, 0)");
    } else {
      coreGrad.addColorStop(0, "rgba(245, 158, 11, 0.7)");
      coreGrad.addColorStop(1, "rgba(245, 158, 11, 0)");
    }
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, pulse * 1.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isSolved ? "#065F46" : "#1E293B";
    ctx.strokeStyle = isSolved ? "#34D399" : "#F59E0B";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = "700 12px JetBrains Mono, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#F8FAFC";
    ctx.fillText(secretLabel, cx, cy);

    // 4. Plota cada Palavra Testada
    nodes.forEach(function (node) {
      if (node.score >= 100 && isSolved) return;
      const pt = getPointCoords(node, cx, cy, maxR);

      let dotColor = "#38BDF8";
      if (node.tier === "burning") dotColor = "#34D399";
      else if (node.tier === "hot") dotColor = "#FBBF24";
      else if (node.tier === "warm") dotColor = "#FB923C";

      const radius = node.isChampion ? 7.5 : 5;
      if (node.isChampion) {
        ctx.fillStyle = "rgba(251, 191, 36, 0.25)";
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 14, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = node.isChampion ? "#FEF08A" : "#0B0D13";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = (node.isChampion ? "700 11px" : "600 10px") + " Inter, sans-serif";
      ctx.fillStyle = node.isChampion ? "#FEF08A" : "#CBD5E1";
      ctx.fillText(node.label + " (" + node.score.toFixed(0) + "%)", pt.x, pt.y - 12);
    });
  }

  return {
    init: init,
    reset: reset,
    setSolved: setSolved,
    addOrUpdateWord: addOrUpdateWord
  };
})();
