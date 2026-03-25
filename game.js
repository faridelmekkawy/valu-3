(() => {
  const CONFIG = {
    totalRounds: 3,
    baseSpeedPxPerSec: 220,
    speedIncreasePerRound: 80,
    goodZoneRatio: 0.26,
    perfectZoneRatio: 0.07,
    scoring: { perfect: 100, great: 70, good: 40, miss: 0 },
  };

  const ASSET_BY_RESULT = {
    perfect: './coin_token.png',
    great: './coin_wink.png',
    good: './coin_heart.png',
    miss: '',
  };

  const state = {
    running: false,
    paused: false,
    stopped: false,
    gameOver: false,
    score: 0,
    round: 1,
    best: Number(localStorage.getItem('sparkieBestScore') || 0),
    playerName: '',
    sparkieX: 0,
    speed: 0,
    targetCenterRatio: 0.5,
    lastTick: 0,
    rafId: 0,
  };

  const el = {
    startScreen: document.getElementById('startScreen'),
    gameScreen: document.getElementById('gameScreen'),
    overlay: document.getElementById('resultOverlay'),
    playerName: document.getElementById('playerName'),
    nameError: document.getElementById('nameError'),
    startBtn: document.getElementById('startBtn'),
    stopBtn: document.getElementById('stopBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    nextRoundBtn: document.getElementById('nextRoundBtn'),
    restartBtn: document.getElementById('restartBtn'),
    playerValue: document.getElementById('playerValue'),
    scoreValue: document.getElementById('scoreValue'),
    roundValue: document.getElementById('roundValue'),
    bestValue: document.getElementById('bestValue'),
    track: document.getElementById('track'),
    sparkie: document.getElementById('sparkie'),
    goodZone: document.getElementById('goodZone'),
    perfectZone: document.getElementById('perfectZone'),
    resultLabel: document.getElementById('resultLabel'),
    resultPoints: document.getElementById('resultPoints'),
    rewardIcon: document.getElementById('rewardIcon'),
    rewardFallback: document.getElementById('rewardFallback'),
    accuracyText: document.getElementById('accuracyText'),
  };

  function init() {
    attachImageFallbacks();
    bindEvents();
    updateHud();
  }

  function bindEvents() {
    el.startBtn.addEventListener('click', startGame);
    el.stopBtn.addEventListener('click', stopRun);
    el.pauseBtn.addEventListener('click', togglePause);
    el.nextRoundBtn.addEventListener('click', nextRoundAction);
    el.restartBtn.addEventListener('click', restartGame);

    document.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        stopRun();
      }
      if (event.key.toLowerCase() === 'p') togglePause();
    });

    document.addEventListener('pointerdown', (event) => {
      if (!state.running || state.stopped || state.paused) return;
      if ([el.stopBtn, el.pauseBtn, el.nextRoundBtn, el.restartBtn].includes(event.target)) return;
      stopRun();
    });
  }

  function startGame() {
    const name = el.playerName.value.trim();
    if (!name) {
      el.nameError.classList.remove('hidden');
      return;
    }
    el.nameError.classList.add('hidden');
    state.playerName = name;
    state.score = 0;
    state.round = 1;
    state.gameOver = false;

    el.startScreen.classList.remove('screen--active');
    el.gameScreen.classList.add('screen--active');

    updateHud();
    startRound();
  }

  function startRound() {
    cancelAnimationFrame(state.rafId);
    state.running = true;
    state.paused = false;
    state.stopped = false;
    state.lastTick = performance.now();

    const trackWidth = el.track.clientWidth;
    const sparkieWidth = el.sparkie.clientWidth;
    state.sparkieX = 0;
    state.targetCenterRatio = 0.2 + Math.random() * 0.65;
    state.speed = CONFIG.baseSpeedPxPerSec + (state.round - 1) * CONFIG.speedIncreasePerRound;

    placeSparkie();
    setZones(trackWidth, sparkieWidth);

    el.sparkie.classList.remove('stopped');
    el.sparkie.classList.add('running');

    state.rafId = requestAnimationFrame(tick);
    updatePauseButton();
  }

  function setZones(trackWidth) {
    const goodSize = Math.max(70, trackWidth * CONFIG.goodZoneRatio);
    const perfectSize = Math.max(22, trackWidth * CONFIG.perfectZoneRatio);
    const centerX = trackWidth * state.targetCenterRatio;

    const goodLeft = clamp(centerX - goodSize / 2, 0, trackWidth - goodSize);
    const perfectLeft = clamp(centerX - perfectSize / 2, 0, trackWidth - perfectSize);

    el.goodZone.style.left = `${goodLeft}px`;
    el.goodZone.style.width = `${goodSize}px`;
    el.perfectZone.style.left = `${perfectLeft}px`;
    el.perfectZone.style.width = `${perfectSize}px`;
  }

  function tick(now) {
    if (!state.running || state.stopped) return;
    if (state.paused) {
      state.lastTick = now;
      state.rafId = requestAnimationFrame(tick);
      return;
    }

    const deltaSec = (now - state.lastTick) / 1000;
    state.lastTick = now;
    state.sparkieX += state.speed * deltaSec;

    const maxX = el.track.clientWidth - el.sparkie.clientWidth;
    if (state.sparkieX >= maxX) {
      // Hitting the end is NOT a loss; Sparkie loops back and keeps running.
      state.sparkieX = 0;
    }

    placeSparkie();
    state.rafId = requestAnimationFrame(tick);
  }

  function placeSparkie() {
    el.sparkie.style.left = `${state.sparkieX}px`;
  }

  function stopRun() {
    if (!state.running || state.stopped || state.paused) return;

    state.stopped = true;
    state.running = false;
    cancelAnimationFrame(state.rafId);
    el.sparkie.classList.remove('running');
    el.sparkie.classList.add('stopped');

    const result = evaluateStop();
    applyResult(result);
  }

  function evaluateStop() {
    const sparkieCenter = state.sparkieX + el.sparkie.clientWidth / 2;
    const trackWidth = el.track.clientWidth;
    const targetCenter = trackWidth * state.targetCenterRatio;
    const distance = Math.abs(sparkieCenter - targetCenter);
    const perfectRadius = parseFloat(el.perfectZone.style.width) / 2;
    const goodRadius = parseFloat(el.goodZone.style.width) / 2;

    if (distance <= perfectRadius) return { band: 'perfect', label: 'PERFECT', points: CONFIG.scoring.perfect, accuracy: 'Bullseye!'};
    if (distance <= perfectRadius * 1.8) return { band: 'great', label: 'GREAT', points: CONFIG.scoring.great, accuracy: 'So close!'};
    if (distance <= goodRadius) return { band: 'good', label: 'GOOD', points: CONFIG.scoring.good, accuracy: 'Inside the zone.'};
    return { band: 'miss', label: 'MISS', points: CONFIG.scoring.miss, accuracy: 'Wrong stop. Game over for this run.' };
  }

  function applyResult(result) {
    state.score += result.points;
    state.best = Math.max(state.best, state.score);
    localStorage.setItem('sparkieBestScore', String(state.best));

    if (result.band === 'perfect') {
      el.gameScreen.classList.add('perfect-shake');
      setTimeout(() => el.gameScreen.classList.remove('perfect-shake'), 250);
    }

    if (result.band === 'miss') {
      state.gameOver = true;
    }

    showOverlay(result);
    updateHud();
  }

  function showOverlay(result) {
    el.resultLabel.textContent = result.label;
    el.resultLabel.style.color = result.band === 'miss' ? '#a1a1a1' : result.band === 'perfect' ? '#ef5f17' : '#57beb1';
    el.resultPoints.textContent = result.band === 'miss' ? '0' : `+${result.points}`;
    el.accuracyText.textContent = result.band === 'miss'
      ? `${state.playerName}, you missed. Restart to try all 3 rounds.`
      : state.round >= CONFIG.totalRounds
      ? `Great run, ${state.playerName}!`
      : `${result.accuracy} ${state.playerName}, get ready for round ${state.round + 1}.`;

    const asset = ASSET_BY_RESULT[result.band];
    if (asset) {
      el.rewardIcon.src = asset;
      el.rewardIcon.classList.remove('hidden');
      el.rewardFallback.classList.add('hidden');
    } else {
      el.rewardIcon.classList.add('hidden');
      el.rewardFallback.classList.remove('hidden');
    }

    const canProceed = !state.gameOver && state.round < CONFIG.totalRounds;
    el.nextRoundBtn.disabled = !canProceed;
    el.nextRoundBtn.textContent = state.round >= CONFIG.totalRounds && !state.gameOver ? 'Completed!' : 'Next Round';

    el.overlay.classList.add('active');
    el.overlay.setAttribute('aria-hidden', 'false');
  }

  function nextRoundAction() {
    if (state.gameOver || state.round >= CONFIG.totalRounds) return;
    state.round += 1;
    closeOverlay();
    updateHud();
    startRound();
  }

  function restartGame() {
    closeOverlay();
    state.score = 0;
    state.round = 1;
    state.gameOver = false;
    updateHud();
    startRound();
  }

  function closeOverlay() {
    el.overlay.classList.remove('active');
    el.overlay.setAttribute('aria-hidden', 'true');
  }

  function togglePause() {
    if (!state.running || state.stopped) return;
    state.paused = !state.paused;
    updatePauseButton();
  }

  function updatePauseButton() {
    el.pauseBtn.textContent = state.paused ? 'Resume' : 'Pause';
  }

  function updateHud() {
    el.playerValue.textContent = state.playerName || '-';
    el.scoreValue.textContent = String(state.score);
    el.roundValue.textContent = `${state.round}/${CONFIG.totalRounds}`;
    el.bestValue.textContent = String(state.best);
  }

  function attachImageFallbacks() {
    document.querySelectorAll('img[data-fallback]').forEach((img) => {
      img.addEventListener('error', () => {
        if (img.dataset.fallback === 'reward') {
          img.classList.add('hidden');
          el.rewardFallback.classList.remove('hidden');
          return;
        }

        img.classList.add('img-placeholder');
        img.removeAttribute('src');
        if (img.id === 'sparkieImg') {
          img.parentElement.style.background = 'linear-gradient(130deg, #ef5f17, #57beb1)';
          img.parentElement.style.borderRadius = '50%';
        }
      }, { once: true });
    });
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  init();
})();
