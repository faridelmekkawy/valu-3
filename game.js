(() => {
  const CONFIG = {
    roundDurationMs: 3200,
    minSpeedPxPerSec: 250,
    maxSpeedPxPerSec: 330,
    goodZoneRatio: 0.2,
    perfectZoneRatio: 0.07,
    scoring: {
      perfect: 100,
      great: 70,
      good: 40,
      miss: 0,
    },
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
    score: 0,
    round: 1,
    combo: 0,
    best: Number(localStorage.getItem('sparkieBestScore') || 0),
    sparkieX: 0,
    speed: 0,
    targetCenterRatio: 0.5,
    lastTick: 0,
    rafId: 0,
    difficultyScale: 1,
  };

  const el = {
    startScreen: document.getElementById('startScreen'),
    gameScreen: document.getElementById('gameScreen'),
    overlay: document.getElementById('resultOverlay'),
    startBtn: document.getElementById('startBtn'),
    stopBtn: document.getElementById('stopBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    nextRoundBtn: document.getElementById('nextRoundBtn'),
    restartBtn: document.getElementById('restartBtn'),
    scoreValue: document.getElementById('scoreValue'),
    roundValue: document.getElementById('roundValue'),
    bestValue: document.getElementById('bestValue'),
    comboValue: document.getElementById('comboValue'),
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
    el.bestValue.textContent = String(state.best);
    bindEvents();
    attachImageFallbacks();
    updateHud();
  }

  function bindEvents() {
    el.startBtn.addEventListener('click', startGame);
    el.stopBtn.addEventListener('click', stopRun);
    el.pauseBtn.addEventListener('click', togglePause);
    el.nextRoundBtn.addEventListener('click', () => {
      closeOverlay();
      startRound();
    });
    el.restartBtn.addEventListener('click', restartGame);

    document.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        stopRun();
      }
      if (event.key.toLowerCase() === 'p') {
        togglePause();
      }
    });

    document.addEventListener('pointerdown', (event) => {
      if (!state.running || state.stopped || state.paused) return;
      if (
        event.target === el.stopBtn ||
        event.target === el.pauseBtn ||
        event.target === el.nextRoundBtn ||
        event.target === el.restartBtn
      ) {
        return;
      }
      stopRun();
    });
  }

  function startGame() {
    el.startScreen.classList.remove('screen--active');
    el.gameScreen.classList.add('screen--active');
    state.score = 0;
    state.round = 1;
    state.combo = 0;
    state.difficultyScale = 1;
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

    const minCenter = 0.28;
    const maxCenter = 0.86;
    state.targetCenterRatio = minCenter + Math.random() * (maxCenter - minCenter);

    const speedRange = CONFIG.maxSpeedPxPerSec - CONFIG.minSpeedPxPerSec;
    state.speed =
      (CONFIG.minSpeedPxPerSec + Math.random() * speedRange) * state.difficultyScale;

    const finalX = trackWidth - sparkieWidth;
    const travelDistance = Math.max(1, finalX);
    const requiredSpeed = travelDistance / (CONFIG.roundDurationMs / 1000);
    state.speed = Math.max(state.speed, requiredSpeed * 0.82);

    state.sparkieX = 0;
    placeSparkie();
    setZones();

    el.sparkie.classList.remove('stopped');
    el.sparkie.classList.add('running');

    state.rafId = requestAnimationFrame(tick);
    updatePauseButton();
  }

  function setZones() {
    const trackWidth = el.track.clientWidth;
    const goodSize = Math.max(54, trackWidth * CONFIG.goodZoneRatio / state.difficultyScale);
    const perfectSize = Math.max(20, trackWidth * CONFIG.perfectZoneRatio / state.difficultyScale);
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
      state.sparkieX = maxX;
      placeSparkie();
      stopRun(true);
      return;
    }

    placeSparkie();
    state.rafId = requestAnimationFrame(tick);
  }

  function placeSparkie() {
    el.sparkie.style.left = `${state.sparkieX}px`;
  }

  function stopRun(autoMiss = false) {
    if (!state.running || state.stopped || state.paused) return;

    state.stopped = true;
    state.running = false;
    cancelAnimationFrame(state.rafId);

    el.sparkie.classList.remove('running');
    el.sparkie.classList.add('stopped');

    const result = autoMiss ? makeMissResult() : evaluateStop();
    applyResult(result);
  }

  function evaluateStop() {
    const sparkieCenter = state.sparkieX + el.sparkie.clientWidth / 2;
    const trackWidth = el.track.clientWidth;
    const targetCenter = trackWidth * state.targetCenterRatio;

    const distance = Math.abs(sparkieCenter - targetCenter);
    const perfectRadius = parseFloat(el.perfectZone.style.width) / 2;
    const goodRadius = parseFloat(el.goodZone.style.width) / 2;

    if (distance <= perfectRadius) {
      return {
        band: 'perfect',
        label: 'PERFECT',
        points: CONFIG.scoring.perfect,
        accuracy: 'Bullseye! Sparkie nailed the center.',
      };
    }

    if (distance <= perfectRadius * 1.8) {
      return {
        band: 'great',
        label: 'GREAT',
        points: CONFIG.scoring.great,
        accuracy: 'So close! Just off center.',
      };
    }

    if (distance <= goodRadius) {
      return {
        band: 'good',
        label: 'GOOD',
        points: CONFIG.scoring.good,
        accuracy: 'Inside the zone. Keep timing it.',
      };
    }

    return makeMissResult();
  }

  function makeMissResult() {
    return {
      band: 'miss',
      label: 'MISS',
      points: CONFIG.scoring.miss,
      accuracy: 'Outside the zone. Try again!',
    };
  }

  function applyResult(result) {
    state.score += result.points;
    state.combo = result.points > 0 ? state.combo + 1 : 0;
    state.best = Math.max(state.best, state.score);
    localStorage.setItem('sparkieBestScore', String(state.best));

    if (result.band === 'perfect') {
      el.gameScreen.classList.add('perfect-shake');
      setTimeout(() => el.gameScreen.classList.remove('perfect-shake'), 250);
    }

    state.difficultyScale = Math.min(1.65, 1 + state.round * 0.035);

    showOverlay(result);
    state.round += 1;
    updateHud();
  }

  function showOverlay(result) {
    el.resultLabel.textContent = result.label;
    el.resultLabel.style.color =
      result.band === 'perfect'
        ? '#ef5f17'
        : result.band === 'great'
        ? '#57beb1'
        : result.band === 'good'
        ? '#9fe1d9'
        : '#a1a1a1';
    el.resultPoints.textContent = `+${result.points}`;
    el.accuracyText.textContent = result.accuracy;

    const asset = ASSET_BY_RESULT[result.band];
    if (asset) {
      el.rewardIcon.src = asset;
      el.rewardIcon.classList.remove('hidden');
      el.rewardFallback.classList.add('hidden');
    } else {
      el.rewardIcon.classList.add('hidden');
      el.rewardFallback.classList.remove('hidden');
    }

    el.overlay.classList.add('active');
    el.overlay.setAttribute('aria-hidden', 'false');
  }

  function closeOverlay() {
    el.overlay.classList.remove('active');
    el.overlay.setAttribute('aria-hidden', 'true');
  }

  function restartGame() {
    closeOverlay();
    state.score = 0;
    state.round = 1;
    state.combo = 0;
    state.difficultyScale = 1;
    updateHud();
    startRound();
  }

  function updateHud() {
    el.scoreValue.textContent = String(state.score);
    el.roundValue.textContent = String(state.round);
    el.comboValue.textContent = `x${Math.max(1, state.combo)}`;
    el.bestValue.textContent = String(state.best);
  }

  function togglePause() {
    if (!state.running || state.stopped) return;
    state.paused = !state.paused;
    updatePauseButton();
  }

  function updatePauseButton() {
    el.pauseBtn.textContent = state.paused ? 'Resume' : 'Pause';
  }

  function attachImageFallbacks() {
    document.querySelectorAll('img[data-fallback]').forEach((img) => {
      img.addEventListener(
        'error',
        () => {
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
        },
        { once: true }
      );
    });
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  init();
})();
