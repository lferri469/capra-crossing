// Capra Crossing — cute endless hopper. Three.js, procedural assets, CrazyGames-ready.
import * as THREE from 'three';
import {
  PALETTE, SKINS, loadLibrary, makeGoat, makeTree, makeRock, makeCar, makeTruck,
  makeLog, makeTrain, makeCoin, makeEagle, makeSignal, makeLily, makeCloud, makePowerup, mat,
} from './models.js';
import { grassTexture, roadTexture, railTexture, waterTexture } from './textures.js';
import { Particles, FloatingText, PostFX, Shake } from './fx.js';

// ---------------- Constants ----------------
const TILE = 1;
const COLS = 8;               // playable columns: -COLS..COLS (near-full screen width)
const LANE_W = 42;            // visual lane width
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
function sdkMidroll(cb) {
  const sdk = CG();
  if (sdk?.ad?.requestAd) {
    try { sdk.ad.requestAd('midgame', { adFinished: cb, adError: cb }); return; } catch (_) {}
  }
  cb();
}
function sdkRewarded(onDone, onFail) {
  const sdk = CG();
  if (sdk?.ad?.requestAd) {
    try { sdk.ad.requestAd('rewarded', { adFinished: onDone, adError: onFail }); return; } catch (_) {}
  }
  setTimeout(onDone, 400);   // local/dev fallback: grant the reward
}
sdkInit();
const onCrazyGames = /(^|\.)crazygames\.com$/.test(location.hostname);

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
function noise(dur, vol = 0.2, freq = 800, type = 'lowpass') {
  const ctx = audio(); if (!ctx) return;
  const len = ctx.sampleRate * dur;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
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
  whoosh: () => noise(0.18, 0.22, 1600, 'bandpass'),
  milestone: () => { [659, 880].forEach((f, i) => setTimeout(() => tone(f, 0.1, 'triangle', 0.12), i * 70)); },
  power: () => { [440, 660, 880].forEach((f, i) => setTimeout(() => tone(f, 0.09, 'triangle', 0.12), i * 60)); },
};

// ---------------- Procedural background music (no files) ----------------
let musicOn = localStorage.getItem('capra_music') !== '0';
let musicTimer = null, musicStep = 0;
const MUSIC_SCALE = [0, 3, 5, 7, 10, 12, 15];       // minor pentatonic
function musicTick() {
  if (!musicOn || !actx || state === 'title') return;
  const s = musicStep++;
  // soft bass every 4 steps
  if (s % 4 === 0) tone(110 * Math.pow(2, MUSIC_SCALE[(s / 4) % 4 === 0 ? 0 : 2] / 12), 0.5, 'sine', 0.045);
  // sparse melody
  if (Math.random() < 0.55) {
    const n = MUSIC_SCALE[Math.floor(Math.random() * MUSIC_SCALE.length)];
    tone(330 * Math.pow(2, n / 12), 0.22, 'triangle', 0.028);
  }
}
function startMusic() {
  if (musicTimer || !audio()) return;
  musicTimer = setInterval(musicTick, 300);
}

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
sun.shadow.camera.left = -18; sun.shadow.camera.right = 18;
sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -16;
sun.shadow.camera.far = 60;
sun.shadow.bias = -0.0004;        // no shadow-acne flicker
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

// ---------------- FX systems ----------------
const postfx = new PostFX(renderer);
const shake = new Shake();
const particles = new Particles(scene);
const floats = new FloatingText(document.getElementById('float-layer'), camera);
let timeScale = 1;

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  updateFrustum();
  postfx.setSize(window.innerWidth, window.innerHeight);
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
let mode = 'endless';          // endless | daily
let runStarted = false;        // first forward hop fired gameplayStart
let reviveUsed = false;        // one rewarded revive per run
let dailyBest = 0;
const curBest = () => (mode === 'daily' ? dailyBest : best);
let deathAnim = null;
let nearMisses = 0;
let runTime = 0;

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
  goStats: document.getElementById('go-stats'),
  restart: document.getElementById('restart-btn'),
  reviveBtn: document.getElementById('revive-btn'),
  share: document.getElementById('share-btn'),
  eagleWarn: document.getElementById('eagle-warning'),
  skinRow: document.getElementById('skin-row'),
  titleCoins: document.getElementById('title-coins'),
  toast: document.getElementById('toast'),
  powerHud: document.getElementById('power-hud'),
  modeEndless: document.getElementById('mode-endless'),
  modeDaily: document.getElementById('mode-daily'),
  mute: document.getElementById('mute-btn'),
};
ui.best.textContent = `BEST ${best}`;
ui.coins.textContent = `🪙 ${totalCoins}`;
if (onCrazyGames && !ownedSkins.includes('crazy')) { ownedSkins.push('crazy'); saveCoins(); }

let toastTimer = null;
function toast(msg) {
  ui.toast.textContent = msg;
  ui.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.add('hidden'), 1800);
}

// ---------------- Skin shop ----------------
function renderSkinShop() {
  ui.titleCoins.textContent = `🪙 ${totalCoins}`;
  ui.skinRow.innerHTML = '';
  for (const s of SKINS) {
    const owned = ownedSkins.includes(s.id);
    const locked = !!s.cgOnly && !onCrazyGames && !owned;
    const btn = document.createElement('button');
    btn.className = 'skin-btn' + (currentSkin === s.id ? ' selected' : '') + (owned ? ' owned' : '') + (locked ? ' locked' : '');
    const sw = `#${s.body.toString(16).padStart(6, '0')}`;
    btn.innerHTML = `<span class="skin-swatch" style="background:${sw}"></span>` +
      `<span class="skin-name">${s.name}</span>` +
      (s.perk ? `<span class="skin-perk">${s.perk}</span>` : '') +
      `<span class="skin-cost">${locked ? '🔒 CrazyGames only' : owned ? (currentSkin === s.id ? 'EQUIPPED' : 'SELECT') : `🪙 ${s.cost}`}</span>`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      audio();
      if (locked) { toast('Play on CrazyGames.com to unlock Crazy Goat!'); return; }
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

// world-gen RNG: Math.random in endless, seeded in daily (identical world for everyone)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let genRand = Math.random;
const grand = (a, b) => a + genRand() * (b - a);
const grandi = (a, b) => Math.floor(grand(a, b + 1));
const gpick = (arr) => arr[Math.floor(genRand() * arr.length)];

function dailySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
const dailyKey = () => `capra_daily_${dailySeed()}`;
const dailyLabel = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// ---------------- Biomes (bands of 100 rows, linear 20-row blend) ----------------
const BIOMES = [
  { name: 'campagna', grassA: 0xa8d878, grassB: 0x9ccc68, trees: ['tree_default', 'tree_oak', 'tree_fat', 'tree_detailed'] },
  { name: 'autunno', grassA: 0xcdb45e, grassB: 0xc1a852, trees: ['tree_default_fall', 'tree_oak_fall', 'tree_detailed_fall', 'tree_fat_fall'] },
  { name: 'costa', grassA: 0xe6d8a2, grassB: 0xdccd94, trees: ['tree_palm', 'tree_palmShort', 'tree_palmTall', 'tree_palmBend', 'cactus_short', 'cactus_tall'] },
  { name: 'inverno', grassA: 0xdde8ea, grassB: 0xd0dde0, trees: ['tree_pineDefaultA', 'tree_pineDefaultB', 'tree_pineRoundA', 'tree_pineRoundB'] },
  { name: 'bosco scuro', grassA: 0x87996a, grassB: 0x7b8d5f, trees: ['tree_default_dark', 'tree_oak_dark', 'tree_detailed_dark', 'tree_blocks_dark'] },
];
const _gA = new THREE.Color(), _gB = new THREE.Color();

function biomeAt(r) {
  const BAND = 100, FADE = 20;
  const i = Math.floor(r / BAND) % BIOMES.length;
  const j = (i + 1) % BIOMES.length;
  const local = r % BAND;
  const t = local < BAND - FADE ? 0 : (local - (BAND - FADE)) / FADE;
  const A = BIOMES[i], B = BIOMES[j];
  return {
    grassA: _gA.setHex(A.grassA).lerp(_gB.setHex(B.grassA), t).getHex() & 0xF0F0F0,
    grassB: _gA.setHex(A.grassB).lerp(_gB.setHex(B.grassB), t).getHex() & 0xF0F0F0,
    trees: genRand() < t ? B.trees : A.trees,   // gradual model mix inside the fade
  };
}

let genState = { lastTypes: [], lastPowerRow: 0 };

// difficulty curves: main ramp to row 150, endless slow ramp after
const diffAt = (r) => Math.min(r / 150, 1);
const lateAt = (r) => Math.min(Math.max(r - 150, 0) / 500, 1);

function laneTypeFor(r) {
  if (r < 3) return 'grass';
  const lt = genState.lastTypes;
  const consec = (t) => { let n = 0; for (let i = lt.length - 1; i >= 0 && lt[i] === t; i--) n++; return n; };
  const diff = diffAt(r), late = lateAt(r);
  let weights = {
    grass: 0.30 - diff * 0.16 - late * 0.06,
    road: 0.34 + diff * 0.08 + late * 0.04,
    river: 0.24 + diff * 0.05 + late * 0.03,
    rail: 0.12 + diff * 0.03 + late * 0.02,
  };
  if (consec('river') >= 2 + (late > 0.4 ? 1 : 0)) { weights.river = 0; }
  if (consec('road') >= 3 + (late > 0.3 ? 1 : 0)) { weights.road = 0; }
  if (consec('rail') >= 1 + (late > 0.6 ? 1 : 0)) { weights.rail = 0; }
  if (consec('grass') >= 2) { weights.grass *= 0.3; }
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = genRand() * total;
  for (const [t, w] of Object.entries(weights)) { roll -= w; if (roll <= 0) return t; }
  return 'grass';
}

// ---------------- Object pooling (QA: no churn on low-end devices) ----------------
const objPool = new Map();
function poolGet(key) {
  const a = objPool.get(key);
  return a && a.length ? a.pop() : null;
}
function poolPut(key, obj) {
  if (!obj || !key) return;
  obj.removeFromParent();
  let a = objPool.get(key);
  if (!a) objPool.set(key, a = []);
  if (a.length < 40) a.push(obj);
}
function recycleRow(row) {
  for (const v of row.vehicles) poolPut(v.mesh.userData._pk, v.mesh);
  for (const l of row.logs) poolPut(l.mesh.userData._pk, l.mesh);
  for (const c of row.coins || []) poolPut('coin', c.mesh);
  if (row.power) poolPut('pu_' + row.power.kind, row.power.mesh);
  for (const p of row.props || []) poolPut(p.userData._pk, p);
  if (row.lane) poolPut(row.lane.userData._pk, row.lane);
  if (row.deco) poolPut(row.deco.userData._pk, row.deco);
  if (row.train) {
    row.train.mesh.visible = true;
    poolPut(row.train.mesh.userData._pk, row.train.mesh);
    poolPut('signal', row.train.signal);
  }
  scene.remove(row.group);
}

const GEO = {
  lane: new THREE.BoxGeometry(LANE_W, 0.24, TILE),
  dash: new THREE.BoxGeometry(0.8, 0.02, 0.08),
  sleeper: new THREE.BoxGeometry(0.55, 0.04, 0.7),
  railBar: new THREE.BoxGeometry(LANE_W, 0.06, 0.08),
};

function makeRoadDeco() {
  const g = new THREE.Group();
  for (let x = -21; x < 21; x += 2) {
    const dash = new THREE.Mesh(GEO.dash, mat(PALETTE.roadLine));
    dash.position.set(x, 0.01, 0.5);
    dash.receiveShadow = true;
    g.add(dash);
  }
  g.userData._pk = 'roaddeco';
  return g;
}
function makeRailDeco() {
  const g = new THREE.Group();
  for (let x = -21; x < 21; x += 0.9) {
    const sl = new THREE.Mesh(GEO.sleeper, mat(PALETTE.railSleeper));
    sl.position.set(x, 0.01, 0);
    sl.receiveShadow = true;
    g.add(sl);
  }
  for (const zz of [-0.28, 0.28]) {
    const bar = new THREE.Mesh(GEO.railBar, mat(0xb0b0bc));
    bar.position.set(0, 0.05, zz);
    bar.receiveShadow = true;
    g.add(bar);
  }
  g.userData._pk = 'raildeco';
  return g;
}

function spawnTree(size, names) {
  if (names) {
    for (const n of names) { const t = poolGet('tree_' + n); if (t) return t; }
  } else {
    const t = poolGet('tree_any');
    if (t) return t;
  }
  const t = makeTree(size, names || null);
  t.userData._pk = t.userData.model ? 'tree_' + t.userData.model : 'tree_any';
  return t;
}

// textured lane materials, cached per type+color
const laneMats = new Map();
function laneMat(type, color) {
  const key = `${type}_${color}`;
  if (!laneMats.has(key)) {
    let tex;
    if (type === 'grass') tex = grassTexture(color);
    else if (type === 'road') tex = roadTexture(color);
    else if (type === 'rail') tex = railTexture(color);
    else tex = waterTexture(color);
    laneMats.set(key, new THREE.MeshLambertMaterial({ color: 0xffffff, map: tex }));
  }
  return laneMats.get(key);
}

function lanePlane(type, color, y = 0) {
  let m;
  if (type === 'water') {
    m = poolGet('lane_water');
    if (!m) {
      m = new THREE.Mesh(GEO.lane, new THREE.MeshLambertMaterial({ color: 0xffffff, map: waterTexture(color).clone() }));
      m.userData._pk = 'lane_water';
    }
  } else {
    m = poolGet('lane_solid');
    if (m) m.material = laneMat(type, color);
    else {
      m = new THREE.Mesh(GEO.lane, laneMat(type, color));
      m.userData._pk = 'lane_solid';
    }
  }
  m.position.set(0, y - 0.12, 0);
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
  const row = { type, group, r, trees: new Set(), vehicles: [], logs: [], coins: [], power: null, props: [], lane: null, deco: null };
  const diff = diffAt(r), late = lateAt(r);

  if (type === 'grass') {
    const biome = biomeAt(r);
    row.lane = lanePlane('grass', r % 2 ? biome.grassA : biome.grassB);
    group.add(row.lane);
    // frame trees outside playfield
    for (let c = -20; c <= 20; c++) {
      if (Math.abs(c) <= COLS) continue;
      if (genRand() < 0.45) { const t = spawnTree(grandi(1, 2), biome.trees); t.position.x = c; group.add(t); row.props.push(t); }
    }
    // playable obstacles (guarantee >= 6 free cells; none on spawn rows)
    if (r >= 3) {
      const cells = []; for (let c = -COLS; c <= COLS; c++) cells.push(c);
      const nObs = grandi(1, 3 + Math.round(late * 3));
      for (let i = 0; i < nObs && cells.length > 6; i++) {
        const c = gpick(cells); cells.splice(cells.indexOf(c), 1);
        let o;
        if (genRand() < 0.8) o = spawnTree(grandi(1, 2), biome.trees);
        else { o = poolGet('rock') || makeRock(); o.userData._pk = 'rock'; }
        o.position.x = c; group.add(o);
        row.props.push(o);
        row.trees.add(c);
      }
      // coins: 40% of grass rows carry a run of 1-3 coins
      if (genRand() < 0.40) {
        const start = gpick(cells);
        const nC = grandi(1, 3);
        const step = start + nC - 1 <= COLS ? 1 : -1;
        for (let i = 0; i < nC; i++) {
          const c = start + i * step;
          if (!cells.includes(c)) continue;
          cells.splice(cells.indexOf(c), 1);
          const coin = poolGet('coin') || makeCoin();
          coin.userData._pk = 'coin';
          coin.position.set(c, 0.5, 0); group.add(coin);
          row.coins.push({ mesh: coin, col: c });
        }
      }
      // power-up: one roughly every 40 rows of progress
      const sinceP = r - genState.lastPowerRow;
      if (r > 6 && cells.length > 4 && (sinceP >= 46 || (sinceP >= 34 && genRand() < 0.25))) {
        const c = gpick(cells); cells.splice(cells.indexOf(c), 1);
        const kind = gpick(['shield', 'magnet', 'superjump']);
        const pu = poolGet('pu_' + kind) || makePowerup(kind);
        pu.userData._pk = 'pu_' + kind;
        pu.position.set(c, 0.45, 0); group.add(pu);
        row.power = { mesh: pu, col: c, kind };
        genState.lastPowerRow = r;
      }
    }
  } else if (type === 'road') {
    row.lane = lanePlane('road', PALETTE.road);
    row.deco = poolGet('roaddeco') || makeRoadDeco();
    group.add(row.lane, row.deco);
    const dir = genRand() < 0.5 ? 1 : -1;
    const speed = grand(1.7, 2.6) + diff * 2.4 + late * 1.6;
    const n = grandi(2, 3) + (late > 0.5 ? 1 : 0);
    const span = LANE_W;
    for (let i = 0; i < n; i++) {
      const isTruck = genRand() < 0.25;
      const pk = (isTruck ? 'truck' : 'car') + dir;
      let v = poolGet(pk);
      if (!v) { v = isTruck ? makeTruck(dir) : makeCar(dir); v.userData._pk = pk; }
      const x = -span / 2 + (i + grand(0.1, 0.9)) * (span / n);
      v.position.x = x;
      group.add(v);
      row.vehicles.push({ mesh: v, x, halfLen: v.userData.halfLen, hit: v.userData.hitLen || v.userData.halfLen * 0.82, nm: false, phase: grand(0, 6.28) });
    }
    row.dir = dir; row.speed = speed;
  } else if (type === 'river') {
    const water = lanePlane('water', PALETTE.water, -0.08);
    row.lane = water;
    group.add(water);
    const dir = genRand() < 0.5 ? 1 : -1;
    const speed = grand(1.25, 1.8) + diff * 1.3 + late * 1.0;
    const n = grandi(4, 5) + (speed < 1.5 ? 1 : 0);
    const span = LANE_W;
    for (let i = 0; i < n; i++) {
      const tiles = late > 0.35 && genRand() < 0.4 + late * 0.3 ? 2 : grandi(2, 3);
      let l = poolGet('log_' + tiles);
      if (!l) { l = makeLog(tiles); l.userData._pk = 'log_' + tiles; }
      const x = -span / 2 + (i + grand(0.2, 0.8)) * (span / n);
      l.position.x = x; l.position.y = 0.02;
      group.add(l);
      row.logs.push({ mesh: l, x, halfLen: l.userData.halfLen, topY: l.userData.topY, bobPhase: grand(0, 6.28) });
    }
    // lilies deco
    for (let i = 0; i < 3; i++) {
      if (genRand() < 0.5) {
        const lily = poolGet('lily') || makeLily();
        lily.userData._pk = 'lily';
        lily.position.set(grand(-19, 19), -0.02, grand(-0.3, 0.3));
        group.add(lily);
        row.props.push(lily);
      }
    }
    row.dir = dir; row.speed = speed; row.water = water;
  } else if (type === 'rail') {
    row.lane = lanePlane('rail', PALETTE.rail);
    row.deco = poolGet('raildeco') || makeRailDeco();
    group.add(row.lane, row.deco);
    const sig = poolGet('signal') || makeSignal();
    sig.userData._pk = 'signal';
    sig.userData.light.material.emissive.setHex(0x000000);
    sig.position.set(-COLS - 1.2, 0, 0.55);
    group.add(sig);
    const dir = genRand() < 0.5 ? 1 : -1;
    const carsN = grandi(3, 5);
    const tpk = `train_${carsN}_${dir}`;
    let train = poolGet(tpk);
    if (!train) {
      train = makeTrain(carsN);
      if (dir < 0) train.rotation.y = Math.PI;
      train.userData._pk = tpk;
    }
    train.visible = false;
    train.position.x = 0;
    group.add(train);
    row.dir = dir;
    row.train = {
      mesh: train, x: 0, phase: 'idle', t: grand(1.5, 5), signal: sig,
      speed: 17 + diff * 8 + late * 5, diff, late, nm: false,
    };
  }
  rows.set(r, row);
  return row;
}

let backdrop = null;
function buildBackdrop() {
  backdrop = new THREE.Group();
  for (let r = -1; r >= -12; r--) {
    const g = new THREE.Group();
    g.position.z = -r * TILE;
    g.add(lanePlane('grass', r % 2 ? PALETTE.grassA : PALETTE.grassB));
    for (let c = -20; c <= 20; c++) {
      if (Math.abs(c) <= COLS && r >= -2) continue;
      if (Math.random() < 0.4) { const t = makeTree(randi(1, 2)); t.position.x = c; g.add(t); }
    }
    backdrop.add(g);
  }
  scene.add(backdrop);
}

// ---------------- Cloud shadows (soft dark patches drifting over the ground) ----------------
const clouds = [];
function buildClouds() {
  for (let i = 0; i < 6; i++) {
    const r = rand(2.2, 4.5);
    const c = new THREE.Mesh(
      new THREE.CircleGeometry(r, 26),
      new THREE.MeshBasicMaterial({ color: 0x223344, transparent: true, opacity: rand(0.05, 0.1), depthWrite: false })
    );
    c.rotation.x = -Math.PI / 2;
    c.scale.x = rand(1.3, 2.0);            // elongated puff shape
    c.position.set(rand(-16, 16), 0.035, rand(-20, 4));
    c.userData.speed = rand(0.25, 0.6);
    c.castShadow = false;
    scene.add(c);
    clouds.push(c);
  }
}
function updateClouds(dt) {
  for (const c of clouds) {
    c.position.x += c.userData.speed * dt;
    if (c.position.x > 22) c.position.x = -22;
    // keep the shadows inside the camera window
    const zRel = c.position.z + camRow;
    if (zRel > 8) c.position.z -= 32;
    if (zRel < -26) c.position.z += 32;
  }
}

// ---------------- Record flag (one-more-run magnet) ----------------
let recordFlag = null;
function makeRecordFlag() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.6, 8), mat(0xdddde4));
  pole.position.y = 0.8;
  pole.castShadow = true;
  g.add(pole);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 84;
  const x = c.getContext('2d');
  x.fillStyle = '#d95763';
  x.fillRect(0, 0, 256, 84);
  x.fillStyle = '#fff';
  x.font = 'bold 46px sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('BEST', 128, 46);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.5),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
  );
  banner.position.set(0.78, 1.3, 0);
  g.add(banner);
  return g;
}
function placeRecordFlag() {
  if (!recordFlag) { recordFlag = makeRecordFlag(); scene.add(recordFlag); }
  if (curBest() >= 5) {
    recordFlag.visible = true;
    recordFlag.position.set(-COLS - 0.9, 0, -curBest() * TILE);
  } else {
    recordFlag.visible = false;
  }
}

function ensureRows() {
  const target = Math.floor(camRow) + AHEAD;
  for (let r = 0; r <= target; r++) if (!rows.has(r)) buildRow(r);
  // cull behind
  for (const [r, row] of rows) {
    if (r < camRow - BEHIND) {
      recycleRow(row);
      rows.delete(r);
    }
  }
}

// ---------------- Player ----------------
function makePlayer() {
  const goat = makeGoat(currentSkin);
  goat.scale.setScalar(0.78);              // goat smaller than cars, real-world proportions
  const g = new THREE.Group();             // wrapper: squash anim scales this, not the base
  g.add(goat);
  g.position.set(0, 0, 0);
  scene.add(g);
  return {
    mesh: g, goat, col: 0, row: 0, x: 0,
    hopping: false, hopFrom: null, hopTo: null, hopT: 0, hopBig: false,
    onLog: null, logOffset: 0,
    buffer: [], facing: 0, squash: 0, alive: true,
    animT: 0, blinkT: rand(1, 4),
    shield: currentSkin === 'montone', magnetT: 0, superjump: false, invulnT: 0, ramT: 0,
  };
}

// invisible wall: never let the goat hop back past the camera's visibility edge
const backWallRow = () => Math.floor(camRow) - (BEHIND - 2);

function tryHop(dx, dz) {
  if (!player.alive || state !== 'playing') return;
  if (player.hopping) {
    // amphibious jump: one mid-air retarget, ignores the ground-contact rule
    if (player.superjump && (dx || dz)) {
      const t = player.hopT;
      const fx = player.hopFrom.x + (player.hopTo.x - player.hopFrom.x) * t;
      const fz = player.hopFrom.z + (player.hopTo.z - player.hopFrom.z) * t;
      const nCol = Math.max(-COLS, Math.min(COLS, player.hopTo.col + dx));
      const nRow = Math.max(0, player.hopTo.row + (dz > 0 ? 1 : dz < 0 ? -1 : 0));
      if (dz < 0 && nRow < backWallRow()) { snd.deny(); return; }
      if (rows.get(nRow)?.trees.has(nCol)) { snd.deny(); return; }
      player.superjump = false;
      player.hopBig = true;
      player.hopT = 0;
      player.hopFrom = { x: fx, z: fz, y: player.mesh.position.y };
      player.hopTo = { x: nCol, z: -nRow, col: nCol, row: nRow };
      player.facing = Math.atan2(dx, dz > 0 ? -1 : dz < 0 ? 1 : 0);
      if (dx === 0 && dz === 0) player.facing = 0;
      player.mesh.rotation.y = player.facing;
      snd.power();
      updatePowerHud();
      celebrate('DOUBLE JUMP!', 'thrill');
      if (dz > 0) idleTimer = 0;
      return;
    }
    if (player.buffer.length < 3) player.buffer.push([dx, dz]);
    return;
  }
  const fromX = player.onLog ? player.x : player.col;
  let toCol = Math.max(-COLS, Math.min(COLS, Math.round(fromX + dx)));
  let toRow = Math.max(0, player.row + dz);
  if (dz === 0 && toCol === Math.round(fromX) && dx !== 0) { snd.deny(); return; } // wall
  if (dz < 0 && toRow < backWallRow()) { snd.deny(); return; }                     // camera wall
  player.hopBig = false;
  const targetRow = rows.get(toRow);
  if (targetRow?.trees.has(toCol)) {
    snd.deny();
    player.facing = Math.atan2(dx, -dz || 0.0001);
    player.mesh.rotation.y = player.facing;
    // bump feedback: leaf burst on the tree
    particles.leaves(new THREE.Vector3(toCol, 0.7, -toRow));
    return;
  }
  if (!runStarted && dz > 0) { runStarted = true; sdkGameplayStart(); }
  player.hopping = true;
  player.hopT = 0;
  player.hopFrom = { x: fromX, z: -player.row, y: player.mesh.position.y };
  player.hopTo = { x: toCol, z: -toRow, col: toCol, row: toRow };
  player.onLog = null;
  player.facing = Math.atan2(dx, dz > 0 ? -1 : dz < 0 ? 1 : 0);
  if (dx === 0 && dz === 0) player.facing = 0;
  player.mesh.rotation.y = player.facing;
  snd.hop();
  if (dz > 0) idleTimer = 0;
}

let coinCarry = 0;   // Alpaca 1.2x fractional accumulator
function coinGain() {
  if (currentSkin !== 'alpaca') return 1;
  coinCarry += 1.2;
  const g = Math.floor(coinCarry);
  coinCarry -= g;
  return g;
}

function collectCoin(row, entry) {
  const { mesh } = entry;
  const r = row.r;
  const wp = new THREE.Vector3(mesh.position.x, 0.5, -r + mesh.position.z);
  row.group.remove(mesh);
  poolPut('coin', mesh);
  particles.coin(wp);
  const gain = coinGain();
  floats.show(wp.clone().setY(0.9), `+${gain}`, 'gold');
  row.coins.splice(row.coins.indexOf(entry), 1);
  coins += gain; totalCoins += gain; saveCoins();
  ui.coins.textContent = `🪙 ${totalCoins}`;
  snd.coin();
}

function updatePowerHud() {
  const parts = [];
  if (player?.shield) parts.push('🛡️');
  if (player?.superjump) parts.push('🚀');
  if (player?.magnetT > 0) parts.push(`🧲${Math.ceil(player.magnetT)}`);
  ui.powerHud.textContent = parts.join(' ');
}

function celebrate(msg, cls = 'gold') {
  floats.show(player.mesh.position.clone().add(new THREE.Vector3(0, 1.1, 0)), msg, cls);
}

function landPlayer() {
  const { col, row: r } = player.hopTo;
  player.col = col; player.row = r; player.x = col;
  player.hopping = false; player.squash = 1;
  const row = rows.get(r);
  // landing dust (ground rows only)
  if (row && row.type !== 'river') {
    particles.dust(new THREE.Vector3(player.hopTo.x, 0.05, -r));
  }
  if (r > score) {
    score = r;
    ui.score.textContent = score;
    if (score > curBest() && !newRecord && curBest() >= 5) {
      newRecord = true;
      snd.record();
      celebrate('NEW BEST!', 'record');
      particles.confetti(player.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)));
      postfx.flash = 0.25;
    }
    if (score > 0 && score % 25 === 0) {
      snd.milestone();
      celebrate(`${score}!`, 'milestone');
      particles.confetti(player.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)));
      if (score % 50 === 0) sdkHappy();
    }
  }
  if (!row) return;
  // coin pickup
  const hitCoin = row.coins?.find((c) => c.col === col);
  if (hitCoin) collectCoin(row, hitCoin);
  // power-up pickup
  if (row.power && row.power.col === col) {
    const { mesh, kind } = row.power;
    row.group.remove(mesh);
    row.power = null;
    snd.power();
    particles.confetti(new THREE.Vector3(col, 0.5, -r));
    if (kind === 'shield') { player.shield = true; celebrate('SHIELD!', 'gold'); toast('🛡️ SHIELD — blocks one car/train hit, automatic'); }
    if (kind === 'magnet') { player.magnetT = 8; celebrate('MAGNET!', 'gold'); toast('🧲 MAGNET — pulls nearby coins for 8s, automatic'); }
    if (kind === 'superjump') { player.superjump = true; celebrate('AMPHIBIOUS JUMP!', 'gold'); toast('🚀 AMPHIBIOUS JUMP — press a direction mid-air for a second hop (1 use)'); }
    updatePowerHud();
  }
  // landed on a road with a car inches away → thrill
  if (row.type === 'road' && state === 'playing') {
    let closest = Infinity;
    for (const v of row.vehicles) closest = Math.min(closest, Math.abs(v.x - player.x) - v.hit);
    if (closest > 0.32 && closest < 1.15) nearMiss(new THREE.Vector3(player.x, 1.0, -r));
  }
  // river landing
  if (row.type === 'river') {
    const log = row.logs.find((l) => Math.abs(l.x - player.x) <= l.halfLen + 0.48);
    if (log) {
      player.onLog = log;
      // snap the goat onto the log, never hanging off the end
      player.logOffset = THREE.MathUtils.clamp(player.x - log.x, -log.halfLen + 0.28, log.halfLen - 0.28);
      player.x = log.x + player.logOffset;
      particles.ripple(new THREE.Vector3(player.x, 0.1, -r));
    } else {
      die('splash');
    }
  }
}

// ---------------- Death ----------------
function ragdoll(power = 1) {
  const row = rows.get(player.row);
  const dir = row?.dir || (Math.random() < 0.5 ? 1 : -1);
  return {
    kind: 'ragdoll', t: 0,
    vx: dir * (3.2 + Math.random() * 2.5) * power,
    vy: 6 + Math.random() * 2.5 * power,
    vz: 1.6 + Math.random(),
    spin: (8 + Math.random() * 7) * (Math.random() < 0.5 ? 1 : -1),
  };
}

let bleatCd = 0;
function bleat() {
  if (state !== 'playing' || !player.alive || bleatCd > 0) return;
  bleatCd = 0.5;
  [380, 320, 390, 310].forEach((f, i) => setTimeout(() => tone(f, 0.09, 'sawtooth', 0.09, -30), i * 70));
  floats.show(player.mesh.position.clone().add(new THREE.Vector3(0, 1.0, 0)), 'BAAA!', 'thrill');
  player.squash = 1;
  const h = player.goat.userData.head;
  if (h) { h.rotation.z = 0.35; setTimeout(() => { h.rotation.z = 0; }, 220); }
}

function die(kind) {
  if (!player.alive) return;
  if (player.invulnT > 0 && (kind === 'crash' || kind === 'train')) return;
  // falling in water disables any shield (it never blocks a splash)
  if (kind === 'splash' && player.shield) { player.shield = false; player.ramT = 0; updatePowerHud(); }
  // shield absorbs one vehicle hit
  if ((kind === 'crash' || kind === 'train') && player.shield) {
    player.shield = false;
    player.ramT = 0;
    player.invulnT = 1.2;
    updatePowerHud();
    snd.crash();
    shake.add(0.3);
    postfx.flash = 0.3;
    particles.crash(player.mesh.position.clone());
    celebrate('SHIELD DOWN!', 'thrill');
    return;
  }
  player.alive = false;
  deathsSinceAd++;
  state = 'dead';
  ui.eagleWarn.classList.add('hidden');
  eagleShadow.visible = false;
  timeScale = 0.25;                                // slow-mo drama
  postfx.aberration = 1.2;
  postfx.flash = 0.35;
  shake.add(kind === 'splash' ? 0.35 : 0.6);
  const p = player.mesh.position;
  if (kind === 'crash') { snd.crash(); deathAnim = ragdoll(); ui.goReason.textContent = 'SQUASHED!'; particles.crash(p.clone()); }
  if (kind === 'splash') { snd.splash(); deathAnim = { kind, t: 0 }; ui.goReason.textContent = 'GLUG GLUG GLUG...'; particles.splash(p.clone()); }
  if (kind === 'train') { snd.crash(); deathAnim = ragdoll(1.6); ui.goReason.textContent = 'TRAIN FLATTENED!'; particles.crash(p.clone()); }
  if (kind === 'eagle') { snd.eagle(); deathAnim = { kind, t: 0 }; ui.goReason.textContent = 'EAGLE SNATCHED!'; particles.feathers(p.clone().add(new THREE.Vector3(0, 0.8, 0))); }
  if (mode === 'daily') {
    if (score > dailyBest) {
      dailyBest = score;
      localStorage.setItem(dailyKey(), dailyBest);
      ui.goBest.classList.add('new-record');
      ui.goBest.textContent = `NEW DAILY BEST ${dailyBest}!`;
    } else {
      ui.goBest.classList.remove('new-record');
      ui.goBest.textContent = `DAILY BEST ${dailyBest}`;
    }
    ui.best.textContent = `DAILY ${dailyLabel()} · ${dailyBest}`;
  } else if (score > best) {
    best = score;
    localStorage.setItem('capra_best', best);
    ui.goBest.classList.add('new-record');
    ui.goBest.textContent = `NEW BEST ${best}!`;
    ui.best.textContent = `BEST ${best}`;
  } else {
    ui.goBest.classList.remove('new-record');
    ui.goBest.textContent = `BEST ${best}`;
    ui.best.textContent = `BEST ${best}`;
  }
  ui.goScore.textContent = score;
  ui.goStats.innerHTML =
    `<span>🪙 ${coins}</span><span>⚡ ${nearMisses} close call${nearMisses === 1 ? '' : 's'}</span>` +
    `<span>⏱️ ${Math.round(runTime)}s</span>`;
  const menuDelay = deathAnim?.kind === 'ragdoll' ? 1400 : 700;
  setTimeout(() => {
    ui.over.classList.remove('hidden');
    ui.reviveBtn.classList.toggle('hidden', reviveUsed);
    postfx.darken = 0.25;
    sdkGameplayStop();
  }, menuDelay);
}

// ---------------- Share ----------------
async function shareScore() {
  const emo = score >= best && score > 0 ? '👑' : score >= 100 ? '🔥' : score >= 50 ? '⚡' : '🐐';
  const chal = mode === 'daily' ? ` in the DAILY CHALLENGE ${dailyLabel()}` : '';
  const text = `${emo} I took the goat ${score} hops in GOAT CROSSER${chal}! ` +
    `(best: ${curBest()}${nearMisses ? `, close calls: ${nearMisses}` : ''}) — can you beat me?`;
  try {
    if (navigator.share) {
      await navigator.share({ text, title: 'Goat Crosser 🐐' });
      return;
    }
  } catch (_) { /* cancelled → fallback */ }
  try {
    await navigator.clipboard.writeText(text);
    toast('📋 Score copied — paste it anywhere!');
  } catch (_) {
    toast(text);
  }
}

// ---------------- Reset / start ----------------
function resetWorld() {
  for (const [, row] of rows) recycleRow(row);
  rows.clear();
  genState = { lastTypes: [], lastPowerRow: 0 };
  genRand = mode === 'daily' ? mulberry32((dailySeed() * 2654435761) >>> 0) : Math.random;
  dailyBest = +(localStorage.getItem(dailyKey()) || 0);
  if (player) scene.remove(player.mesh);
  if (eagle) { scene.remove(eagle.g); eagle = null; }
  if (!backdrop) buildBackdrop();
  if (!clouds.length) buildClouds();
  player = makePlayer();
  score = 0; coins = 0; newRecord = false; nearMisses = 0; runTime = 0;
  camRow = 0; minRow = -2; idleTimer = 0; deathAnim = null;
  runStarted = false; reviveUsed = false; coinCarry = 0;
  timeScale = 1;
  postfx.darken = 0;
  eagleWarned = false; ui.eagleWarn.classList.add('hidden');
  eagleShadow.visible = false;
  ui.score.textContent = '0';
  ui.coins.textContent = `🪙 ${totalCoins}`;
  ui.best.textContent = mode === 'daily' ? `DAILY ${dailyLabel()} · ${dailyBest}` : `BEST ${best}`;
  updatePowerHud();
  placeRecordFlag();
  ensureRows();
}

function startGame() {
  ui.title.classList.add('hidden');
  ui.over.classList.add('hidden');
  resetWorld();
  state = 'playing';
  startMusic();
}

// interstitial only every 3 cumulative deaths, always outside active gameplay
let deathsSinceAd = 0;
function restartFromMenu() {
  if (deathsSinceAd >= 3) {
    deathsSinceAd = 0;
    sdkMidroll(() => startGame());
  } else {
    startGame();
  }
}

function setMode(m) {
  mode = m;
  ui.modeEndless.classList.toggle('selected', m === 'endless');
  ui.modeDaily.classList.toggle('selected', m === 'daily');
}
ui.modeEndless.addEventListener('click', (e) => { e.stopPropagation(); audio(); setMode('endless'); });
ui.modeDaily.addEventListener('click', (e) => { e.stopPropagation(); audio(); setMode('daily'); });
ui.mute.addEventListener('click', (e) => {
  e.stopPropagation();
  musicOn = !musicOn;
  localStorage.setItem('capra_music', musicOn ? '1' : '0');
  ui.mute.textContent = musicOn ? '🔊' : '🔇';
});
ui.mute.textContent = musicOn ? '🔊' : '🔇';

// ---------------- Input ----------------
const KEYMAP = {
  ArrowUp: [0, 1], KeyW: [0, 1],
  ArrowDown: [0, -1], KeyS: [0, -1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0],
  ArrowRight: [1, 0], KeyD: [1, 0],
};
window.addEventListener('keydown', (e) => {
  if (KEYMAP[e.code]) e.preventDefault();
  audio();
  if (state === 'title') { startGame(); return; }
  if (state === 'dead') { if (e.code === 'Enter') restartFromMenu(); return; }
  if (e.code === 'Space') { bleat(); return; }
  const m = KEYMAP[e.code];
  if (m) tryHop(m[0], m[1]);
});
ui.restart.addEventListener('click', () => { audio(); restartFromMenu(); });
ui.reviveBtn.addEventListener('click', (e) => { e.stopPropagation(); audio(); revive(); });

function revive() {
  if (reviveUsed || state !== 'dead') return;
  sdkRewarded(() => {
    reviveUsed = true;
    ui.over.classList.add('hidden');
    postfx.darken = 0;
    deathAnim = null;
    if (eagle) { scene.remove(eagle.g); eagle = null; }
    // respawn on the nearest grass row at a free column, brief invulnerability
    let r = player.row;
    for (let k = 0; k < 6; k++) {
      const row = rows.get(player.row - k);
      if (row && row.type === 'grass') { r = player.row - k; break; }
    }
    let col = Math.max(-COLS, Math.min(COLS, Math.round(player.x) || 0));
    const row = rows.get(r);
    if (row?.trees.has(col)) {
      for (let c = 1; c <= COLS * 2; c++) {
        if (!row.trees.has(col + c) && col + c <= COLS) { col = col + c; break; }
        if (!row.trees.has(col - c) && col - c >= -COLS) { col = col - c; break; }
      }
    }
    player.row = r; player.col = col; player.x = col;
    player.onLog = null; player.hopping = false; player.buffer = [];
    player.alive = true; player.invulnT = 2.5;
    player.mesh.position.set(col, 0, -r);
    player.mesh.rotation.set(0, 0, 0);
    player.mesh.scale.set(1, 1, 1);
    const gu = player.goat.userData;
    gu.legs.forEach((l) => { l.rotation.x = 0; });
    gu.ears?.forEach((e2) => { e2.rotation.x = 0; });
    if (gu.head) gu.head.rotation.set(0, 0, 0);
    minRow = Math.min(minRow, r - 2);
    idleTimer = 0; eagleWarned = false;
    eagleShadow.visible = false;
    timeScale = 1;
    state = 'playing';
    sdkGameplayStart();
    snd.record();
    celebrate('REVIVED!', 'milestone');
  }, () => toast('Ad unavailable — try again later.'));
}
ui.share.addEventListener('click', (e) => { e.stopPropagation(); shareScore(); });

let touchStart = null;
window.addEventListener('touchstart', (e) => {
  audio();
  if (e.target.closest?.('#skin-row') || e.target.closest?.('#restart-btn') || e.target.closest?.('#share-btn') ||
      e.target.closest?.('#mode-row') || e.target.closest?.('#mute-btn')) return;
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
let worldT = 0;

function nearMiss(pos) {
  nearMisses++;
  snd.whoosh();
  shake.add(0.18);
  postfx.aberration = Math.max(postfx.aberration, 0.4);
  floats.show(pos, 'CLOSE CALL!', 'thrill');
}

function updateVehicles(dt) {
  for (const [, row] of rows) {
    if (row.type === 'road') {
      for (const v of row.vehicles) {
        v.x += row.dir * row.speed * dt;
        if (v.x > LANE_W / 2 + 2) v.x = -LANE_W / 2 - 2;
        if (v.x < -LANE_W / 2 - 2) v.x = LANE_W / 2 + 2;
        v.mesh.position.x = v.x;
        // suspension wobble
        v.mesh.position.y = Math.abs(Math.sin(worldT * row.speed * 2.4 + v.phase)) * 0.015;
      }
    } else if (row.type === 'river') {
      for (const l of row.logs) {
        l.x += row.dir * row.speed * dt;
        if (l.x > LANE_W / 2 + 2) l.x = -LANE_W / 2 - 2;
        if (l.x < -LANE_W / 2 - 2) l.x = LANE_W / 2 + 2;
        l.mesh.position.x = l.x;
        // gentle bobbing + roll
        l.bob = Math.sin(worldT * 1.8 + l.bobPhase) * 0.03;
        l.mesh.position.y = 0.02 + l.bob;
        l.mesh.rotation.x = Math.sin(worldT * 1.4 + l.bobPhase) * 0.04;
      }
      // scroll the water along the current
      if (row.water) row.water.material.map.offset.x += row.dir * row.speed * dt * 0.03;
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
          tr.nm = false;
          tr.x = row.dir > 0 ? -LANE_W / 2 - tr.mesh.userData.totalLen : LANE_W / 2 + tr.mesh.userData.totalLen;
          tr.mesh.position.x = tr.x;      // sync now: no 1-frame flash at old position
        }
      } else if (tr.phase === 'run') {
        tr.x += row.dir * tr.speed * dt;
        tr.mesh.position.x = tr.x;
        const off = tr.mesh.userData.totalLen + LANE_W / 2 + 4;
        if ((row.dir > 0 && tr.x > off) || (row.dir < 0 && tr.x < -off)) {
          tr.phase = 'idle'; tr.t = rand(3, 7 - (tr.diff || 0) * 3 - (tr.late || 0) * 1.5); tr.mesh.visible = false;
          tr.signal.userData.light.material.emissive.setHex(0x000000);
        }
      }
    }
    // coin spin + bob
    for (const c of row.coins || []) {
      c.mesh.rotation.y += dt * 3;
      c.mesh.position.y = 0.5 + Math.sin(worldT * 3 + row.r) * 0.06;
    }
    if (row.power) {
      row.power.mesh.rotation.y += dt * 2.2;
      row.power.mesh.position.y = 0.45 + Math.sin(worldT * 2.6 + row.r) * 0.08;
    }
  }
}

function checkCollisions() {
  if (!player.alive) return;
  const row = rows.get(player.row);
  if (!row) return;
  const px = player.hopping
    ? player.hopFrom.x + (player.hopTo.x - player.hopFrom.x) * player.hopT
    : player.x;
  const hopHigh = player.hopping && Math.sin(Math.PI * player.hopT) > 0.45;

  if (row.type === 'road') {
    for (const v of row.vehicles) {
      const dist = Math.abs(v.x - px);
      if (!hopHigh && dist < v.hit + 0.26) { die('crash'); return; }
      // near-miss: the car whooshes right past the goat
      if (dist < v.halfLen + 0.95) v.nm = true;
      else if (v.nm && dist > v.halfLen + 1.6) {
        v.nm = false;
        if (state === 'playing') nearMiss(new THREE.Vector3(px, 1.0, -row.r));
      }
    }
  }
  if (row.type === 'rail' && row.train?.phase === 'run') {
    const tr = row.train;
    const head = tr.x, tail = tr.x - Math.sign(row.dir) * tr.mesh.userData.totalLen;
    const lo = Math.min(head, tail) - 0.95, hi = Math.max(head, tail) + 0.95;
    if (!hopHigh && px > lo && px < hi) { die('train'); return; }
    const distEdge = Math.min(Math.abs(px - lo), Math.abs(px - hi));
    if (px > lo - 1.3 && px < hi + 1.3 && distEdge < 1.3) tr.nm = true;
    else if (tr.nm && (px < lo - 2 || px > hi + 2 || tr.phase !== 'run')) {
      tr.nm = false;
      if (state === 'playing') nearMiss(new THREE.Vector3(px, 1.0, -row.r));
    }
  }
}

function updatePlayer(dt) {
  const goat = player.goat.userData;
  player.animT += dt;
  if (player.hopping) {
    player.hopT = Math.min(1, player.hopT + dt / (player.hopBig ? HOP_TIME * 1.6 : HOP_TIME));
    const t = player.hopT;
    const x = player.hopFrom.x + (player.hopTo.x - player.hopFrom.x) * t;
    const z = player.hopFrom.z + (player.hopTo.z - player.hopFrom.z) * t;
    const baseY = (player.hopFrom.y || 0) * (1 - t);
    player.mesh.position.set(x, baseY + Math.sin(Math.PI * t) * (player.hopBig ? HOP_HEIGHT * 1.8 : HOP_HEIGHT), z);
    // in-air stretch + legs tuck
    const air = Math.sin(Math.PI * t);
    player.mesh.scale.set(1 - air * 0.12, 1 + air * 0.18, 1 - air * 0.08);
    goat.legs.forEach((leg, i) => { leg.rotation.x = air * (i < 2 ? -0.9 : 0.9); });
    goat.ears.forEach((ear, i) => { ear.rotation.x = -air * 0.5; });
    if (t >= 1) {
      goat.legs.forEach((leg) => { leg.rotation.x = 0; });
      goat.ears.forEach((ear) => { ear.rotation.x = 0; });
      landPlayer();
      if (player.buffer.length) { const [bx, bz] = player.buffer.shift(); tryHop(bx, bz); }
    }
  } else if (player.alive) {
    if (player.onLog) {
      const log = player.onLog;
      player.x = log.x + player.logOffset;
      player.mesh.position.x = player.x;
      // ride the log surface: height + bob + slight roll with it
      player.mesh.position.y = (log.topY || 0.34) + (log.bob || 0);
      player.mesh.rotation.z = (log.mesh.rotation.x || 0) * 0.6;
      if (Math.abs(player.x) > COLS + 1.4) { die('splash'); return; }
    } else {
      player.mesh.position.y = 0;
      player.mesh.rotation.z = 0;
    }
    // squash landing anim
    if (player.squash > 0) {
      player.squash = Math.max(0, player.squash - dt * 8);
      const s = 1 - 0.22 * Math.sin(player.squash * Math.PI);
      player.mesh.scale.set(1 / s * 0.5 + 0.5, s, 1 / s * 0.5 + 0.5);
    } else {
      player.mesh.scale.set(1, 1, 1);
    }
    // idle life: head bob, tail wag, blink
    if (goat.head) goat.head.position.y = 0.72 + Math.sin(player.animT * 2.2) * 0.015;
    if (goat.tail) goat.tail.rotation.x = 0.6 + Math.sin(player.animT * 6) * 0.25;
    player.blinkT -= dt;
    if (player.blinkT <= 0) {
      player.blinkT = rand(1.5, 4.5);
      goat.eyes?.forEach((e) => { e.scale.y = 0.1; setTimeout(() => { e.scale.y = 1; }, 110); });
    }
  }
}

function updatePowers(dt) {
  if (!player?.alive || state !== 'playing') return;
  if (player.invulnT > 0) player.invulnT -= dt;
  // Montone perk: intrinsic shield recharges 45s after being spent
  if (currentSkin === 'montone' && !player.shield) {
    player.ramT += dt;
    if (player.ramT >= 45) {
      player.ramT = 0;
      player.shield = true;
      celebrate('RAM SHIELD!', 'gold');
      snd.power();
      updatePowerHud();
    }
  }
  if (player.magnetT > 0) {
    player.magnetT -= dt;
    for (let k = -3; k <= 3; k++) {
      const row = rows.get(player.row + k);
      if (!row?.coins?.length) continue;
      for (const entry of [...row.coins]) {
        const m = entry.mesh;
        const tx = player.mesh.position.x;
        const tz = player.mesh.position.z + row.r;   // player world z -> row-local z
        const dx = tx - m.position.x, dz = tz - m.position.z;
        const worldDist = Math.hypot(m.position.x - player.mesh.position.x, (-row.r + m.position.z) - player.mesh.position.z);
        if (worldDist < 4.5) {
          const s = Math.min(1, dt * 7);
          m.position.x += dx * s;
          m.position.z += dz * s;
          if (worldDist < 0.55) collectCoin(row, entry);
        }
      }
    }
    updatePowerHud();
  }
}

function updateDeath(dt) {
  if (!deathAnim) return;
  deathAnim.t += dt;
  const t = deathAnim.t;
  if (deathAnim.kind === 'ragdoll') {
    const p = player.mesh;
    deathAnim.vy -= 17 * dt;
    p.position.x += deathAnim.vx * dt;
    p.position.y += deathAnim.vy * dt;
    p.position.z += deathAnim.vz * dt;
    if (p.position.y < 0.05 && deathAnim.vy < 0) {
      p.position.y = 0.05;
      deathAnim.vy *= -0.45;
      deathAnim.vx *= 0.8;
      particles.dust(p.position.clone());
    }
    p.rotation.z += deathAnim.spin * dt;
    p.rotation.x += deathAnim.spin * 0.55 * dt;
    const gu = player.goat.userData;
    gu.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 26 + i * 1.7) * 1.3; });
    gu.ears?.forEach((e2, i) => { e2.rotation.x = Math.sin(t * 21 + i) * 0.9; });
    gu.head && (gu.head.rotation.z = Math.sin(t * 17) * 0.4);
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
  const warnSlow = idleTimer > 4.0;
  const warnBehind = player.row < minRow - 2.5;
  const tooSlow = idleTimer > 5.5;
  const behind = player.row < minRow - 3.5;
  // pre-warning: banner + screech + growing shadow, escape still possible
  if ((warnSlow || warnBehind) && !eagle) {
    if (!eagleWarned) { eagleWarned = true; snd.eagle(); scene.add(eagleShadow); }
    ui.eagleWarn.classList.remove('hidden');
    const g = Math.min(1, (idleTimer - 4.0) / 1.5);
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
    const creep = 0.28 + Math.min(score / 300, 0.5) + lateAt(score) * 0.15;
    minRow += creep * dt * timeScale;
    if (player.row > minRow + 2) minRow = player.row - 2;
  }
  // forward-only camera: track the furthest row reached (score), never the goat retreating
  const targetRow = Math.max(score, minRow);
  camRow += (targetRow - camRow) * Math.min(1, dt * 3.5);
  // follow X softly but never let the goat leave the frustum
  let px = 0;
  if (state === 'playing' || state === 'dead') {
    const gx = player.mesh.position.x;
    px = gx * 0.45;
    const halfW = (camera.right - camera.left) / 2;
    const margin = Math.min(halfW - 0.8, 2.2);
    px = THREE.MathUtils.clamp(px, gx - (halfW - margin) + 0, gx + (halfW - margin));
    // also keep the camera centered enough to see the field
    px = THREE.MathUtils.clamp(px, -COLS + 2, COLS - 2);
    // hard guarantee: goat on screen
    px = THREE.MathUtils.clamp(px, gx - (halfW - 1.2), gx + (halfW - 1.2));
  }
  const sh = shake.update(dt);
  const focus = new THREE.Vector3(px + sh.x, 0, -camRow);
  camera.position.copy(focus).add(CAM_OFF);
  camera.position.y += sh.y;
  camera.lookAt(focus);
  camera.rotation.z += sh.rot;
  sun.position.copy(focus).add(new THREE.Vector3(-6, 12, 5));
  sun.target.position.copy(focus);
}

function tick() {
  const rawDt = Math.min(clock.getDelta(), 0.05);
  if (bleatCd > 0) bleatCd -= rawDt;
  // slow-mo eases back to real time
  if (timeScale < 1) timeScale = Math.min(1, timeScale + rawDt * 1.1);
  const dt = rawDt * timeScale;
  worldT += dt;
  if (state === 'playing') runTime += rawDt;
  if (state === 'playing' || state === 'dead') {
    updateVehicles(dt);
    updatePlayer(dt);
    updatePowers(dt);
    checkCollisions();
    updateEagle(dt);
    updateDeath(dt);
    ensureRows();
  }
  particles.update(dt);
  floats.update(rawDt);
  updateClouds(rawDt);
  updateDayCycle(rawDt);
  updateCamera(rawDt);
  postfx.render(scene, camera, rawDt);
  requestAnimationFrame(tick);
}

// debug/testing hook (harmless in production)
window.__dbg = {
  get rows() { return rows; },
  get player() { return player; },
  get state() { return state; },
  get score() { return score; },
  get nearMisses() { return nearMisses; },
  get mode() { return mode; },
  get reviveUsed() { return reviveUsed; },
  get poolSizes() { const o = {}; for (const [k, a] of objPool) o[k] = a.length; return o; },
  setMode,
  revive,
  tryHop,
};

// Boot: splash (min 2s) + preload GLB library, then title with backdrop
const bootT = performance.now();
loadLibrary().then(() => {
  resetWorld();
  renderSkinShop();
  document.getElementById('loading-text')?.classList.add('hidden');
  const wait = Math.max(0, 2000 - (performance.now() - bootT));
  setTimeout(() => {
    document.getElementById('splash-screen').classList.add('fade');
    ui.title.classList.remove('hidden');
    state = 'title';
  }, wait);
});
tick();
