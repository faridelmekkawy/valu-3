(() => {
  const CONFIG = {
    reel: {
      speed: 900,
      minDuration: 1100,
      stopDelay: 420,
    },
    scoring: {
      miss: 0,
      match: 20,
      bigMatch: 60,
      jackpot: 100,
    },
    symbolOdds: {
      heart: 30,
      wink: 30,
      token: 30,
      card: 10,
    },
  };

  const SYMBOLS = [
    { id: 'heart', asset: '../coin_heart.png' },
    { id: 'wink', asset: '../coin_wink.png' },
    { id: 'token', asset: '../coin_token.png' },
    { id: 'card', asset: '../coin_card.png', rare: true },
  ];

  const state = {
    playerName: '',
    score: 0,
    best: Number(localStorage.getItem('sparkieJackpotBest') || 0),
    spins: 0,
    spinning: false,
    muted: false,
    lastSymbols: ['heart', 'heart', 'heart'],
  };

  const el = {
    startScreen: document.getElementById('startScreen'),
    gameScreen: document.getElementById('gameScreen'),
    playerName: document.getElementById('playerName'),
    nameError: document.getElementById('nameError'),
    startBtn: document.getElementById('startBtn'),
    spinBtn: document.getElementById('spinBtn'),
    muteBtn: document.getElementById('muteBtn'),
    playerDisplay: document.getElementById('playerDisplay'),
    scoreDisplay: document.getElementById('scoreDisplay'),
    bestDisplay: document.getElementById('bestDisplay'),
    spinsDisplay: document.getElementById('spinsDisplay'),
    resultMessage: document.getElementById('resultMessage'),
    pointsBurst: document.getElementById('pointsBurst'),
    machine: document.getElementById('machine'),
    reels: [document.getElementById('reel0'), document.getElementById('reel1'), document.getElementById('reel2')],
    canvas: document.getElementById('fxCanvas'),
  };

  function init() {
    buildReels();
    attachAssetFallbacks();
    bindEvents();
    updateHud();
    fitCanvas();
    window.addEventListener('resize', fitCanvas);
  }

  function bindEvents() {
    el.startBtn.addEventListener('click', startGame);
    el.spinBtn.addEventListener('click', spin);
    el.muteBtn.addEventListener('click', toggleMute);

    document.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      if (event.code === 'Space' || event.code === 'Enter') {
        if (document.activeElement === el.playerName) return;
        event.preventDefault();
        if (el.startScreen.classList.contains('screen--active')) startGame();
        else spin();
      }
    });
  }

  function startGame() {
    const name = el.playerName.value.trim();
    if (!name) {
      el.nameError.classList.remove('hidden');
      return;
    }

    state.playerName = name;
    state.score = 0;
    state.spins = 0;

    el.nameError.classList.add('hidden');
    el.startScreen.classList.remove('screen--active');
    el.gameScreen.classList.add('screen--active');

    updateHud();
    setResult(`Welcome ${state.playerName}! Press SPIN to play.`);
    renderResultSymbols(state.lastSymbols);
  }

  function buildReels() {
    el.reels.forEach((reel) => {
      const strip = reel.querySelector('.reel-strip');
      strip.innerHTML = '';
      SYMBOLS.forEach((symbol) => strip.appendChild(makeSymbolCell(symbol)));
      SYMBOLS.forEach((symbol) => strip.appendChild(makeSymbolCell(symbol)));
    });
  }

  function makeSymbolCell(symbol) {
    const cell = document.createElement('div');
    cell.className = `symbol-cell ${symbol.id === 'card' ? 'symbol-card' : ''}`;

    const img = document.createElement('img');
    img.src = symbol.asset;
    img.alt = symbol.id;
    img.dataset.symbol = symbol.id;
    img.dataset.fallback = 'symbol';

    cell.appendChild(img);
    return cell;
  }

  function weightedRandomSymbol() {
    const total = Object.values(CONFIG.symbolOdds).reduce((sum, value) => sum + value, 0);
    let roll = Math.random() * total;

    for (const symbol of SYMBOLS) {
      roll -= CONFIG.symbolOdds[symbol.id];
      if (roll <= 0) return symbol.id;
    }
    return 'heart';
  }

  async function spin() {
    if (state.spinning || !state.playerName) return;

    state.spinning = true;
    clearWinStyles();
    el.spinBtn.disabled = true;
    setResult('Spinning...');

    const outcome = [weightedRandomSymbol(), weightedRandomSymbol(), weightedRandomSymbol()];
    const spinTasks = el.reels.map((reel, index) => animateReel(reel, outcome[index], index));
    await Promise.all(spinTasks);

    state.lastSymbols = outcome;
    state.spins += 1;

    const result = evaluateResult(outcome);
    applyResult(result);

    state.spinning = false;
    el.spinBtn.disabled = false;
  }

  function animateReel(reel, finalSymbol, reelIndex) {
    const strip = reel.querySelector('.reel-strip');
    const baseDuration = CONFIG.reel.minDuration + reelIndex * CONFIG.reel.stopDelay;
    const start = performance.now();

    return new Promise((resolve) => {
      function step(now) {
        const elapsed = now - start;
        const p = Math.min(1, elapsed / baseDuration);
        const eased = 1 - Math.pow(1 - p, 3);
        const y = (elapsed / 1000) * CONFIG.reel.speed * (1 - eased * 0.55);
        strip.style.transform = `translateY(${-((y % (SYMBOLS.length * reel.clientHeight)))}px)`;

        if (p < 1) {
          requestAnimationFrame(step);
          return;
        }

        const symbolIndex = SYMBOLS.findIndex((symbol) => symbol.id === finalSymbol);
        const finalOffset = symbolIndex * reel.clientHeight;

        strip.style.transition = `transform 240ms cubic-bezier(.2,.9,.25,1)`;
        strip.style.transform = `translateY(${-finalOffset}px)`;

        setTimeout(() => {
          strip.style.transition = '';
          resolve();
        }, 250);
      }
      requestAnimationFrame(step);
    });
  }

  function evaluateResult(symbols) {
    const counts = symbols.reduce((acc, symbol) => {
      acc[symbol] = (acc[symbol] || 0) + 1;
      return acc;
    }, {});

    const values = Object.values(counts).sort((a, b) => b - a);

    if (values[0] === 3) {
      const superJackpot = symbols.every((symbol) => symbol === 'card');
      return {
        points: CONFIG.scoring.jackpot,
        message: superJackpot ? 'SUPER JACKPOT! 3x coin_card!' : 'JACKPOT! Triple match!',
        winIndexes: [0, 1, 2],
        jackpot: true,
        superJackpot,
      };
    }

    if (values[0] === 2) {
      const pairSymbol = Object.keys(counts).find((symbol) => counts[symbol] === 2);
      const winIndexes = symbols
        .map((symbol, index) => ({ symbol, index }))
        .filter((item) => item.symbol === pairSymbol)
        .map((item) => item.index);

      return {
        points: CONFIG.scoring.bigMatch,
        message: 'Big Match! Two symbols align!',
        winIndexes,
      };
    }

    if (counts.card && counts.token) {
      return {
        points: CONFIG.scoring.match,
        message: 'Match! Special combo (coin_card + coin_token)!',
        winIndexes: symbols.map((_, idx) => idx),
      };
    }

    return { points: CONFIG.scoring.miss, message: 'Miss. Try another spin!', winIndexes: [] };
  }

  function applyResult(result) {
    state.score += result.points;
    state.best = Math.max(state.best, state.score);
    localStorage.setItem('sparkieJackpotBest', String(state.best));

    updateHud();
    highlightWins(result.winIndexes);
    showPoints(result.points);
    setResult(`${result.message} +${result.points} points.`);

    if (result.jackpot) {
      el.machine.classList.add('jackpot-shake');
      setTimeout(() => el.machine.classList.remove('jackpot-shake'), 450);
      runConfetti(result.superJackpot ? 220 : 120);
    }
  }

  function highlightWins(indexes) {
    indexes.forEach((idx) => el.reels[idx].classList.add('win'));
  }

  function clearWinStyles() {
    el.reels.forEach((reel) => reel.classList.remove('win'));
  }

  function showPoints(points) {
    if (!points) return;
    el.pointsBurst.textContent = `+${points}`;
    el.pointsBurst.classList.remove('show');
    void el.pointsBurst.offsetWidth;
    el.pointsBurst.classList.add('show');
  }

  function setResult(text) {
    el.resultMessage.textContent = text;
  }

  function updateHud() {
    el.playerDisplay.textContent = state.playerName || '-';
    el.scoreDisplay.textContent = String(state.score);
    el.bestDisplay.textContent = String(state.best);
    el.spinsDisplay.textContent = String(state.spins);
    el.muteBtn.textContent = `Mute: ${state.muted ? 'On' : 'Off'}`;
    el.muteBtn.setAttribute('aria-pressed', String(state.muted));
  }

  function renderResultSymbols(symbols) {
    el.reels.forEach((reel, index) => {
      const strip = reel.querySelector('.reel-strip');
      const symbolIndex = SYMBOLS.findIndex((symbol) => symbol.id === symbols[index]);
      strip.style.transform = `translateY(${-symbolIndex * reel.clientHeight}px)`;
    });
  }

  function attachAssetFallbacks() {
    document.querySelectorAll('img[data-fallback]').forEach((img) => {
      img.addEventListener('error', () => {
        if (img.dataset.fallback === 'symbol') {
          const fallback = document.createElement('div');
          fallback.className = 'symbol-fallback';
          img.replaceWith(fallback);
          return;
        }

        img.classList.add('img-placeholder');
        img.removeAttribute('src');
      }, { once: true });
    });
  }

  function toggleMute() {
    state.muted = !state.muted;
    updateHud();
  }

  function fitCanvas() {
    const rect = el.machine.getBoundingClientRect();
    el.canvas.width = Math.max(1, Math.floor(rect.width));
    el.canvas.height = Math.max(1, Math.floor(rect.height));
  }

  function runConfetti(count) {
    const ctx = el.canvas.getContext('2d');
    if (!ctx) return;

    const pieces = Array.from({ length: count }, () => ({
      x: Math.random() * el.canvas.width,
      y: -10 - Math.random() * 120,
      size: 4 + Math.random() * 6,
      vy: 2 + Math.random() * 5,
      vx: -2 + Math.random() * 4,
      rot: Math.random() * Math.PI,
      vr: -0.18 + Math.random() * 0.36,
      color: Math.random() > 0.5 ? '#EF5F17' : '#57BEB1',
    }));

    const duration = 1300;
    const start = performance.now();

    function draw(now) {
      const elapsed = now - start;
      ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
      pieces.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });

      if (elapsed < duration) requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
    }

    requestAnimationFrame(draw);
  }

  init();
})();
