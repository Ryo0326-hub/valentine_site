import './spotlight.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';

let renderer;
let scene;
let camera;
let spotLight;
let starField;
let chestBalloonRig;
let bgmAudio;
let gamePanel;
let gamePanelBody;
let letterOverlay;
let hasRevealedCode = false;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clickableObjects = [];
const TREASURE_CHEST_CODE = '696969';
const COURSE_ANSWER_PATTERN = /co\s*-?\s*250/i;

const TEXTURE_BASE_URL = 'https://threejs.org/examples/textures/';
const MODEL_URL = 'https://threejs.org/examples/models/ply/binary/Lucy100k.ply';
const DEFAULT_LIGHT_SETTINGS = {
  map: 'disturb.png',
  color: 0x80a9ea,
  intensity: 358.5,
  distance: 12.38,
  angle: 1.0471975511965976,
  penumbra: 0.176,
  decay: 1.324,
  focus: 1,
  shadowIntensity: 0.238,
};

init();

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animate);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  document.body.appendChild(renderer.domElement);
  setupBgm();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x01030b);
  starField = createStarField();
  scene.add(starField);

  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(1, 0.35, 7);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = 2;
  controls.maxDistance = 10;
  controls.maxPolarAngle = Math.PI;
  controls.target.set(0, 0.8, 0);
  controls.update();

  const textureLoader = new THREE.TextureLoader();
  const filenames = ['disturb.jpg', 'colors.png', 'uv_grid_opengl.jpg'];
  const textures = { none: null };

  for (const filename of filenames) {
    const texture = textureLoader.load(`${TEXTURE_BASE_URL}${filename}`);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    textures[filename] = texture;
  }
  textures['disturb.png'] = textures['disturb.jpg'];

  const ambient = new THREE.HemisphereLight(0xffffff, 0x8d8d8d, 0.25);
  scene.add(ambient);

  spotLight = new THREE.SpotLight(DEFAULT_LIGHT_SETTINGS.color, DEFAULT_LIGHT_SETTINGS.intensity);
  spotLight.name = 'spotLight';
  spotLight.map = textures[DEFAULT_LIGHT_SETTINGS.map];
  spotLight.position.set(2.5, 5, 2.5);
  spotLight.angle = DEFAULT_LIGHT_SETTINGS.angle;
  spotLight.penumbra = DEFAULT_LIGHT_SETTINGS.penumbra;
  spotLight.decay = DEFAULT_LIGHT_SETTINGS.decay;
  spotLight.distance = DEFAULT_LIGHT_SETTINGS.distance;
  spotLight.castShadow = true;
  spotLight.shadow.mapSize.width = 1024;
  spotLight.shadow.mapSize.height = 1024;
  spotLight.shadow.camera.near = 2;
  spotLight.shadow.camera.far = 10;
  spotLight.shadow.focus = DEFAULT_LIGHT_SETTINGS.focus;
  spotLight.shadow.bias = -0.003;
  spotLight.shadow.intensity = DEFAULT_LIGHT_SETTINGS.shadowIntensity;
  scene.add(spotLight);

  const planeGeometry = new THREE.PlaneGeometry(200, 200);
  const planeMaterial = new THREE.MeshLambertMaterial({ color: 0xbcbcbc });
  const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.position.set(0, -1, 0);
  plane.rotation.x = -Math.PI / 2;
  plane.receiveShadow = true;
  scene.add(plane);

  const treasureChest = createTreasureChest();
  treasureChest.position.set(1.25, -1, 0.75);
  treasureChest.rotation.y = -0.4;
  chestBalloonRig = createChestBalloons();
  treasureChest.add(chestBalloonRig);
  scene.add(treasureChest);

  const chestHitbox = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 1.1, 1.0),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
  );
  chestHitbox.position.set(0, 0.56, 0);
  chestHitbox.userData.action = 'open-chest';
  treasureChest.add(chestHitbox);
  clickableObjects.push(chestHitbox);

  const tulipTable = createTulipTable();
  tulipTable.position.set(-1.35, -1, 0.58);
  tulipTable.rotation.y = 0.4;
  scene.add(tulipTable);

  setupGamePanel();
  setupLetterOverlay();
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);

  new PLYLoader().load(MODEL_URL, (geometry) => {
    geometry.scale(0.0024, 0.0024, 0.0024);
    geometry.computeVertexNormals();

    const material = new THREE.MeshLambertMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.y = Math.PI;
    mesh.position.y = 0.8;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  });

  window.addEventListener('resize', onWindowResize);
}

function setupBgm() {
  bgmAudio = new Audio('/bgm/grimm-troupe.mp3');
  bgmAudio.loop = true;
  bgmAudio.volume = 0.35;
  bgmAudio.preload = 'auto';

  // Try autoplay first; browsers may block until user gesture.
  bgmAudio.play().catch(() => {});

  const resumeBgm = () => {
    if (!bgmAudio) {
      return;
    }
    bgmAudio.play().catch(() => {});
  };

  window.addEventListener('pointerdown', resumeBgm, { once: true });
  window.addEventListener('keydown', resumeBgm, { once: true });
}

function createStarField() {
  const starCount = 5000;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const color = new THREE.Color();

  for (let i = 0; i < starCount; i += 1) {
    const i3 = i * 3;
    const radius = 80 + Math.random() * 220;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = radius * Math.cos(phi);
    positions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

    const lightness = 0.75 + Math.random() * 0.25;
    const hue = 0.55 + Math.random() * 0.08;
    color.setHSL(hue, 0.35, lightness);
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.7,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geometry, material);
}

function createTreasureChest() {
  const chest = new THREE.Group();

  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0x6f3f1f,
    roughness: 0.85,
    metalness: 0.15,
  });
  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0xc9a441,
    roughness: 0.35,
    metalness: 0.9,
  });

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.55, 0.85), woodMaterial);
  base.position.y = 0.28;
  chest.add(base);

  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 1.35, 24, 1, false, 0, Math.PI),
    woodMaterial
  );
  lid.rotation.z = Math.PI / 2;
  lid.position.y = 0.56;
  chest.add(lid);

  const frontBand = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.1, 0.06), metalMaterial);
  frontBand.position.set(0, 0.25, 0.455);
  chest.add(frontBand);

  const topBand = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.08, 0.06), metalMaterial);
  topBand.position.set(0, 0.66, 0.06);
  chest.add(topBand);

  const sideBandLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.85), metalMaterial);
  sideBandLeft.position.set(-0.52, 0.42, 0);
  chest.add(sideBandLeft);

  const sideBandRight = sideBandLeft.clone();
  sideBandRight.position.x = 0.52;
  chest.add(sideBandRight);

  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.08), metalMaterial);
  lock.position.set(0, 0.3, 0.47);
  chest.add(lock);

  const footGeometry = new THREE.BoxGeometry(0.14, 0.08, 0.14);
  const feet = [
    [-0.54, 0.04, -0.32],
    [0.54, 0.04, -0.32],
    [-0.54, 0.04, 0.32],
    [0.54, 0.04, 0.32],
  ];
  for (const [x, y, z] of feet) {
    const foot = new THREE.Mesh(footGeometry, metalMaterial);
    foot.position.set(x, y, z);
    chest.add(foot);
  }

  chest.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });

  return chest;
}

function createChestBalloons() {
  const rig = new THREE.Group();
  rig.position.set(0, 0.78, -0.06);

  const balloonConfigs = [
    { color: 0xff2d3f, x: -0.25, z: 0.03, lift: 1.3, sway: 0.08, phase: 0.0 },
    { color: 0x3f8fff, x: 0.04, z: -0.03, lift: 1.55, sway: 0.09, phase: 1.6 },
    { color: 0xff76ba, x: 0.3, z: 0.05, lift: 1.42, sway: 0.085, phase: 3.1 },
  ];

  const stringMaterial = new THREE.MeshStandardMaterial({
    color: 0xcfd6e6,
    roughness: 0.9,
    metalness: 0.05,
  });

  for (const config of balloonConfigs) {
    const balloonMaterial = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.35,
      metalness: 0.08,
    });

    const balloon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 16), balloonMaterial);
    balloon.scale.set(1, 1.15, 1);
    balloon.position.set(config.x, config.lift, config.z);
    balloon.userData.baseY = config.lift;
    balloon.userData.baseX = config.x;
    balloon.userData.sway = config.sway;
    balloon.userData.phase = config.phase;
    rig.add(balloon);

    const knot = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 10), balloonMaterial);
    knot.position.set(config.x, config.lift - 0.22, config.z);
    knot.rotation.x = Math.PI;
    knot.userData.baseY = config.lift - 0.22;
    knot.userData.baseX = config.x;
    knot.userData.phase = config.phase;
    rig.add(knot);

    const stringLength = config.lift - 0.05;
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, stringLength, 8), stringMaterial);
    string.position.set(config.x, stringLength / 2, config.z);
    string.userData.baseX = config.x;
    string.userData.baseY = stringLength / 2;
    string.userData.phase = config.phase;
    rig.add(string);
  }

  rig.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });

  return rig;
}

function createTulipTable() {
  const setup = new THREE.Group();

  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0x5d3a22,
    roughness: 0.85,
    metalness: 0.1,
  });
  const vaseMaterial = new THREE.MeshStandardMaterial({
    color: 0x9ec8ff,
    roughness: 0.25,
    metalness: 0.25,
    transparent: true,
    opacity: 0.88,
  });
  const stemMaterial = new THREE.MeshStandardMaterial({
    color: 0x2f9a53,
    roughness: 0.7,
    metalness: 0.05,
  });

  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 1.0), woodMaterial);
  tableTop.position.y = 0.78;
  setup.add(tableTop);

  const legGeometry = new THREE.BoxGeometry(0.1, 0.78, 0.1);
  const legPositions = [
    [-0.8, 0.39, -0.4],
    [0.8, 0.39, -0.4],
    [-0.8, 0.39, 0.4],
    [0.8, 0.39, 0.4],
  ];
  for (const [x, y, z] of legPositions) {
    const leg = new THREE.Mesh(legGeometry, woodMaterial);
    leg.position.set(x, y, z);
    setup.add(leg);
  }

  const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 0.42, 24), vaseMaterial);
  vase.position.y = 1.05;
  setup.add(vase);

  const envelope = createEnvelopeWithHeartSticker();
  envelope.position.set(0.02, 1.02, 0.28);
  envelope.rotation.set(0.04, 0.02, -0.08);
  setup.add(envelope);

  const envelopeHitbox = new THREE.Mesh(
    new THREE.BoxGeometry(0.37, 0.28, 0.08),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 })
  );
  envelopeHitbox.position.set(0.02, 1.02, 0.28);
  envelopeHitbox.rotation.copy(envelope.rotation);
  envelopeHitbox.userData.action = 'open-letter';
  setup.add(envelopeHitbox);
  clickableObjects.push(envelopeHitbox);

  const tulipColors = [0xff4f8a, 0xff7fb5, 0xff5e9f, 0xff7398, 0xff6680];
  const tulipOffsets = [
    [-0.11, 0.98, -0.05, -0.28, 0.18],
    [0.1, 0.98, -0.04, 0.26, -0.22],
    [0.0, 1.0, 0.08, 0.0, 0.08],
    [-0.05, 0.99, 0.02, -0.2, -0.1],
    [0.05, 0.99, 0.0, 0.17, 0.15],
  ];

  tulipOffsets.forEach(([x, y, z, tiltX, tiltZ], i) => {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.56, 10), stemMaterial);
    stem.position.set(x, y + 0.29, z);
    stem.rotation.x = tiltX;
    stem.rotation.z = tiltZ;
    setup.add(stem);

    const flower = createTulipHead(tulipColors[i % tulipColors.length]);
    flower.position.set(x + tiltZ * 0.11, y + 0.56, z - tiltX * 0.11);
    setup.add(flower);
  });

  setup.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });

  return setup;
}

function createTulipHead(colorHex) {
  const tulip = new THREE.Group();
  const petalMaterial = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.42,
    metalness: 0.08,
  });

  const bud = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), petalMaterial);
  bud.scale.set(0.9, 1.2, 0.9);
  tulip.add(bud);

  const petalGeometry = new THREE.ConeGeometry(0.06, 0.14, 12);
  const frontPetal = new THREE.Mesh(petalGeometry, petalMaterial);
  frontPetal.position.set(0, 0.02, 0.04);
  frontPetal.rotation.x = 0.48;
  tulip.add(frontPetal);

  const leftPetal = frontPetal.clone();
  leftPetal.position.set(-0.035, 0.015, -0.005);
  leftPetal.rotation.set(0.28, 0.55, 0.18);
  tulip.add(leftPetal);

  const rightPetal = frontPetal.clone();
  rightPetal.position.set(0.035, 0.015, -0.005);
  rightPetal.rotation.set(0.28, -0.55, -0.18);
  tulip.add(rightPetal);

  tulip.rotation.y = Math.random() * Math.PI * 2;
  return tulip;
}

function createEnvelopeWithHeartSticker() {
  const envelope = new THREE.Group();

  const paperMaterial = new THREE.MeshStandardMaterial({
    color: 0xf8f1e6,
    roughness: 0.7,
    metalness: 0.02,
  });
  const foldMaterial = new THREE.MeshStandardMaterial({
    color: 0xeadfcd,
    roughness: 0.72,
    metalness: 0.02,
  });
  const stickerMaterial = new THREE.MeshStandardMaterial({
    color: 0xff4f8a,
    roughness: 0.45,
    metalness: 0.05,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.23, 0.014), paperMaterial);
  body.position.z = 0.001;
  envelope.add(body);

  const flapShape = new THREE.Shape();
  flapShape.moveTo(-0.16, 0.06);
  flapShape.lineTo(0.16, 0.06);
  flapShape.lineTo(0, -0.075);
  flapShape.lineTo(-0.16, 0.06);

  const flap = new THREE.Mesh(new THREE.ShapeGeometry(flapShape), foldMaterial);
  flap.position.set(0, 0.02, 0.0085);
  envelope.add(flap);

  const seamLine = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.008, 0.006), foldMaterial);
  seamLine.position.set(0, 0.06, 0.008);
  envelope.add(seamLine);

  const heartShape = new THREE.Shape();
  heartShape.moveTo(0, 0.02);
  heartShape.bezierCurveTo(0, 0.045, -0.03, 0.06, -0.03, 0.03);
  heartShape.bezierCurveTo(-0.03, -0.005, 0, -0.025, 0, -0.045);
  heartShape.bezierCurveTo(0, -0.025, 0.03, -0.005, 0.03, 0.03);
  heartShape.bezierCurveTo(0.03, 0.06, 0, 0.045, 0, 0.02);

  const sticker = new THREE.Mesh(new THREE.ShapeGeometry(heartShape), stickerMaterial);
  sticker.position.set(0, 0, 0.012);
  sticker.scale.setScalar(1.1);
  envelope.add(sticker);

  envelope.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });

  return envelope;
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function setupGamePanel() {
  gamePanel = document.createElement('section');
  gamePanel.className = 'game-panel';
  gamePanel.innerHTML = `
    <div class="game-panel-card" role="dialog" aria-label="Treasure panel">
      <button class="game-panel-close" type="button" aria-label="Close panel">x</button>
      <div class="game-panel-body"></div>
    </div>
  `;

  document.body.appendChild(gamePanel);
  gamePanelBody = gamePanel.querySelector('.game-panel-body');

  gamePanel.querySelector('.game-panel-close').addEventListener('click', closeGamePanel);
}

function onPointerMove(event) {
  if (gamePanel?.classList.contains('open') || letterOverlay?.classList.contains('open')) {
    renderer.domElement.style.cursor = 'default';
    return;
  }

  updatePointer(event);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(clickableObjects, false).length > 0;
  renderer.domElement.style.cursor = hit ? 'pointer' : 'default';
}

function onPointerDown(event) {
  if (gamePanel?.classList.contains('open') || letterOverlay?.classList.contains('open')) {
    return;
  }

  updatePointer(event);
  raycaster.setFromCamera(pointer, camera);
  const intersections = raycaster.intersectObjects(clickableObjects, false);
  if (intersections.length > 0) {
    const action = intersections[0].object.userData.action;
    if (action === 'open-letter') {
      openLetter();
    } else if (action === 'open-chest') {
      if (!hasRevealedCode) {
        openReadLetterHintPanel();
      } else {
        openChestKeyPanel();
      }
    }
  }
}

function updatePointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function openCodePanel() {
  gamePanelBody.innerHTML = `
    <h2>Treasure Key Unlocked 🔑</h2>
    <p>Your treasure chest code:</p>
    <div class="code-chip">${TREASURE_CHEST_CODE}</div>
    <p class="panel-note">Open the treasure chest with the key ^_^</p>
  `;
  gamePanel.classList.add('open');
}

function openReadLetterHintPanel() {
  gamePanelBody.innerHTML = `
    <h2>Locked 🔒</h2>
    <p>The chest appears to be locked...</p>
  `;
  gamePanel.classList.add('open');
}

function openChestKeyPanel() {
  gamePanelBody.innerHTML = `
    <h2>Treasure Chest</h2>
    <p>Hi Humay, enter the treasure chest key.</p>
    <form class="panel-form" data-form="key">
      <input class="panel-input" name="key" type="text" autocomplete="off" placeholder="Enter key" />
      <button class="panel-button" type="submit">Unlock chest</button>
    </form>
    <p class="panel-feedback" data-feedback></p>
  `;
  gamePanel.classList.add('open');
  attachKeyFormHandler();
}

function openCourseQuestionPanel() {
  gamePanelBody.innerHTML = `
    <h2>Smaller Box Unlocked 🎁</h2>
    <div class="mini-chest" aria-hidden="true"></div>
    <p>One more question: What is Ryo's favorite math course in 2026 Winter term?</p>
    <form class="panel-form" data-form="course">
      <input class="panel-input" name="course" type="text" autocomplete="off" placeholder="Type your answer" />
      <button class="panel-button" type="submit">Submit</button>
    </form>
    <p class="panel-feedback" data-feedback></p>
  `;
  gamePanel.classList.add('open');
  attachCourseFormHandler();
}

function openDinnerInvitationPanel() {
  gamePanelBody.innerHTML = `
    <p class="invitation-title">Dinner Invitation 🍽️</p>
    <h3>To Humay,</h3>
    <p>
      I'm gonna take you out for dinner on the 14th.
    </p>
    <p class="letter-sign">Ryo</p>
  `;
  gamePanel.classList.add('open');
}

function attachKeyFormHandler() {
  const form = gamePanelBody.querySelector('[data-form="key"]');
  const feedback = gamePanelBody.querySelector('[data-feedback]');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const key = new FormData(form).get('key')?.toString().trim() ?? '';
    if (key === TREASURE_CHEST_CODE) {
      openCourseQuestionPanel();
      return;
    }
    feedback.textContent = 'That key is not correct. Try again.';
  });
}

function attachCourseFormHandler() {
  const form = gamePanelBody.querySelector('[data-form="course"]');
  const feedback = gamePanelBody.querySelector('[data-feedback]');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const answer = new FormData(form).get('course')?.toString().trim() ?? '';
    if (COURSE_ANSWER_PATTERN.test(answer)) {
      openDinnerInvitationPanel();
      return;
    }
    feedback.textContent = 'Close! Hint: It may or may not be CO250.';
  });
}

function closeGamePanel() {
  gamePanel.classList.remove('open');
}

function setupLetterOverlay() {
  letterOverlay = document.createElement('div');
  letterOverlay.className = 'letter-overlay';
  letterOverlay.innerHTML = `
    <div class="letter-paper" role="dialog" aria-label="Letter">
      <button class="letter-close" type="button" aria-label="Close letter">x</button>
      <h2>For You</h2>
      <p>
        Happy Valentine's Day, Humay.<br />
        Thank you for always being there for me ^_^
      </p>
      <p class="letter-sign">Ryo</p>
    </div>
  `;
  document.body.appendChild(letterOverlay);

  letterOverlay.addEventListener('click', (event) => {
    if (event.target === letterOverlay) {
      closeLetter();
    }
  });

  letterOverlay.querySelector('.letter-close').addEventListener('click', closeLetter);
}

function openLetter() {
  closeGamePanel();
  letterOverlay.classList.add('open');
}

function closeLetter() {
  letterOverlay.classList.remove('open');
  if (!hasRevealedCode) {
    hasRevealedCode = true;
    openCodePanel();
  }
}

function animate() {
  const time = performance.now() / 3000;
  spotLight.position.x = Math.cos(time) * 2.5;
  spotLight.position.z = Math.sin(time) * 2.5;
  starField.rotation.y = time * 0.05;
  starField.rotation.x = Math.sin(time * 0.4) * 0.02;
  if (chestBalloonRig) {
    chestBalloonRig.children.forEach((node) => {
      if (node.geometry?.type === 'SphereGeometry') {
        const drift = Math.sin(time * 2 + node.userData.phase) * node.userData.sway;
        node.position.x = node.userData.baseX + drift;
        node.position.y = node.userData.baseY + Math.cos(time * 1.8 + node.userData.phase) * 0.06;
      }
      if (node.geometry?.type === 'ConeGeometry') {
        const drift = Math.sin(time * 2 + node.userData.phase) * 0.06;
        node.position.x = node.userData.baseX + drift;
        node.position.y = node.userData.baseY + Math.cos(time * 1.8 + node.userData.phase) * 0.045;
      }
      if (node.geometry?.type === 'CylinderGeometry') {
        const drift = Math.sin(time * 2 + node.userData.phase) * 0.028;
        node.position.x = node.userData.baseX + drift;
        node.position.y = node.userData.baseY;
        const swing = Math.sin(time * 2 + node.userData.phase) * 0.035;
        node.rotation.z = swing;
      }
    });
  }
  renderer.render(scene, camera);
}
