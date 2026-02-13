import './style.css';

const app = document.querySelector('#app');

app.innerHTML = `
  <div class="sky" id="sky"></div>
  <button class="music-toggle" id="musicToggle" type="button" aria-pressed="false">Music: Off</button>
  <div class="title-wrap">
    <h1>Happy Valentine's Day Humay 🌷</h1>
    <p>Mini quest: collect 5 red hearts</p>
    <p class="progress" id="progress">Collected: 0 / 5</p>
  </div>
  <div class="proposal-panel" id="proposalPanel">
    <div class="proposal-card">
      <h2>Now... will you be my valentine?</h2>
      <div class="proposal-choices" id="proposalChoices">
        <button class="choice-ball yes-ball" id="yesBall" type="button">YES</button>
        <button class="choice-ball no-ball" id="noBall" type="button">NO</button>
      </div>
    </div>
  </div>
`;

const sky = document.querySelector('#sky');
const progress = document.querySelector('#progress');
const proposalPanel = document.querySelector('#proposalPanel');
const proposalChoices = document.querySelector('#proposalChoices');
const yesBall = document.querySelector('#yesBall');
const noBall = document.querySelector('#noBall');
const musicToggle = document.querySelector('#musicToggle');
let noBallX = 0;
let noBallY = 0;
let lastNoBallMoveAt = 0;
let homeBgm;
let isMusicOn = false;

const HEART_MASK = [
  '0011001100',
  '0111111110',
  '1111111111',
  '1111111111',
  '0111111110',
  '0011111100',
  '0001111000',
  '0000110000',
];

const ASCII_START = 33;
const ASCII_END = 126;
const RED_TOKENS = ['luv', '^_^', '<3 ', 'xo '];
const GOAL_RED_HEARTS = 5;
let collectedRedHearts = 0;
let proposalShown = false;

function makeAsciiToken() {
  const first = String.fromCharCode(
    Math.floor(Math.random() * (ASCII_END - ASCII_START + 1)) + ASCII_START
  );
  const second = String.fromCharCode(
    Math.floor(Math.random() * (ASCII_END - ASCII_START + 1)) + ASCII_START
  );
  return `${first}${second}`;
}

function makeRedToken() {
  return RED_TOKENS[Math.floor(Math.random() * RED_TOKENS.length)];
}

function makeAsciiHeart(tokenFactory = makeAsciiToken, emptyToken = '  ') {
  return HEART_MASK.map((row) =>
    row
      .split('')
      .map((bit) => (bit === '1' ? tokenFactory() : emptyToken))
      .join(' ')
  ).join('\n');
}

function shuffleArray(values) {
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
}

function createHeart(i, left) {
  const heart = document.createElement('pre');
  heart.className = 'ascii-heart';
  heart.textContent = makeAsciiHeart();

  const delay = -Math.random() * 24;
  const fallDuration = 18 + Math.random() * 16;
  const swayDuration = 4 + Math.random() * 5;
  const swayAmount = 10 + Math.random() * 24;
  const rotation = -8 + Math.random() * 16;
  const scale = 0.45 + Math.random() * 0.7;
  const opacity = 0.4 + Math.random() * 0.55;

  heart.style.left = `${left}vw`;
  heart.style.top = '-30vh';
  heart.style.opacity = `${opacity}`;
  heart.style.transform = `scale(${scale}) rotate(${rotation}deg)`;
  heart.style.animationDuration = `${fallDuration}s, ${swayDuration}s`;
  heart.style.animationDelay = `${delay}s, ${delay}s`;
  heart.style.setProperty('--sway', `${swayAmount}px`);

  sky.appendChild(heart);

  setInterval(() => {
    heart.textContent = makeAsciiHeart();
  }, 5000 + i * 70);
}

function updateProgress() {
  progress.textContent = `Collected: ${collectedRedHearts} / ${GOAL_RED_HEARTS}`;
  if (collectedRedHearts >= GOAL_RED_HEARTS && !proposalShown) {
    progress.textContent = 'Quest complete!';
    proposalShown = true;
    openProposalPanel();
  }
}

function dodgeHeart(heart) {
  const current = Number.parseFloat(heart.style.left || '50');
  const direction = Math.random() < 0.5 ? -1 : 1;
  const jump = 10 + Math.random() * 14;
  const nextLeft = Math.min(96, Math.max(3, current + direction * jump));
  heart.style.left = `${nextLeft}vw`;
}

function spawnCollectibleHeart() {
  if (collectedRedHearts >= GOAL_RED_HEARTS) {
    return;
  }

  const heart = document.createElement('pre');
  heart.className = 'ascii-heart collectible-heart evasive-heart';
  heart.textContent = makeAsciiHeart(makeRedToken, '   ');

  const left = 4 + Math.random() * 92;
  const fallDuration = 18 + Math.random() * 8;
  const swayDuration = 4 + Math.random() * 5;
  const swayAmount = 12 + Math.random() * 20;
  const rotation = -10 + Math.random() * 20;
  const scale = 0.5 + Math.random() * 0.45;

  heart.style.left = `${left}vw`;
  heart.style.top = '-30vh';
  heart.style.opacity = '0.98';
  heart.style.transform = `scale(${scale}) rotate(${rotation}deg)`;
  heart.style.transition = 'left 90ms linear';
  heart.style.animationDuration = `${fallDuration}s, ${swayDuration}s`;
  heart.style.animationDelay = '0s, 0s';
  heart.style.animationIterationCount = '1, 1';
  heart.style.animationFillMode = 'forwards, forwards';
  heart.style.setProperty('--sway', `${swayAmount}px`);

  heart.addEventListener('click', () => {
    if (heart.dataset.collected === '1') {
      return;
    }
    heart.dataset.collected = '1';
    collectedRedHearts += 1;
    updateProgress();
    heart.classList.add('collected');
    setTimeout(() => {
      heart.remove();
    }, 140);
  });

  heart.addEventListener('pointerenter', () => {
    dodgeHeart(heart);
  });
  heart.addEventListener('pointermove', () => {
    const now = performance.now();
    const nextMoveAt = Number(heart.dataset.nextMoveAt || 0);
    if (now >= nextMoveAt) {
      heart.dataset.nextMoveAt = String(now + 95);
      dodgeHeart(heart);
    }
  });

  sky.appendChild(heart);
  setTimeout(() => heart.remove(), fallDuration * 1000 + 600);
}

function moveNoBallAway(force = false) {
  const now = performance.now();
  if (!force && now - lastNoBallMoveAt < 45) {
    return;
  }
  lastNoBallMoveAt = now;

  const arenaRect = proposalChoices.getBoundingClientRect();
  const ballWidth = noBall.offsetWidth || 90;
  const ballHeight = noBall.offsetHeight || 90;
  const maxX = Math.max(0, arenaRect.width - ballWidth);
  const maxY = Math.max(0, arenaRect.height - ballHeight);
  noBallX = Math.random() * maxX;
  noBallY = Math.random() * maxY;
  noBall.style.left = `${noBallX}px`;
  noBall.style.top = `${noBallY}px`;
}

function openProposalPanel() {
  proposalPanel.classList.add('open');
  noBallX = noBall.offsetLeft || 0;
  noBallY = noBall.offsetTop || 0;
  moveNoBallAway(true);
}

function setupProposalGame() {
  yesBall.addEventListener('click', () => {
    window.location.href = '/spotlight.html';
  });

  noBall.addEventListener('pointerenter', () => moveNoBallAway(true));
  noBall.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    moveNoBallAway(true);
  });

  proposalChoices.addEventListener('pointermove', (event) => {
    if (!proposalPanel.classList.contains('open')) {
      return;
    }
    const arenaRect = proposalChoices.getBoundingClientRect();
    const localX = event.clientX - arenaRect.left;
    const localY = event.clientY - arenaRect.top;
    const ballCenterX = noBallX + (noBall.offsetWidth || 90) / 2;
    const ballCenterY = noBallY + (noBall.offsetHeight || 90) / 2;
    const dx = localX - ballCenterX;
    const dy = localY - ballCenterY;
    const distance = Math.hypot(dx, dy);
    if (distance < 120) {
      moveNoBallAway();
    }
  });
}

function updateMusicToggleLabel() {
  musicToggle.textContent = `Music: ${isMusicOn ? 'On' : 'Off'}`;
  musicToggle.setAttribute('aria-pressed', isMusicOn ? 'true' : 'false');
  musicToggle.classList.toggle('on', isMusicOn);
}

function setupHomeBgm() {
  homeBgm = new Audio('/bgm/payphone-maroon5.mp3');
  homeBgm.loop = true;
  homeBgm.volume = 0.32;
  homeBgm.preload = 'auto';
  updateMusicToggleLabel();

  musicToggle.addEventListener('click', async () => {
    if (!homeBgm) {
      return;
    }

    if (isMusicOn) {
      homeBgm.pause();
      isMusicOn = false;
      updateMusicToggleLabel();
      return;
    }

    try {
      await homeBgm.play();
      isMusicOn = true;
      updateMusicToggleLabel();
    } catch {
      isMusicOn = false;
      updateMusicToggleLabel();
    }
  });
}

const HEART_COUNT = 42;
const slotWidth = 100 / HEART_COUNT;
const horizontalSlots = Array.from({ length: HEART_COUNT }, (_, i) => {
  const center = (i + 0.5) * slotWidth;
  const jitter = (Math.random() - 0.5) * slotWidth * 0.7;
  return Math.min(99, Math.max(1, center + jitter));
});

shuffleArray(horizontalSlots);

for (let i = 0; i < HEART_COUNT; i += 1) {
  createHeart(i, horizontalSlots[i]);
}

updateProgress();
setupProposalGame();
setupHomeBgm();
spawnCollectibleHeart();
setInterval(spawnCollectibleHeart, 4000);
