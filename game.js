(() => {
  const CONFIG = {
    baseRounds: 3,
    levelSpeeds: [260, 360, 470],
    impossibleSpeed: 640,
    goodZoneRatios: [0.22, 0.18, 0.14],
    perfectZoneRatios: [0.06, 0.045, 0.03],
    impossibleGoodZoneRatio: 0.1,
    impossiblePerfectZoneRatio: 0.018,
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
    perfectCount: 0,
    unlockedImpossible: false,
    inImpossibleRound: false,
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
    el.restartBtn.addEventListener('click', goHome);

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

    Object.assign(state, {
      playerName: name,
      score: 0,
      round: 1,
      gameOver: false,
      perfectCount: 0,
      unlockedImpossible: false,
      inImpossibleRound: false,
    });

    el.nameError.classList.add('hidden');
    el.startScreen.classList.remove('screen--active');
    el.gameScreen.classList.add('screen--active');

    updateHud();
    startRound();
  }

  function currentRoundLimit() {
    return state.unlockedImpossible ? CONFIG.baseRounds + 1 : CONFIG.baseRounds;
  }

  function startRound() {
    cancelAnimationFrame(state.rafId);
    state.running = true;
    state.paused = false;
    state.stopped = false;
    state.lastTick = performance.now();

    const trackWidth = el.track.clientWidth;
    state.sparkieX = 0;
    state.targetCenterRatio = 0.18 + Math.random() * 0.68;

    const levelIndex = Math.min(state.round, CONFIG.baseRounds) - 1;
    state.speed = state.inImpossibleRound ? CONFIG.impossibleSpeed : CONFIG.levelSpeeds[levelIndex];

    placeSparkie();
    setZones(trackWidth);

    el.sparkie.classList.remove('stopped');
    el.sparkie.classList.add('running');

    state.rafId = requestAnimationFrame(tick);
    updatePauseButton();
  }

  function setZones(trackWidth) {
    const levelIndex = Math.min(state.round, CONFIG.baseRounds) - 1;
    const goodRatio = state.inImpossibleRound ? CONFIG.impossibleGoodZoneRatio : CONFIG.goodZoneRatios[levelIndex];
    const perfectRatio = state.inImpossibleRound ? CONFIG.impossiblePerfectZoneRatio : CONFIG.perfectZoneRatios[levelIndex];

    const goodSize = Math.max(44, trackWidth * goodRatio);
    const perfectSize = Math.max(10, trackWidth * perfectRatio);
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
    if (state.sparkieX >= maxX) state.sparkieX = 0;

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

    if (distance <= perfectRadius) return { band: 'perfect', label: 'PERFECT', points: CONFIG.scoring.perfect, accuracy: 'Bullseye!' };
    if (distance <= perfectRadius * 1.6) return { band: 'great', label: 'GREAT', points: CONFIG.scoring.great, accuracy: 'Super close!' };
    if (distance <= goodRadius) return { band: 'good', label: 'GOOD', points: CONFIG.scoring.good, accuracy: 'Safe stop.' };
    return { band: 'miss', label: 'MISS', points: CONFIG.scoring.miss, accuracy: 'Wrong stop. Run lost.' };
  }

  function applyResult(result) {
    state.score += result.points;
    state.best = Math.max(state.best, state.score);
    localStorage.setItem('sparkieBestScore', String(state.best));

    if (result.band === 'perfect') {
      state.perfectCount += 1;
      el.gameScreen.classList.add('perfect-shake');
      setTimeout(() => el.gameScreen.classList.remove('perfect-shake'), 250);
    }

    if (result.band === 'miss') state.gameOver = true;
    showOverlay(result);
    updateHud();
  }

  function showOverlay(result) {
    const finishedBaseRounds = state.round >= CONFIG.baseRounds;
    const perfectBaseRun = state.perfectCount === CONFIG.baseRounds && !state.gameOver;

    if (finishedBaseRounds && perfectBaseRun && !state.inImpossibleRound) {
      state.unlockedImpossible = true;
    }

    const finalRoundComplete = state.round >= currentRoundLimit() && !state.gameOver;

    el.resultLabel.textContent = result.label;
    el.resultLabel.style.color = result.band === 'miss' ? '#a1a1a1' : result.band === 'perfect' ? '#ef5f17' : '#57beb1';
    el.resultPoints.textContent = result.band === 'miss' ? '0' : `+${result.points}`;

    if (state.gameOver) {
      el.accuracyText.textContent = `${state.playerName}, wrong stop. You cannot proceed.`;
    } else if (state.unlockedImpossible && state.round === CONFIG.baseRounds && !state.inImpossibleRound) {
      el.accuracyText.textContent = `Perfect 3-round run! ${state.playerName}, Level 4 Impossible unlocked.`;
    } else if (finalRoundComplete) {
      el.accuracyText.textContent = `Awesome run, ${state.playerName}. Returning home is available.`;
    } else {
      el.accuracyText.textContent = `${result.accuracy} ${state.playerName}, prepare for round ${state.round + 1}.`;
    }

    const asset = ASSET_BY_RESULT[result.band];
    if (asset) {
      el.rewardIcon.src = asset;
      el.rewardIcon.classList.remove('hidden');
      el.rewardFallback.classList.add('hidden');
    } else {
      el.rewardIcon.classList.add('hidden');
      el.rewardFallback.classList.remove('hidden');
    }

    const canProceedToNext = !state.gameOver && !finalRoundComplete;
    el.nextRoundBtn.disabled = !canProceedToNext;

    if (state.unlockedImpossible && state.round === CONFIG.baseRounds && !state.inImpossibleRound && !state.gameOver) {
      el.nextRoundBtn.disabled = false;
      el.nextRoundBtn.textContent = 'Level 4: Impossible';
    } else if (finalRoundComplete) {
      el.nextRoundBtn.textContent = 'Completed';
    } else {
      el.nextRoundBtn.textContent = 'Next Round';
    }

    el.restartBtn.textContent = 'Go Home';

    el.overlay.classList.add('active');
    el.overlay.setAttribute('aria-hidden', 'false');
  }

  function nextRoundAction() {
    if (state.gameOver) return;

    if (state.unlockedImpossible && state.round === CONFIG.baseRounds && !state.inImpossibleRound) {
      state.round = CONFIG.baseRounds + 1;
      state.inImpossibleRound = true;
      closeOverlay();
      updateHud();
      startRound();
      return;
    }

    if (state.round >= currentRoundLimit()) return;

    state.round += 1;
    closeOverlay();
    updateHud();
    startRound();
  }

  function goHome() {
    closeOverlay();
    cancelAnimationFrame(state.rafId);
    state.running = false;
    state.stopped = true;
    state.paused = false;

    el.gameScreen.classList.remove('screen--active');
    el.startScreen.classList.add('screen--active');
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
    el.roundValue.textContent = `${state.round}/${currentRoundLimit()}`;
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
