// Capra Crossing — cute endless hopper. Three.js, procedural assets, CrazyGames-ready.
import * as THREE from 'three';
import {
  PALETTE, SKINS, loadLibrary, makeGoat, makeTree, makeRock, makeCar, makeTruck,
  makeLog, makeTrain, makeCoin, makeEagle, makeSignal, makeLily, mat,
} from './models.js';

// ---------------- Constants ----------------
const TILE = 1;
const COLS = 4;               // playable columns: -COLS..COLS
const LANE_W = 30;            // visual lane width
const AHEAD = 24;             // rows generated ahead of player
const BEHIND = 7;             // rows kept behind camera
const HOP_TIME = 0.14;
const HOP_HEIGHT = 0.55;

// ---------------- CrazyGames SDK guards ----------------
const CG = () => window.CrazyGames?.SDK;
async function sdkInit() { try { await CG()?.init?.(); } catch (_) {} }
function sdkGameplayStart() { try { CG()?.game?.gameplayStart?.(); } catch (_) {} }
function sdkGameplayStop() { try { CG()?.game?.gameplayStop?.(); } catch (_) {} }
function sdkHappy() { try { CG()?.game?.happytime?.(); } catch (_) {} }
sdkInit();

// ---------------- Audio (tiny synth) ----------------
let actx = null;
function audio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {} }
  if (actx?.state === 'suspended') actx.resume();
  return actx;
}
function tone(freq, dur, type = 'square', vol = 0.12, slide = 0) {
  const ctx = audio(); if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  if (slide) o.frequency.linearRampToValueAtTime(freq + slide, ctx.currentTime + dur);
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g).connect(ctx.destination);
  o.start(); o.stop(ctx.currentTime + dur);
}
function noise(dur, vol = 0.2, freq = 800) {
  const ctx = audio(); if (!ctx) return;
  const len = ctx.sampleRate * dur;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(f).connect(g).connect(ctx.destination);
  src.start();
}
const snd = {
  hop: () => tone(420, 0.08, 'square', 0.08, 180),
  coin: () => { tone(880, 0.07, 'sine', 0.12); setTimeout(() => tone(1320, 0.09, 'sine', 0.12), 60); },
  crash: () => { noise(0.25, 0.3, 600); tone(120, 0.25, 'sawtooth', 0.15, -60); },
  splash: () => noise(0.35, 0.25, 400),
  warn: () => tone(660, 0.12, 'square', 0.1),
  eagle: () => tone(900, 0.4, 'sawtooth', 0.12, -500),
  deny: () => tone(180, 0.06, 'square', 0.06),
  record: () => { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.12, 'square', 0.1), i * 90)); },
};

// ---------------- Renderer / Scene ----------------
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 18, 34);

let viewSize = 11;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
function updateFrustum() {
  const a = window.innerWidth / window.innerHeight;
  camera.left = -viewSize * a / 2;
  camera.right = viewSize * a / 2;
  camera.top = viewSize / 2 + 1.5;
  camera.bottom = -viewSize / 2 + 1.5;
  camera.updateProjectionMatrix();
}
updateFrustum();

const CAM_OFF = new THREE.Vector3(-4.2, 9.5, 6.8);

const ambient = new THREE.AmbientLight(0xffffff, 0.65);
scene.add(ambient);
const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x8fbf6f, 0.35);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff4e0, 1.25);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -14; sun.shadow.camera.right = 14;
sun.shadow.camera.top = 14; sun.shadow.camera.bottom = -14;
sun.shadow.camera.far = 60;
scene.add(sun, sun.target);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  updateFrustum();
});

// ---------------- Day cycle (bands of 50 rows: giorno → tramonto → notte → alba) ----------------
const DAY_PHASES = [
  { sky: 0x87ceeb, sun: 0xfff4e0, sunI: 1.25, amb: 0.65, hemiI: 0.35 },  // giorno
  { sky: 0xf09b66, sun: 0xffb36b, sunI: 1.00, amb: 0.52, hemiI: 0.30 },  // tramonto
  { sky: 0x232c55, sun: 0xa8bfff, sunI: 0.50, amb: 0.34, hemiI: 0.20 },  // notte
  { sky: 0xffc9de, sun: 0xffd9a0, sunI: 1.00, amb: 0.55, hemiI: 0.30 },  // alba
];
const dayCur = {
  sky: new THREE.Color(DAY_PHASES[0].sky), sun: new THREE.Color(DAY_PHASES[0].sun),
  sunI: DAY_PHASES[0].sunI, amb: DAY_PHASES[0].amb, hemiI: DAY_PHASES[0].hemiI,
};
const _cA = new THREE.Color(), _cB = new THREE.Color();

function dayTarget(row) {
  const BAND = 50, FADE = 10;
  const i = Math.floor(row / BAND) % 4;
  const j = (i + 1) % 4;
  const local = row % BAND;
  const t = local < BAND - FADE ? 0 : (local - (BAND - FADE)) / FADE;
  const A = DAY_PHASES[i], B = DAY_PHASES[j];
  _cA.setHex(A.sky).lerp(_cB.setHex(B.sky), t);
  return {
    sky: _cA.clone(),
    sun: new THREE.Color(A.sun).lerp(new THREE.Color(B.sun), t),
    sunI: A.sunI + (B.sunI - A.sunI) * t,
    amb: A.amb + (B.amb - A.amb) * t,
    hemiI: A.hemiI + (B.hemiI - A.hemiI) * t,
  };
}

function updateDayCycle(dt) {
  const tgt = dayTarget(Math.max(score, 0));
  const k = Math.min(1, dt * 1.2);
  dayCur.sky.lerp(tgt.sky, k);
  dayCur.sun.lerp(tgt.sun, k);
  dayCur.sunI += (tgt.sunI - dayCur.sunI) * k;
  dayCur.amb += (tgt.amb - dayCur.amb) * k;
  dayCur.hemiI += (tgt.hemiI - dayCur.hemiI) * k;
  scene.background.copy(dayCur.sky);
  scene.fog.color.copy(dayCur.sky);
  sun.color.copy(dayCur.sun);
  sun.intensity = dayCur.sunI;
  ambient.intensity = dayCur.amb;
  hemi.intensity = dayCur.hemiI;
}

// ---------------- World state ----------------
let rows = new Map();          // rowIndex -> row data
let player, eagle = null;
let state = 'loading';         // loading | title | playing | dead
let score = 0, coins = 0, best = +(localStorage.getItem('capra_best') || 0), newRecord = false;
let totalCoins = +(localStorage.getItem('capra_coins') || 0);
let ownedSkins = JSON.parse(localStorage.getItem('capra_owned') || '["bianca"]');
let currentSkin = localStorage.getItem('capra_skin') || 'bianca';
let camRow = 0, minRow = 0, idleTimer = 0, eagleWarned = false;
let deathAnim = null;

// growing dark disc under the goat while the eagle closes in
const eagleShadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.5, 24),
  new THREE.MeshBasicMaterial({ color: 0x1a1a22, transparent: true, opacity: 0.45, depthWrite: false })
);
eagleShadow.rotation.x = -Math.PI / 2;
eagleShadow.visible = false;

function saveCoins() {
  localStorage.setItem('capra_coins', totalCoins);
  localStorage.setItem('capra_owned', JSON.stringify(ownedSkins));
  localStorage.setItem('capra_skin', currentSkin);
}

const ui = {
  score: document.getElementById('score'),
  best: document.getElementById('best'),
  coins: document.getElementById('coins-hud'),
  title: document.getElementById('title-screen'),
  over: document.getElementById('gameover-screen'),
  goReason: document.getElementById('go-reason'),
  goScore: document.getElementById('go-score'),
  goBest: document.getElementById('go-best'),
  restart: document.getElementById('restart-btn'),
  eagleWarn: document.getElementById('eagle-warning'),
  skinRow: document.getElementById('skin-row'),
  titleCoins: document.getElementById('title-coins'),
};
ui.best.textContent = `RECORD ${best}`;
ui.coins.textContent = `🪙 ${totalCoins}`;

// ---------------- Skin shop ----------------
function renderSkinShop() {
  ui.titleCoins.textContent = `🪙 ${totalCoins}`;
  ui.skinRow.innerHTML = '';
  for (const s of SKINS) {
    const owned = ownedSkins.includes(s.id);
    const btn = document.createElement('button');
    btn.className = 'skin-btn' + (currentSkin === s.id ? ' selected' : '') + (owned ? ' owned' : '');
    const sw = `#${s.body.toString(16).padStart(6, '0')}`;
    btn.innerHTML = `<span class="skin-swatch" style="background:${sw}"></span>` +
      `<span class="skin-name">${s.name}</span>` +
      `<span class="skin-cost">${owned ? (currentSkin === s.id ? 'IN USO' : 'SCEGLI') : `🪙 ${s.cost}`}</span>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      audio();
      if (owned) {
        currentSkin = s.id; saveCoins(); renderSkinShop();
      } else if (totalCoins >= s.cost) {
        totalCoins -= s.cost; ownedSkins.push(s.id); currentSkin = s.id;
        saveCoins(); snd.coin(); renderSkinShop();
        ui.coins.textContent = `🪙 ${totalCoins}`;
      } else {
        snd.deny();
        return;
      }
      // live preview on title backdrop
      if (state === 'title' && player) {
        scene.remove(player.mesh);
        player = makePlayer();
      }
    });
    ui.skinRow.appendChild(btn);
  }
}

// ---------------- Lane generation ----------------
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

let genState = { lastTypes: [] };

function laneTypeFor(r) {
  if (r < 3) return 'grass';
  const lt = genState.lastTypes;
  const consec = (t) => { let n = 0; for (let i = lt.length - 1; i >= 0 && lt[i] === t; i--) n++; return n; };
  const diff = Math.min(r / 100, 1);
  let weights = {
    grass: 0.30 - diff * 0.16,
    road: 0.34 + diff * 0.08,
    river: 0.24 + diff * 0.05,
    rail: 0.12 + diff * 0.03,
  };
  if (consec('river') >= 2) { weights.river = 0; }
  if (consec('road') >= 3) { weights.road = 0; }
  if (consec('rail') >= 1) { weights.rail = 0; }
  if (consec('grass') >= 2) { weights.grass *= 0.3; }
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (const [t, w] of Object.entries(weights)) { roll -= w; if (roll <= 0) return t; }
  return 'grass';
}

function lanePlane(color, y = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(LANE_W, 0.24, TILE), mat(color));
  m.position.y = y - 0.12;
  m.receiveShadow = true;
  return m;
}

function buildRow(r) {
  const type = laneTypeFor(r);
  genState.lastTypes.push(type);
  if (genState.lastTypes.length > 6) genState.lastTypes.shift();

  const group = new THREE.Group();
  group.position.z = -r * TILE;
  scene.add(group);
  const row = { type, group, r, trees: new Set(), vehicles: [], logs: [], coin: null };
  const diff = Math.min(r / 100, 1);

  if (type === 'grass') {
    group.add(lanePlane(r % 2 ? PALETTE.grassA : PALETTE.grassB));
    // frame trees outside playfield
    for (let c = -14; c <= 14; c++) {
      if (Math.abs(c) <= COLS) continue;
      if (Math.random() < 0.45) { const t = makeTree(randi(1, 2)); t.position.x = c; group.add(t); }
    }
    // playable obstacles (guarantee >= 4 free cells; none on spawn rows)
    if (r >= 3) {
      const cells = []; for (let c = -COLS; c <= COLS; c++) cells.push(c);
      const nObs = randi(0, 3);
      for (let i = 0; i < nObs && cells.length > 4; i++) {
        const c = pick(cells); cells.splice(cells.indexOf(c), 1);
        const o = Math.random() < 0.8 ? makeTree(randi(1, 2)) : makeRock();
        o.position.x = c; group.add(o);
        row.trees.add(c);
      }
      // coin
      if (Math.random() < 0.22) {
        const c = pick(cells);
        const coin = makeCoin(); coin.position.set(c, 0.5, 0); group.add(coin);
        row.coin = { mesh: coin, col: c };
      }
    }
  } else if (type === 'road') {
    group.add(lanePlane(PALETTE.road));
    // dashed center line
    for (let x = -14; x < 14; x += 2) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 0.08), mat(PALETTE.roadLine));
      dash.position.set(x, 0.01, 0.5); dash.receiveShadow = true;
      group.add(dash);
    }
    const dir = Math.random() < 0.5 ? 1 : -1;
    const speed = rand(1.7, 2.6) + diff * 2.4;
    const n = randi(2, 3);
    const span = LANE_W;
    for (let i = 0; i < n; i++) {
      const isTruck = Math.random() < 0.25;
      const v = isTruck ? makeTruck(dir) : makeCar(dir);
      const x = -span / 2 + (i + rand(0.1, 0.9)) * (span / n);
      v.position.x = x;
      group.add(v);
      row.vehicles.push({ mesh: v, x, halfLen: v.userData.halfLen });
    }
    row.dir = dir; row.speed = speed;
  } else if (type === 'river') {
    group.add(lanePlane(PALETTE.water, -0.08));
    const dir = Math.random() < 0.5 ? 1 : -1;
    const speed = rand(1.0, 1.7) + diff * 1.3;
    const n = speed > 1.6 ? 3 : randi(2, 3);
    const span = LANE_W;
    for (let i = 0; i < n; i++) {
      const tiles = randi(2, 3);
      const l = makeLog(tiles);
      const x = -span / 2 + (i + rand(0.2, 0.8)) * (span / n);
      l.position.x = x; l.position.y = 0.02;
      group.add(l);
      row.logs.push({ mesh: l, x, halfLen: l.userData.halfLen });
    }
    // lilies deco
    for (let i = 0; i < 3; i++) {
      if (Math.random() < 0.5) {
        const lily = makeLily();
        lily.position.set(rand(-13, 13), -0.02, rand(-0.3, 0.3));
        group.add(lily);
      }
    }
    row.dir = dir; row.speed = speed;
  } else if (type === 'rail') {
    group.add(lanePlane(PALETTE.rail));
    for (let x = -14; x < 14; x += 0.9) {
      const sl = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.7), mat(PALETTE.railSleeper));
      sl.position.set(x, 0.01, 0); sl.receiveShadow = true;
      group.add(sl);
    }
    for (const zz of [-0.28, 0.28]) {
      const railBar = new THREE.Mesh(new THREE.BoxGeometry(LANE_W, 0.06, 0.08), mat(0xb0b0bc));
      railBar.position.set(0, 0.05, zz); railBar.receiveShadow = true;
      group.add(railBar);
    }
    const sig = makeSignal();
    sig.position.set(-COLS - 1.2, 0, 0.55);
    group.add(sig);
    const dir = Math.random() < 0.5 ? 1 : -1;
    const train = makeTrain(randi(3, 5));
    train.visible = false;
    if (dir < 0) train.rotation.y = Math.PI;
    group.add(train);
    row.dir = dir;
    row.train = { mesh: train, x: 0, phase: 'idle', t: rand(1.5, 5), signal: sig, speed: 17 + diff * 8, diff };
  }
  rows.set(r, row);
  return row;
}

let backdrop = null;
function buildBackdrop() {
  backdrop = new THREE.Group();
  for (let r = -1; r >= -8; r--) {
    const g = new THREE.Group();
    g.position.z = -r * TILE;
    g.add(lanePlane(r % 2 ? PALETTE.grassA : PALETTE.grassB));
    for (let c = -14; c <= 14; c++) {
      if (Math.abs(c) <= COLS && r >= -2) continue;
      if (Math.random() < 0.4) { const t = makeTree(randi(1, 2)); t.position.x = c; g.add(t); }
    }
    backdrop.add(g);
  }
  scene.add(backdrop);
}

function ensureRows() {
  const target = Math.floor(camRow) + AHEAD;
  for (let r = 0; r <= target; r++) if (!rows.has(r)) buildRow(r);
  // cull behind
  for (const [r, row] of rows) {
    if (r < camRow - BEHIND) {
      scene.remove(row.group);
      row.group.traverse((o) => { if (o.geometry && !o.geometry._shared) o.geometry.dispose(); });
      rows.delete(r);
    }
  }
}

// ---------------- Player ----------------
function makePlayer() {
  const g = makeGoat(currentSkin);
  g.position.set(0, 0, 0);
  scene.add(g);
  return {
    mesh: g, col: 0, row: 0, x: 0,
    hopping: false, hopFrom: null, hopTo: null, hopT: 0,
    onLog: null, logOffset: 0,
    buffer: [], facing: 0, squash: 0, alive: true,
  };
}

function tryHop(dx, dz) {
  if (!player.alive || state !== 'playing') return;
  if (player.hopping) { if (player.buffer.length < 3) player.buffer.push([dx, dz]); return; }
  const fromX = player.onLog ? player.x : player.col;
  let toCol = Math.max(-COLS, Math.min(COLS, Math.round(fromX + dx)));
  let toRow = Math.max(0, player.row + dz);
  if (dz === 0 && toCol === Math.round(fromX) && dx !== 0) { snd.deny(); return; } // wall
  const targetRow = rows.get(toRow);
  if (targetRow?.trees.has(toCol)) {
    snd.deny();
    player.facing = Math.atan2(dx, -dz || 0.0001);
    player.mesh.rotation.y = player.facing;
    return;
  }
  player.hopping = true;
  player.hopT = 0;
  player.hopFrom = { x: fromX, z: -player.row };
  player.hopTo = { x: toCol, z: -toRow, col: toCol, row: toRow };
  player.onLog = null;
  player.facing = Math.atan2(dx, dz > 0 ? -1 : dz < 0 ? 1 : 0);
  if (dx === 0 && dz === 0) player.facing = 0;
  player.mesh.rotation.y = player.facing;
  snd.hop();
  if (dz > 0) idleTimer = 0;
}

function landPlayer() {
  const { col, row: r } = player.hopTo;
  player.col = col; player.row = r; player.x = col;
  player.hopping = false; player.squash = 1;
  if (r > score) {
    score = r;
    ui.score.textContent = score;
    if (score > best && !newRecord) { newRecord = true; snd.record(); }
    if (score > 0 && score % 50 === 0) sdkHappy();
  }
  const row = rows.get(r);
  if (!row) return;
  // coin pickup
  if (row.coin && row.coin.col === col) {
    row.group.remove(row.coin.mesh);
    row.coin = null;
    coins++; totalCoins++; saveCoins();
    ui.coins.textContent = `🪙 ${totalCoins}`;
    snd.coin();
  }
  // river landing
  if (row.type === 'river') {
    const log = row.logs.find((l) => Math.abs(l.x - player.x) <= l.halfLen + 0.35);
    if (log) {
      player.onLog = log;
      player.logOffset = player.x - log.x;
    } else {
      die('splash');
    }
  }
}

// ---------------- Death ----------------
function die(kind) {
  if (!player.alive) return;
  player.alive = false;
  state = 'dead';
  ui.eagleWarn.classList.add('hidden');
  eagleShadow.visible = false;
  sdkGameplayStop();
  if (kind === 'crash') { snd.crash(); deathAnim = { kind, t: 0 }; ui.goReason.textContent = 'SPIACCICATA!'; }
  if (kind === 'splash') { snd.splash(); deathAnim = { kind, t: 0 }; ui.goReason.textContent = 'GLU GLU GLU...'; }
  if (kind === 'train') { snd.crash(); deathAnim = { kind: 'crash', t: 0 }; ui.goReason.textContent = 'TRENO-PIZZA!'; }
  if (kind === 'eagle') { snd.eagle(); deathAnim = { kind, t: 0 }; ui.goReason.textContent = 'RAPITA DALL\'AQUILA!'; }
  if (score > best) {
    best = score;
    localStorage.setItem('capra_best', best);
    ui.goBest.classList.add('new-record');
    ui.goBest.textContent = `NUOVO RECORD ${best}!`;
  } else {
    ui.goBest.classList.remove('new-record');
    ui.goBest.textContent = `RECORD ${best}`;
  }
  ui.best.textContent = `RECORD ${best}`;
  ui.goScore.textContent = score;
  setTimeout(() => ui.over.classList.remove('hidden'), 700);
}

// ---------------- Reset / start ----------------
function resetWorld() {
  for (const [, row] of rows) scene.remove(row.group);
  rows.clear();
  genState = { lastTypes: [] };
  if (player) scene.remove(player.mesh);
  if (eagle) { scene.remove(eagle.g); eagle = null; }
  if (!backdrop) buildBackdrop();
  player = makePlayer();
  score = 0; coins = 0; newRecord = false;
  camRow = 0; minRow = -2; idleTimer = 0; deathAnim = null;
  eagleWarned = false; ui.eagleWarn.classList.add('hidden');
  eagleShadow.visible = false;
  ui.score.textContent = '0';
  ui.coins.textContent = `🪙 ${totalCoins}`;
  ensureRows();
}

function startGame() {
  ui.title.classList.add('hidden');
  ui.over.classList.add('hidden');
  resetWorld();
  state = 'playing';
  sdkGameplayStart();
}

// ---------------- Input ----------------
const KEYMAP = {
  ArrowUp: [0, 1], KeyW: [0, 1], Space: [0, 1],
  ArrowDown: [0, -1], KeyS: [0, -1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
};
window.addEventListener('keydown', (e) => {
  if (KEYMAP[e.code]) e.preventDefault();
  audio();
  if (state === 'title') { startGame(); return; }
  if (state === 'dead') { if (e.code === 'Enter' || e.code === 'Space') startGame(); return; }
  const m = KEYMAP[e.code];
  if (m) tryHop(m[0], m[1]);
});
ui.restart.addEventListener('click', () => { audio(); startGame(); });

let touchStart = null;
window.addEventListener('touchstart', (e) => {
  audio();
  if (e.target.closest?.('#skin-row') || e.target.closest?.('#restart-btn')) return;
  if (state === 'title') { startGame(); return; }
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: performance.now() };
}, { passive: false });
window.addEventListener('touchend', (e) => {
  if (state !== 'playing' || !touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  const adx = Math.abs(dx), ady = Math.abs(dy);
  if (Math.max(adx, ady) < 18) { tryHop(0, 1); }           // tap = forward
  else if (adx > ady) tryHop(dx > 0 ? 1 : -1, 0);
  else tryHop(0, dy < 0 ? 1 : -1);
  touchStart = null;
}, { passive: false });
window.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

// ---------------- Update loop ----------------
const clock = new THREE.Clock();

function updateVehicles(dt) {
  for (const [, row] of rows) {
    if (row.type === 'road') {
      for (const v of row.vehicles) {
        v.x += row.dir * row.speed * dt;
        if (v.x > LANE_W / 2 + 2) v.x = -LANE_W / 2 - 2;
        if (v.x < -LANE_W / 2 - 2) v.x = LANE_W / 2 + 2;
        v.mesh.position.x = v.x;
      }
    } else if (row.type === 'river') {
      for (const l of row.logs) {
        l.x += row.dir * row.speed * dt;
        if (l.x > LANE_W / 2 + 2) l.x = -LANE_W / 2 - 2;
        if (l.x < -LANE_W / 2 - 2) l.x = LANE_W / 2 + 2;
        l.mesh.position.x = l.x;
      }
    } else if (row.type === 'rail' && row.train) {
      const tr = row.train;
      tr.t -= dt;
      if (tr.phase === 'idle' && tr.t <= 0) {
        tr.phase = 'warn'; tr.t = 1.3;
        if (Math.abs(row.r - player.row) < 8) snd.warn();
      } else if (tr.phase === 'warn') {
        const blink = Math.floor(tr.t * 6) % 2 === 0;
        tr.signal.userData.light.material.emissive.setHex(blink ? 0xff2020 : 0x000000);
        if (tr.t <= 0) {
          tr.phase = 'run';
          tr.mesh.visible = true;
          tr.x = row.dir > 0 ? -LANE_W / 2 - tr.mesh.userData.totalLen : LANE_W / 2 + tr.mesh.userData.totalLen;
        }
      } else if (tr.phase === 'run') {
        tr.x += row.dir * tr.speed * dt;
        tr.mesh.position.x = tr.x;
        const off = tr.mesh.userData.totalLen + LANE_W / 2 + 4;
        if ((row.dir > 0 && tr.x > off) || (row.dir < 0 && tr.x < -off)) {
          tr.phase = 'idle'; tr.t = rand(3, 7 - (tr.diff || 0) * 3); tr.mesh.visible = false;
          tr.signal.userData.light.material.emissive.setHex(0x000000);
        }
      }
    }
    // coin spin
    if (row.coin) row.coin.mesh.rotation.y += dt * 3;
  }
}

function checkCollisions() {
  if (!player.alive) return;
  const row = rows.get(player.row);
  if (!row) return;
  const px = player.hopping
    ? player.hopFrom.x + (player.hopTo.x - player.hopFrom.x) * player.hopT
    : player.x;
  const hopHigh = player.hopping && Math.sin(Math.PI * player.hopT) > 0.55;

  if (row.type === 'road' && !hopHigh) {
    for (const v of row.vehicles) {
      if (Math.abs(v.x - px) < v.halfLen + 0.32) { die('crash'); return; }
    }
  }
  if (row.type === 'rail' && row.train?.phase === 'run' && !hopHigh) {
    const tr = row.train;
    const head = tr.x, tail = tr.x - Math.sign(row.dir) * tr.mesh.userData.totalLen;
    const lo = Math.min(head, tail) - 1.1, hi = Math.max(head, tail) + 1.1;
    if (px > lo && px < hi) { die('train'); return; }
  }
}

function updatePlayer(dt) {
  if (player.hopping) {
    player.hopT = Math.min(1, player.hopT + dt / HOP_TIME);
    const t = player.hopT;
    const x = player.hopFrom.x + (player.hopTo.x - player.hopFrom.x) * t;
    const z = player.hopFrom.z + (player.hopTo.z - player.hopFrom.z) * t;
    player.mesh.position.set(x, Math.sin(Math.PI * t) * HOP_HEIGHT, z);
    if (t >= 1) {
      landPlayer();
      if (player.buffer.length) { const [bx, bz] = player.buffer.shift(); tryHop(bx, bz); }
    }
  } else if (player.alive) {
    if (player.onLog) {
      player.x = player.onLog.x + player.logOffset;
      player.mesh.position.x = player.x;
      player.mesh.position.y = 0.15;
      if (Math.abs(player.x) > COLS + 1.4) { die('splash'); return; }
    } else {
      player.mesh.position.y = 0;
    }
    // squash landing anim
    if (player.squash > 0) {
      player.squash = Math.max(0, player.squash - dt * 8);
      const s = 1 - 0.22 * Math.sin(player.squash * Math.PI);
      player.mesh.scale.set(1 / s * 0.5 + 0.5, s, 1 / s * 0.5 + 0.5);
    } else {
      player.mesh.scale.set(1, 1, 1);
    }
  }
}

function updateDeath(dt) {
  if (!deathAnim) return;
  deathAnim.t += dt;
  const t = deathAnim.t;
  if (deathAnim.kind === 'crash') {
    player.mesh.scale.y = Math.max(0.12, 1 - t * 6);
    player.mesh.scale.x = 1 + Math.min(0.8, t * 3);
    player.mesh.scale.z = 1 + Math.min(0.8, t * 3);
  } else if (deathAnim.kind === 'splash') {
    player.mesh.position.y = -t * 1.6;
    player.mesh.rotation.z = t * 2;
  } else if (deathAnim.kind === 'eagle' && eagle) {
    player.mesh.position.y = eagle.g.position.y - 0.5;
    player.mesh.position.x = eagle.g.position.x;
  }
}

function updateEagle(dt) {
  if (state !== 'playing' || !player.alive) {
    if (eagle && deathAnim?.kind === 'eagle') {
      eagle.g.position.y += dt * 4;
      eagle.g.position.z -= dt * 6;
      eagle.t += dt;
      eagle.g.userData.wings.forEach((w, i) => { w.rotation.z = Math.sin(eagle.t * 14) * 0.5 * (i ? -1 : 1); });
    }
    return;
  }
  idleTimer += dt;
  const warnSlow = idleTimer > 6.5;
  const warnBehind = player.row < minRow - 2.5;
  const tooSlow = idleTimer > 9;
  const behind = player.row < minRow - 3.5;
  // pre-warning: banner + screech + growing shadow, escape still possible
  if ((warnSlow || warnBehind) && !eagle) {
    if (!eagleWarned) { eagleWarned = true; snd.eagle(); scene.add(eagleShadow); }
    ui.eagleWarn.classList.remove('hidden');
    const g = Math.min(1, (idleTimer - 6.5) / 2.5);
    const grow = Math.max(g, warnBehind ? 0.6 : 0);
    eagleShadow.visible = true;
    eagleShadow.scale.setScalar(0.4 + grow * 1.2);
    eagleShadow.position.set(player.mesh.position.x, 0.06, player.mesh.position.z);
  } else if (!eagle) {
    eagleWarned = false;
    eagleShadow.visible = false;
    ui.eagleWarn.classList.add('hidden');
  } else {
    eagleShadow.visible = false;
  }
  if ((tooSlow || behind) && !eagle) {
    const g = makeEagle();
    g.position.set(player.x, 8, -player.row - 6);
    scene.add(g);
    eagle = { g, t: 0, phase: 'dive' };
    snd.eagle();
  }
  if (eagle) {
    eagle.t += dt;
    eagle.g.userData.wings.forEach((w, i) => { w.rotation.z = Math.sin(eagle.t * 14) * 0.5 * (i ? -1 : 1); });
    const target = new THREE.Vector3(player.mesh.position.x, 0.6, player.mesh.position.z);
    eagle.g.position.lerp(target, Math.min(1, dt * 3.2));
    eagle.g.lookAt(target.x, eagle.g.position.y, target.z - 1);
    if (eagle.g.position.distanceTo(target) < 0.7) die('eagle');
  }
}

function updateCamera(dt) {
  if (state === 'playing') {
    const creep = 0.28 + Math.min(score / 300, 0.5);
    minRow += creep * dt;
    if (player.row > minRow + 2) minRow = player.row - 2;
  }
  const targetRow = Math.max(player?.row ?? 0, minRow);
  camRow += (targetRow - camRow) * Math.min(1, dt * 3.5);
  const px = state === 'playing' || state === 'dead' ? player.mesh.position.x * 0.4 : 0;
  const focus = new THREE.Vector3(px, 0, -camRow);
  camera.position.copy(focus).add(CAM_OFF);
  camera.lookAt(focus);
  sun.position.copy(focus).add(new THREE.Vector3(-6, 12, 5));
  sun.target.position.copy(focus);
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (state === 'playing' || state === 'dead') {
    updateVehicles(dt);
    updatePlayer(dt);
    checkCollisions();
    updateEagle(dt);
    updateDeath(dt);
    ensureRows();
  }
  updateDayCycle(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

// Boot: preload GLB library, then title with backdrop
loadLibrary().then(() => {
  resetWorld();
  renderSkinShop();
  state = 'title';
  document.getElementById('loading-text')?.classList.add('hidden');
});
tick();
