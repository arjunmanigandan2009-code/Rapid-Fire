/**
 * ==========================================================
 * RAPID FIRE - Mental Math & Speed Reflex Game for Students
 * Optimized for Mobile (Touch, Vibration & Ergonomics) & Desktop
 * ==========================================================
 */

// Global State
const state = {
  soundEnabled: true,
  currentStreak: 0,
  totalScore: 0,
  stats: {
    gamesPlayed: 0,
    totalCorrect: 0,
    totalAnswered: 0,
    fastestReflex: null,
    bestMode2Score: 0,
  },
  
  // Mode 1: Rapid Flash Numbers State
  flashConfig: {
    level: 1,           // 1: only +ve, 2: +ve & -ve, 3: (x) & (/) in between
    timeDelay: 1.0,     // 0.5s to 3.0s
    count: 5,           // numbers count
    range: 'single',    // 'single' (1-9) or 'double' (10-99)
  },
  flashGame: {
    sequence: [],       // Array of items { op, val, runningSum }
    targetAnswer: 0,
    choices: [],
    currentIndex: 0,
    intervalId: null,
    isStreaming: false,
    waitingForAnswer: false,
  },

  // Mode 2: Two Numbers Speed Reflex State
  speedConfig: {
    operation: 'add',   // 'add', 'sub', 'mul', 'div', 'mixed'
    difficulty: 'medium', // 'easy', 'medium', 'hard'
    totalRounds: 10,
  },
  speedGame: {
    currentRound: 0,
    score: 0,
    streak: 0,
    maxStreak: 0,
    startTime: 0,
    maxQuestionTime: 5000, // 5 seconds
    timerInterval: null,
    currentQuestion: null,
    history: [], // { num1, op, num2, correct, userChoice, isCorrect, timeTaken, points }
  }
};

/* ==========================================================
   MOBILE HAPTICS HELPER (Vibration API)
   ========================================================== */
function triggerHaptic(pattern) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {}
  }
}

/* ==========================================================
   AUDIO SYNTHESIZER (Web Audio API - 100% Offline & Mobile Friendly)
   ========================================================== */
class SoundEngine {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type = 'sine', duration = 0.1, gain = 0.15) {
    if (!state.soundEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gainNode.gain.setValueAtTime(gain, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio autoplay policy fallback
    }
  }

  tick() {
    this.playTone(800, 'triangle', 0.05, 0.08);
  }

  flashNumber() {
    this.playTone(520, 'sine', 0.09, 0.15);
    triggerHaptic(12);
  }

  prepBeep(isGo = false) {
    if (isGo) {
      this.playTone(1050, 'square', 0.22, 0.18);
      triggerHaptic([30, 30, 60]);
    } else {
      this.playTone(550, 'sine', 0.1, 0.15);
      triggerHaptic(20);
    }
  }

  correct() {
    triggerHaptic([25, 40, 50]);
    if (!state.soundEnabled) return;
    try {
      this.init();
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((f, idx) => {
        setTimeout(() => this.playTone(f, 'sine', 0.14, 0.16), idx * 60);
      });
    } catch (e) {}
  }

  wrong() {
    triggerHaptic(90);
    if (!state.soundEnabled) return;
    try {
      this.init();
      this.playTone(220, 'sawtooth', 0.25, 0.2);
      setTimeout(() => this.playTone(180, 'sawtooth', 0.3, 0.2), 120);
    } catch (e) {}
  }

  speedBonus() {
    triggerHaptic([35, 50]);
    if (!state.soundEnabled) return;
    try {
      this.init();
      this.playTone(987.77, 'sine', 0.08, 0.18);
      setTimeout(() => this.playTone(1318.51, 'triangle', 0.16, 0.22), 80);
    } catch (e) {}
  }

  fanfare() {
    triggerHaptic([50, 60, 80, 100]);
    if (!state.soundEnabled) return;
    try {
      this.init();
      const chords = [523.25, 659.25, 783.99, 1046.5, 1318.51];
      chords.forEach((n, i) => {
        setTimeout(() => this.playTone(n, 'triangle', 0.3, 0.2), i * 80);
      });
    } catch (e) {}
  }
}

const sounds = new SoundEngine();

/* ==========================================================
   CONFETTI FX (Lightweight Canvas Particle System)
   ========================================================== */
class ConfettiEngine {
  constructor() {
    this.canvas = document.getElementById('confetti-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.particles = [];
    this.animId = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 150));
  }

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  burst(x = window.innerWidth / 2, y = window.innerHeight / 2, count = 50) {
    if (!this.ctx) return;
    const colors = ['#ff5e14', '#ffbb00', '#38bdf8', '#10b981', '#a855f7', '#f43f5e', '#fff'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3.5 + Math.random() * 8;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.5,
        size: 4 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rSpeed: (Math.random() - 0.5) * 12,
        life: 1,
        decay: 0.018 + Math.random() * 0.02,
      });
    }
    if (!this.animId) {
      this.render();
    }
  }

  render() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2;
      p.rotation += p.rSpeed;
      p.life -= p.decay;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.globalAlpha = p.life;
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
      this.ctx.restore();
    }

    if (this.particles.length > 0) {
      this.animId = requestAnimationFrame(() => this.render());
    } else {
      this.animId = null;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
}

const confetti = new ConfettiEngine();

/* ==========================================================
   STORAGE & PERSISTENCE
   ========================================================== */
function loadSavedStats() {
  try {
    const raw = localStorage.getItem('rapidfire_stats');
    if (raw) {
      const parsed = JSON.parse(raw);
      state.stats = { ...state.stats, ...parsed };
    }
    const soundPref = localStorage.getItem('rapidfire_sound');
    if (soundPref !== null) {
      state.soundEnabled = soundPref === 'true';
    }
  } catch (e) {}
  updateHeaderUI();
  updateDashboardStatsUI();
}

function saveStats() {
  try {
    localStorage.setItem('rapidfire_stats', JSON.stringify(state.stats));
    localStorage.setItem('rapidfire_sound', String(state.soundEnabled));
  } catch (e) {}
  updateHeaderUI();
  updateDashboardStatsUI();
}

function updateHeaderUI() {
  const streakEl = document.getElementById('header-streak-count');
  const scoreEl = document.getElementById('header-score-count');
  const soundIcon = document.getElementById('sound-icon');
  if (streakEl) streakEl.textContent = state.currentStreak;
  if (scoreEl) scoreEl.textContent = state.totalScore;
  if (soundIcon) soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';
}

function updateDashboardStatsUI() {
  const gamesEl = document.getElementById('stats-total-played');
  const accEl = document.getElementById('stats-accuracy');
  const reflexEl = document.getElementById('stats-fastest-reflex');
  const bestScoreEl = document.getElementById('stats-best-score');

  if (gamesEl) gamesEl.textContent = state.stats.gamesPlayed;
  if (accEl) {
    const acc = state.stats.totalAnswered > 0
      ? Math.round((state.stats.totalCorrect / state.stats.totalAnswered) * 100)
      : 0;
    accEl.textContent = `${acc}%`;
  }
  if (reflexEl) {
    reflexEl.textContent = state.stats.fastestReflex
      ? `${(state.stats.fastestReflex / 1000).toFixed(2)}s`
      : '-';
  }
  if (bestScoreEl) bestScoreEl.textContent = state.stats.bestMode2Score;
}

/* ==========================================================
   WELCOME SCREEN CONTROLLER (5 SECONDS COUNTDOWN)
   ========================================================== */
function initWelcomeScreen() {
  const welcomeScreen = document.getElementById('welcome-screen');
  const countdownText = document.getElementById('welcome-countdown-text');
  const secondsLeftEl = document.getElementById('welcome-seconds-left');
  const progressRing = document.getElementById('welcome-progress-ring');
  const skipBtn = document.getElementById('skip-welcome-btn');

  const totalDuration = 5000; // 5.0 seconds
  const circumference = 2 * Math.PI * 44; // r=44 -> ~276.46
  progressRing.style.strokeDasharray = `${circumference}`;
  progressRing.style.strokeDashoffset = '0';

  const startTime = Date.now();
  let timerId = null;

  function update() {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, totalDuration - elapsed);
    const fraction = remaining / totalDuration;
    const offset = circumference * (1 - fraction);

    progressRing.style.strokeDashoffset = `${offset}`;
    
    const secs = (remaining / 1000).toFixed(1);
    if (countdownText) countdownText.textContent = secs;
    if (secondsLeftEl) secondsLeftEl.textContent = Math.ceil(remaining / 1000);

    if (remaining <= 0) {
      finishWelcome();
    } else {
      timerId = requestAnimationFrame(update);
    }
  }

  function finishWelcome() {
    if (timerId) cancelAnimationFrame(timerId);
    sounds.init();
    welcomeScreen.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
    welcomeScreen.style.opacity = '0';
    welcomeScreen.style.transform = 'scale(1.04)';
    setTimeout(() => {
      welcomeScreen.classList.remove('active');
      welcomeScreen.style.display = 'none';
      switchScreen('dashboard-screen');
    }, 350);
  }

  // Allow tap anywhere on splash screen to jump straight in
  welcomeScreen.addEventListener('click', () => {
    sounds.init();
    triggerHaptic(20);
    finishWelcome();
  });

  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      sounds.init();
      triggerHaptic(20);
      finishWelcome();
    });
  }

  timerId = requestAnimationFrame(update);
}

/* ==========================================================
   SCREEN NAVIGATION & MODAL CONTROLLERS
   ========================================================== */
function switchScreen(screenId) {
  document.querySelectorAll('.screen').forEach(sc => {
    sc.classList.remove('active');
  });
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function returnToDashboard() {
  clearInterval(state.flashGame.intervalId);
  clearInterval(state.speedGame.timerInterval);
  state.flashGame.isStreaming = false;
  state.flashGame.waitingForAnswer = false;
  closeConfigModal();
  switchScreen('dashboard-screen');
}

function confirmQuitGame() {
  if (confirm('Do you want to return to the hub? Your current round will end.')) {
    returnToDashboard();
  }
}

// Modal open/close
function openModeConfig(modeNumber) {
  sounds.init();
  triggerHaptic(15);
  const modal = document.getElementById('config-modal');
  const config1 = document.getElementById('config-mode-1');
  const config2 = document.getElementById('config-mode-2');

  modal.classList.remove('hidden');

  if (modeNumber === 1) {
    config1.classList.remove('hidden');
    config2.classList.add('hidden');
  } else {
    config1.classList.add('hidden');
    config2.classList.remove('hidden');
  }
}

function closeConfigModal() {
  document.getElementById('config-modal').classList.add('hidden');
}

function openHelpModal() {
  sounds.init();
  document.getElementById('help-modal').classList.remove('hidden');
}

function closeHelpModal() {
  document.getElementById('help-modal').classList.add('hidden');
}

/* ==========================================================
   MODE 1 CONFIGURATION CONTROLLERS
   ========================================================== */
function selectFlashLevel(lvl) {
  state.flashConfig.level = lvl;
  triggerHaptic(15);
  document.querySelectorAll('.level-option').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.level, 10) === lvl);
  });
}

function updateDelaySlider(val) {
  const num = parseFloat(val);
  state.flashConfig.timeDelay = num;
  document.getElementById('delay-display-val').textContent = `${num.toFixed(1)} sec`;

  // Update preset chip highlights
  document.querySelectorAll('.preset-chip').forEach(btn => {
    btn.classList.remove('active');
  });
}

function setDelayPreset(val) {
  state.flashConfig.timeDelay = val;
  triggerHaptic(15);
  const slider = document.getElementById('time-delay-slider');
  if (slider) slider.value = val;
  document.getElementById('delay-display-val').textContent = `${val.toFixed(1)} sec`;

  document.querySelectorAll('.preset-chip').forEach(btn => {
    const txt = btn.textContent;
    btn.classList.toggle('active', txt.includes(`${val.toFixed(1)}s`) || (val === 1 && txt.includes('1.0s')) || (val === 2 && txt.includes('2.0s')) || (val === 3 && txt.includes('3.0s')));
  });
}

// Flash Count Segmented Control
function setupSegmentedControls() {
  const countBtns = document.querySelectorAll('#flash-count-selector .segment-btn');
  countBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      triggerHaptic(15);
      countBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.flashConfig.count = parseInt(btn.dataset.count, 10);
    });
  });

  const rangeBtns = document.querySelectorAll('#digit-range-selector .segment-btn');
  rangeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      triggerHaptic(15);
      rangeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.flashConfig.range = btn.dataset.range;
    });
  });

  // Mode 2 Operation Selector
  const opBtns = document.querySelectorAll('.op-chip');
  opBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      triggerHaptic(15);
      opBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.speedConfig.operation = btn.dataset.op;
    });
  });

  // Mode 2 Difficulty
  const diffBtns = document.querySelectorAll('#speed-diff-selector .segment-btn');
  diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      triggerHaptic(15);
      diffBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.speedConfig.difficulty = btn.dataset.diff;
    });
  });

  // Mode 2 Rounds
  const roundBtns = document.querySelectorAll('#speed-rounds-selector .segment-btn');
  roundBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      triggerHaptic(15);
      roundBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.speedConfig.totalRounds = parseInt(btn.dataset.rounds, 10);
    });
  });
}

/* ==========================================================
   MODE 1 ENGINE: RAPID FLASH NUMBERS
   ========================================================== */
function generateFlashSequence() {
  const { level, count, range } = state.flashConfig;
  const isSingle = range === 'single';
  const minVal = isSingle ? 1 : 10;
  const maxVal = isSingle ? 9 : 99;

  const sequence = [];
  let running = 0;

  if (level === 1) {
    // LEVEL 1: ONLY POSITIVE NUMBERS (+ve)
    for (let i = 0; i < count; i++) {
      const val = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
      running += val;
      sequence.push({
        op: '+',
        val: val,
        display: `+${val}`,
        running: running,
        type: 'add'
      });
    }
  } else if (level === 2) {
    // LEVEL 2: +ve & -ve NUMBERS
    const firstVal = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal + (isSingle ? 5 : 20);
    running = firstVal;
    sequence.push({
      op: '+',
      val: firstVal,
      display: `+${firstVal}`,
      running: running,
      type: 'add'
    });

    for (let i = 1; i < count; i++) {
      let isNegative = Math.random() < 0.45;
      let val = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;

      if (isNegative && running - val < 2) {
        if (running > 3) {
          val = Math.floor(Math.random() * (running - 1)) + 1;
        } else {
          isNegative = false;
        }
      }

      if (isNegative) {
        running -= val;
        sequence.push({
          op: '-',
          val: val,
          display: `-${val}`,
          running: running,
          type: 'sub'
        });
      } else {
        running += val;
        sequence.push({
          op: '+',
          val: val,
          display: `+${val}`,
          running: running,
          type: 'add'
        });
      }
    }
  } else {
    // LEVEL 3: (x) & (/) IN BETWEEN
    let current = Math.floor(Math.random() * 6) + 2;
    sequence.push({
      op: 'Start',
      val: current,
      display: `${current}`,
      running: current,
      type: 'start'
    });

    for (let i = 1; i < count; i++) {
      const possibleOps = ['+', '-', '×'];
      const factors = [];
      for (let f = 2; f <= 9; f++) {
        if (current % f === 0 && current / f >= 1) factors.push(f);
      }
      if (factors.length > 0 && current > 6) {
        possibleOps.push('÷');
      }

      const op = possibleOps[Math.floor(Math.random() * possibleOps.length)];

      if (op === '×') {
        const multLimit = current < 15 ? 4 : 2;
        const mult = Math.floor(Math.random() * (multLimit - 1)) + 2;
        current = current * mult;
        sequence.push({
          op: '×',
          val: mult,
          display: `× ${mult}`,
          running: current,
          type: 'mul'
        });
      } else if (op === '÷') {
        const div = factors[Math.floor(Math.random() * factors.length)];
        current = current / div;
        sequence.push({
          op: '÷',
          val: div,
          display: `÷ ${div}`,
          running: current,
          type: 'div'
        });
      } else if (op === '-') {
        const sub = Math.min(Math.floor(Math.random() * 9) + 1, Math.max(1, current - 1));
        current -= sub;
        sequence.push({
          op: '-',
          val: sub,
          display: `- ${sub}`,
          running: current,
          type: 'sub'
        });
      } else {
        const add = Math.floor(Math.random() * 12) + 2;
        current += add;
        sequence.push({
          op: '+',
          val: add,
          display: `+ ${add}`,
          running: current,
          type: 'add'
        });
      }
    }
    running = current;
  }

  state.flashGame.sequence = sequence;
  state.flashGame.targetAnswer = running;
  state.flashGame.choices = generateSmartDistractors(running);
}

function generateSmartDistractors(correct) {
  const distractors = new Set([correct]);
  const offsets = [1, -1, 2, -2, 5, -5, 10, -10, 3, -3];

  offsets.sort(() => Math.random() - 0.5);

  for (const off of offsets) {
    const val = correct + off;
    if (val !== correct && (val >= 0 || correct < 0)) {
      distractors.add(val);
      if (distractors.size === 4) break;
    }
  }

  let extra = 1;
  while (distractors.size < 4) {
    distractors.add(correct + extra * 4);
    extra++;
  }

  const arr = Array.from(distractors);
  return arr.sort(() => Math.random() - 0.5);
}

function startFlashGame() {
  closeConfigModal();
  switchScreen('game-flash-screen');

  const levelNames = {
    1: 'Lvl 1: Add (+ve)',
    2: 'Lvl 2: (+ & -)',
    3: 'Lvl 3: (×, ÷)'
  };
  document.getElementById('flash-arena-level').textContent = levelNames[state.flashConfig.level];
  document.getElementById('flash-arena-delay').textContent = `Delay: ${state.flashConfig.timeDelay.toFixed(1)}s`;

  runFlashRound();
}

function runFlashRound() {
  generateFlashSequence();

  document.getElementById('flash-prep-overlay').classList.remove('hidden');
  document.getElementById('flash-streaming-area').classList.add('hidden');
  document.getElementById('flash-answer-area').classList.add('hidden');
  document.getElementById('flash-breakdown-card').classList.add('hidden');
  document.getElementById('direct-input-box').classList.add('hidden');
  const directInput = document.getElementById('direct-input-field');
  if (directInput) directInput.value = '';

  state.flashGame.isStreaming = false;
  state.flashGame.waitingForAnswer = false;

  let prep = 3;
  const prepEl = document.getElementById('prep-countdown-number');
  prepEl.textContent = prep;
  sounds.prepBeep(false);

  const prepInterval = setInterval(() => {
    prep--;
    if (prep > 0) {
      prepEl.textContent = prep;
      sounds.prepBeep(false);
    } else if (prep === 0) {
      prepEl.textContent = 'GO!';
      sounds.prepBeep(true);
    } else {
      clearInterval(prepInterval);
      document.getElementById('flash-prep-overlay').classList.add('hidden');
      startStreamingSequence();
    }
  }, 850);
}

function startStreamingSequence() {
  const streamingArea = document.getElementById('flash-streaming-area');
  streamingArea.classList.remove('hidden');

  const flashCard = document.getElementById('flash-card');
  const heroNum = document.getElementById('flash-hero-number');
  const opBadge = document.getElementById('flash-op-badge');
  const indicator = document.getElementById('flash-step-indicator');
  const progressBar = document.getElementById('flash-progress-bar');
  const tempoText = document.getElementById('tempo-status-text');

  tempoText.textContent = `Speed: ${state.flashConfig.timeDelay.toFixed(1)}s per number`;

  const total = state.flashGame.sequence.length;
  let idx = 0;
  state.flashGame.isStreaming = true;

  function showNextNumber() {
    if (idx >= total) {
      state.flashGame.isStreaming = false;
      finishStreamingShowAnswers();
      return;
    }

    const item = state.flashGame.sequence[idx];
    indicator.textContent = `Number ${idx + 1} of ${total}`;
    progressBar.style.width = `${((idx + 1) / total) * 100}%`;

    flashCard.classList.remove('flash-pop');
    void flashCard.offsetWidth;
    flashCard.classList.add('flash-pop');

    opBadge.textContent = item.op !== 'Start' ? item.op : '';
    heroNum.textContent = item.display;
    
    if (item.type === 'sub') {
      heroNum.className = 'flash-number-hero negative';
    } else {
      heroNum.className = 'flash-number-hero positive';
    }

    sounds.flashNumber();
    idx++;

    state.flashGame.intervalId = setTimeout(showNextNumber, state.flashConfig.timeDelay * 1000);
  }

  showNextNumber();
}

function finishStreamingShowAnswers() {
  document.getElementById('flash-streaming-area').classList.add('hidden');
  const answerArea = document.getElementById('flash-answer-area');
  answerArea.classList.remove('hidden');

  state.flashGame.waitingForAnswer = true;
  const container = document.getElementById('flash-options-container');
  container.innerHTML = '';

  state.flashGame.choices.forEach((choice, index) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.type = 'button';
    btn.innerHTML = `
      <span class="option-kbd">[${index + 1}]</span>
      <span class="option-value">${choice}</span>
      <span style="width:20px"></span>
    `;
    btn.onclick = () => handleFlashAnswerSelection(choice, btn);
    container.appendChild(btn);
  });
}

function handleFlashAnswerSelection(selectedChoice, clickedBtn) {
  if (!state.flashGame.waitingForAnswer) return;
  state.flashGame.waitingForAnswer = false;

  const isCorrect = selectedChoice === state.flashGame.targetAnswer;
  state.stats.totalAnswered++;

  const allBtns = document.querySelectorAll('#flash-options-container .option-btn');
  allBtns.forEach(btn => {
    const val = parseInt(btn.querySelector('.option-value').textContent, 10);
    if (val === state.flashGame.targetAnswer) {
      btn.classList.add('correct');
    } else if (btn === clickedBtn && !isCorrect) {
      btn.classList.add('wrong');
    }
  });

  if (isCorrect) {
    sounds.correct();
    confetti.burst(window.innerWidth / 2, window.innerHeight * 0.4, 60);
    state.currentStreak++;
    state.stats.totalCorrect++;
    const points = 500 + Math.round(500 * (1 / state.flashConfig.timeDelay));
    state.totalScore += points;
  } else {
    sounds.wrong();
    state.currentStreak = 0;
  }

  saveStats();
  renderFlashBreakdown(isCorrect, selectedChoice);
}

function renderFlashBreakdown(isCorrect, selectedChoice) {
  const breakdownCard = document.getElementById('flash-breakdown-card');
  const title = document.getElementById('breakdown-result-title');
  const msg = document.getElementById('breakdown-result-msg');
  const trailContainer = document.getElementById('trail-items-container');

  breakdownCard.classList.remove('hidden');

  if (isCorrect) {
    title.textContent = '🎉 Awesome! That is Correct!';
    title.style.color = 'var(--neon-green)';
    msg.textContent = `Solved mentally at ${state.flashConfig.timeDelay.toFixed(1)}s speed!`;
  } else {
    title.textContent = '❌ Almost! Keep Practicing!';
    title.style.color = 'var(--fire-red)';
    msg.textContent = `You picked ${selectedChoice}. Correct final sum is ${state.flashGame.targetAnswer}.`;
  }

  trailContainer.innerHTML = '';
  state.flashGame.sequence.forEach((item, i) => {
    const stepSpan = document.createElement('span');
    stepSpan.className = 'trail-step';
    stepSpan.textContent = item.display;
    trailContainer.appendChild(stepSpan);

    if (i < state.flashGame.sequence.length - 1) {
      const arrow = document.createElement('span');
      arrow.className = 'trail-arrow';
      arrow.textContent = '→';
      trailContainer.appendChild(arrow);
    }
  });

  const finalEqual = document.createElement('span');
  finalEqual.className = 'trail-arrow';
  finalEqual.textContent = '=';
  trailContainer.appendChild(finalEqual);

  const finalTarget = document.createElement('span');
  finalTarget.className = 'trail-step';
  finalTarget.style.background = 'rgba(16, 185, 129, 0.25)';
  finalTarget.style.color = 'var(--neon-green)';
  finalTarget.textContent = `${state.flashGame.targetAnswer}`;
  trailContainer.appendChild(finalTarget);
}

function nextFlashRound() {
  triggerHaptic(15);
  runFlashRound();
}

function restartCurrentFlashRound() {
  triggerHaptic(15);
  runFlashRound();
}

function toggleDirectInput() {
  const box = document.getElementById('direct-input-box');
  box.classList.toggle('hidden');
  if (!box.classList.contains('hidden')) {
    const input = document.getElementById('direct-input-field');
    input.focus();
  }
}

function handleDirectInputKey(e) {
  if (e.key === 'Enter') {
    submitDirectInput();
  }
}

function submitDirectInput() {
  const input = document.getElementById('direct-input-field');
  const val = parseInt(input.value.trim(), 10);
  if (!isNaN(val)) {
    handleFlashAnswerSelection(val, null);
  }
}

/* ==========================================================
   MODE 2 ENGINE: TWO NUMBERS SPEED REFLEX
   ========================================================== */
function generateSpeedQuestion() {
  const { operation, difficulty } = state.speedConfig;

  let op = operation;
  if (op === 'mixed') {
    const ops = ['add', 'sub', 'mul', 'div'];
    op = ops[Math.floor(Math.random() * ops.length)];
  }

  let num1, num2, answer, symbol;

  if (op === 'add') {
    symbol = '+';
    if (difficulty === 'easy') {
      num1 = Math.floor(Math.random() * 12) + 1;
      num2 = Math.floor(Math.random() * 12) + 1;
    } else if (difficulty === 'medium') {
      num1 = Math.floor(Math.random() * 45) + 10;
      num2 = Math.floor(Math.random() * 45) + 10;
    } else {
      num1 = Math.floor(Math.random() * 90) + 15;
      num2 = Math.floor(Math.random() * 90) + 15;
    }
    answer = num1 + num2;
  } else if (op === 'sub') {
    symbol = '-';
    if (difficulty === 'easy') {
      num2 = Math.floor(Math.random() * 9) + 1;
      num1 = num2 + Math.floor(Math.random() * 10) + 1;
    } else if (difficulty === 'medium') {
      num2 = Math.floor(Math.random() * 35) + 10;
      num1 = num2 + Math.floor(Math.random() * 40) + 5;
    } else {
      num2 = Math.floor(Math.random() * 70) + 20;
      num1 = num2 + Math.floor(Math.random() * 80) + 10;
    }
    answer = num1 - num2;
  } else if (op === 'mul') {
    symbol = '×';
    if (difficulty === 'easy') {
      num1 = Math.floor(Math.random() * 9) + 2;
      num2 = Math.floor(Math.random() * 9) + 2;
    } else if (difficulty === 'medium') {
      num1 = Math.floor(Math.random() * 12) + 3;
      num2 = Math.floor(Math.random() * 9) + 2;
    } else {
      num1 = Math.floor(Math.random() * 16) + 4;
      num2 = Math.floor(Math.random() * 14) + 3;
    }
    answer = num1 * num2;
  } else {
    symbol = '÷';
    if (difficulty === 'easy') {
      num2 = Math.floor(Math.random() * 8) + 2;
      const quotient = Math.floor(Math.random() * 8) + 1;
      num1 = num2 * quotient;
      answer = quotient;
    } else if (difficulty === 'medium') {
      num2 = Math.floor(Math.random() * 11) + 2;
      const quotient = Math.floor(Math.random() * 12) + 2;
      num1 = num2 * quotient;
      answer = quotient;
    } else {
      num2 = Math.floor(Math.random() * 15) + 3;
      const quotient = Math.floor(Math.random() * 18) + 3;
      num1 = num2 * quotient;
      answer = quotient;
    }
  }

  const choices = generateSmartDistractors(answer);

  return {
    num1,
    num2,
    symbol,
    answer,
    choices
  };
}

function startSpeedGame() {
  closeConfigModal();
  switchScreen('game-speed-screen');

  state.speedGame.currentRound = 0;
  state.speedGame.score = 0;
  state.speedGame.streak = 0;
  state.speedGame.maxStreak = 0;
  state.speedGame.history = [];

  document.getElementById('speed-live-score').textContent = 'Score: 0';
  nextSpeedQuestion();
}

function nextSpeedQuestion() {
  state.speedGame.currentRound++;
  const { currentRound } = state.speedGame;
  const { totalRounds } = state.speedConfig;

  if (currentRound > totalRounds) {
    finishSpeedGame();
    return;
  }

  document.getElementById('speed-q-tracker').textContent = `Question ${currentRound} / ${totalRounds}`;
  
  const streakTag = document.getElementById('speed-streak-tag');
  if (state.speedGame.streak >= 2) {
    streakTag.classList.remove('hidden');
    streakTag.textContent = `🔥 ${state.speedGame.streak}X COMBO!`;
  } else {
    streakTag.classList.add('hidden');
  }

  const q = generateSpeedQuestion();
  state.speedGame.currentQuestion = q;

  document.getElementById('speed-num1').textContent = q.num1;
  document.getElementById('speed-operator').textContent = q.symbol;
  document.getElementById('speed-num2').textContent = q.num2;

  const container = document.getElementById('speed-options-container');
  container.innerHTML = '';

  q.choices.forEach((choice, idx) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.type = 'button';
    btn.innerHTML = `
      <span class="option-kbd">[${idx + 1}]</span>
      <span class="option-value">${choice}</span>
      <span style="width:20px"></span>
    `;
    btn.onclick = () => handleSpeedAnswer(choice, btn);
    container.appendChild(btn);
  });

  startSpeedQuestionTimer();
}

function calculateSpeedPoints(timeTakenMs) {
  const maxTime = state.speedGame.maxQuestionTime;
  const clampedTime = Math.min(timeTakenMs, maxTime);
  const timeFraction = clampedTime / maxTime;

  const rawPoints = Math.round(1000 * Math.pow(1 - timeFraction * 0.9, 1.2));
  return Math.max(100, rawPoints);
}

function startSpeedQuestionTimer() {
  clearInterval(state.speedGame.timerInterval);
  state.speedGame.startTime = Date.now();

  const timerBar = document.getElementById('speed-timer-bar');
  const liveTimeEl = document.getElementById('live-time-counter');
  const dynamicPtsEl = document.getElementById('potential-points-val');

  timerBar.style.width = '100%';

  state.speedGame.timerInterval = setInterval(() => {
    const elapsed = Date.now() - state.speedGame.startTime;
    const remaining = Math.max(0, state.speedGame.maxQuestionTime - elapsed);
    const fraction = remaining / state.speedGame.maxQuestionTime;

    timerBar.style.width = `${fraction * 100}%`;
    liveTimeEl.textContent = `${(elapsed / 1000).toFixed(2)}s`;

    const potentialPoints = calculateSpeedPoints(elapsed);
    dynamicPtsEl.textContent = potentialPoints;

    if (remaining <= 0) {
      clearInterval(state.speedGame.timerInterval);
      handleSpeedTimeOut();
    }
  }, 30);
}

function handleSpeedAnswer(userChoice, clickedBtn) {
  clearInterval(state.speedGame.timerInterval);
  const timeTaken = Date.now() - state.speedGame.startTime;
  const q = state.speedGame.currentQuestion;
  const isCorrect = userChoice === q.answer;

  state.stats.totalAnswered++;

  if (isCorrect) {
    if (!state.stats.fastestReflex || timeTaken < state.stats.fastestReflex) {
      state.stats.fastestReflex = timeTaken;
    }
  }

  const allBtns = document.querySelectorAll('#speed-options-container .option-btn');
  allBtns.forEach(btn => {
    btn.disabled = true;
    const val = parseInt(btn.querySelector('.option-value').textContent, 10);
    if (val === q.answer) {
      btn.classList.add('correct');
    } else if (btn === clickedBtn && !isCorrect) {
      btn.classList.add('wrong');
    }
  });

  let pointsEarned = 0;
  if (isCorrect) {
    state.stats.totalCorrect++;
    state.speedGame.streak++;
    if (state.speedGame.streak > state.speedGame.maxStreak) {
      state.speedGame.maxStreak = state.speedGame.streak;
    }

    const basePoints = calculateSpeedPoints(timeTaken);
    const comboMultiplier = 1 + Math.min(1.0, (state.speedGame.streak - 1) * 0.15);
    pointsEarned = Math.round(basePoints * comboMultiplier);

    state.speedGame.score += pointsEarned;
    state.totalScore += pointsEarned;
    state.currentStreak = state.speedGame.streak;

    sounds.speedBonus();
    showSpeedFeedback(timeTaken, pointsEarned);

    if (timeTaken < 1000) {
      confetti.burst(window.innerWidth / 2, window.innerHeight * 0.45, 40);
    }
  } else {
    sounds.wrong();
    state.speedGame.streak = 0;
    state.currentStreak = 0;
  }

  state.speedGame.history.push({
    equation: `${q.num1} ${q.symbol} ${q.num2}`,
    correctAnswer: q.answer,
    userChoice: userChoice,
    isCorrect: isCorrect,
    timeTaken: timeTaken,
    points: pointsEarned
  });

  document.getElementById('speed-live-score').textContent = `Score: ${state.speedGame.score}`;
  saveStats();

  setTimeout(() => {
    nextSpeedQuestion();
  }, 900);
}

function handleSpeedTimeOut() {
  const q = state.speedGame.currentQuestion;
  sounds.wrong();
  state.stats.totalAnswered++;
  state.speedGame.streak = 0;
  state.currentStreak = 0;

  const allBtns = document.querySelectorAll('#speed-options-container .option-btn');
  allBtns.forEach(btn => {
    btn.disabled = true;
    const val = parseInt(btn.querySelector('.option-value').textContent, 10);
    if (val === q.answer) btn.classList.add('correct');
  });

  state.speedGame.history.push({
    equation: `${q.num1} ${q.symbol} ${q.num2}`,
    correctAnswer: q.answer,
    userChoice: 'Timed Out',
    isCorrect: false,
    timeTaken: state.speedGame.maxQuestionTime,
    points: 0
  });

  saveStats();
  setTimeout(() => {
    nextSpeedQuestion();
  }, 1000);
}

function showSpeedFeedback(timeTakenMs, points) {
  const overlay = document.getElementById('speed-feedback-overlay');
  const badge = document.getElementById('feedback-badge-content');
  const icon = badge.querySelector('.fb-icon');
  const txt = badge.querySelector('.fb-text');
  const score = badge.querySelector('.fb-score');

  const secs = (timeTakenMs / 1000).toFixed(2);

  if (timeTakenMs < 1000) {
    icon.textContent = '⚡';
    txt.textContent = `LIGHTNING! (${secs}s)`;
  } else if (timeTakenMs < 2000) {
    icon.textContent = '🔥';
    txt.textContent = `RAPID! (${secs}s)`;
  } else if (timeTakenMs < 3500) {
    icon.textContent = '👍';
    txt.textContent = `GOOD (${secs}s)`;
  } else {
    icon.textContent = '🐢';
    txt.textContent = `CORRECT (${secs}s)`;
  }

  score.textContent = `+${points} PTS`;
  overlay.classList.remove('hidden');

  setTimeout(() => {
    overlay.classList.add('hidden');
  }, 700);
}

function finishSpeedGame() {
  state.stats.gamesPlayed++;
  if (state.speedGame.score > state.stats.bestMode2Score) {
    state.stats.bestMode2Score = state.speedGame.score;
  }
  saveStats();

  sounds.fanfare();
  confetti.burst(window.innerWidth / 2, window.innerHeight * 0.35, 90);

  switchScreen('results-screen');
  renderResultsSummary();
}

function renderResultsSummary() {
  const history = state.speedGame.history;
  const total = history.length;
  const correctCount = history.filter(h => h.isCorrect).length;
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  const totalTime = history.reduce((acc, h) => acc + h.timeTaken, 0);
  const avgTime = total > 0 ? (totalTime / total / 1000).toFixed(2) : '0.00';

  document.getElementById('res-score').textContent = state.speedGame.score;
  document.getElementById('res-accuracy').textContent = `${accuracy}%`;
  document.getElementById('res-avg-time').textContent = `${avgTime}s`;
  document.getElementById('res-best-streak').textContent = state.speedGame.maxStreak;

  const titleEl = document.getElementById('results-title');
  const subEl = document.getElementById('results-subtitle');
  const trophyEl = document.getElementById('results-trophy-emoji');

  if (accuracy >= 90 && parseFloat(avgTime) <= 1.5) {
    trophyEl.textContent = '👑';
    titleEl.textContent = 'Grand Math Master!';
    subEl.textContent = 'Incredible speed & precision! Top tier reflex!';
  } else if (accuracy >= 80) {
    trophyEl.textContent = '🏆';
    titleEl.textContent = 'Speed Prodigy!';
    subEl.textContent = 'Fast calculations and great mental rhythm!';
  } else {
    trophyEl.textContent = '🔥';
    titleEl.textContent = 'Workout Completed!';
    subEl.textContent = 'Keep training to lower your reaction time!';
  }

  const listEl = document.getElementById('review-items-list');
  listEl.innerHTML = '';

  history.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = `review-row ${item.isCorrect ? 'correct' : 'wrong'}`;
    const timeSec = (item.timeTaken / 1000).toFixed(2);

    row.innerHTML = `
      <div class="review-eq">${idx + 1}. ${item.equation} = <strong>${item.correctAnswer}</strong></div>
      <div class="review-meta">
        <span class="review-time">⏱️ ${timeSec}s</span>
        <span class="review-points">${item.isCorrect ? `+${item.points} pts` : '❌ 0 pts'}</span>
      </div>
    `;
    listEl.appendChild(row);
  });

  const playAgainBtn = document.getElementById('results-play-again-btn');
  playAgainBtn.onclick = () => {
    triggerHaptic(20);
    startSpeedGame();
  };
}

/* ==========================================================
   KEYBOARD SHORTCUTS CONTROLLER
   ========================================================== */
function setupKeyboardListeners() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const configModal = document.getElementById('config-modal');
      const helpModal = document.getElementById('help-modal');
      if (!configModal.classList.contains('hidden')) {
        closeConfigModal();
        return;
      }
      if (!helpModal.classList.contains('hidden')) {
        closeHelpModal();
        return;
      }
    }

    if (document.activeElement && document.activeElement.tagName === 'INPUT') {
      return;
    }

    const keyMap = { '1': 0, '2': 1, '3': 2, '4': 3 };
    if (keyMap.hasOwnProperty(e.key)) {
      const idx = keyMap[e.key];

      if (state.flashGame.waitingForAnswer) {
        const btns = document.querySelectorAll('#flash-options-container .option-btn');
        if (btns[idx]) {
          btns[idx].click();
        }
      }

      const speedScreen = document.getElementById('game-speed-screen');
      if (speedScreen.classList.contains('active')) {
        const btns = document.querySelectorAll('#speed-options-container .option-btn');
        if (btns[idx] && !btns[idx].disabled) {
          btns[idx].click();
        }
      }
    }
  });
}

/* ==========================================================
   INITIALIZATION
   ========================================================== */
document.addEventListener('DOMContentLoaded', () => {
  loadSavedStats();
  setupSegmentedControls();
  setupKeyboardListeners();

  // Audio warmup on first user touch/click anywhere (iOS Safari policy)
  const unlockAudio = () => {
    sounds.init();
    window.removeEventListener('touchstart', unlockAudio);
    window.removeEventListener('click', unlockAudio);
  };
  window.addEventListener('touchstart', unlockAudio, { passive: true });
  window.addEventListener('click', unlockAudio, { passive: true });

  const homeBtn = document.getElementById('home-nav-btn');
  if (homeBtn) {
    homeBtn.addEventListener('click', () => {
      triggerHaptic(15);
      returnToDashboard();
    });
  }

  const soundBtn = document.getElementById('sound-toggle-btn');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      sounds.init();
      if (state.soundEnabled) sounds.tick();
      triggerHaptic(20);
      saveStats();
    });
  }

  const helpBtn = document.getElementById('help-modal-btn');
  if (helpBtn) {
    helpBtn.addEventListener('click', openHelpModal);
  }

  initWelcomeScreen();
});
