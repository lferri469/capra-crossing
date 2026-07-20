// Capra Crossing — cute endless hopper. Three.js, procedural assets, CrazyGames-ready.
import * as THREE from 'three';
import {
  PALETTE, SKINS, ACCESSORIES, attachAccessories, loadLibrary, makeGoat, makeTree, makeRock,
  makeCar, makeTruck, makeLog, makeTrain, makeCoin, makeEagle, makeSignal, makeLily, makeCloud,
  makePowerup, mat,
} from './models.js';
import { grassTexture, roadTexture, railTexture, waterTexture } from './textures.js';
import { Particles, FloatingText, PostFX, Shake } from './fx.js';
import { t } from './i18n.js';

// ---------------- Constants ----------------
const TILE = 1;
const COLS = 9;               // playable columns: -COLS..COLS (near-full screen width)
const LANE_W = 42;            // visual lane width
const AHEAD = 24;             // rows generated ahead of player
const BEHIND = 7;             // rows kept behind camera
const HOP_TIME = 0.14;
const HOP_HEIGHT = 0.55;

// ---------------- CrazyGames SDK guards ----------------
const CG = () => window.CrazyGames?.SDK;
let sdkReady = false;
async function sdkInit() { try { await CG()?.init?.(); } catch (_) {} sdkReady = true; }
function sdkGameplayStart() { try { CG()?.game?.gameplayStart?.(); } catch (_) {} }
function sdkGameplayStop() { try { CG()?.game?.gameplayStop?.(); } catch (_) {} }
function sdkHappy() { try { CG()?.game?.happytime?.(); } catch (_) {} }
function sdkLoadingStart() { try { CG()?.game?.loadingStart?.(); } catch (_) {} }
function sdkLoadingStop() { try { CG()?.game?.loadingStop?.(); } catch (_) {} }
// CrazyGames QA: game audio must be silent while an ad plays
let adPlaying = false;
function adStart() { adPlaying = true; try { bgMusic.pause(); } catch (_) {} }
function adEnd() { adPlaying = false; if (musicOn && state !== 'title') bgMusic.play().catch(() => {}); }
function sdkMidroll(cb) {
  const sdk = CG();
  if (sdk?.ad?.requestAd) {
    try {
      sdk.ad.requestAd('midgame', {
        adStarted: adStart,
        adFinished: () => { adEnd(); cb(); },
        adError: () => { adEnd(); cb(); },
      });
      return;
    } catch (_) {}
  }
  cb();
}
function sdkRewarded(onDone, onFail) {
  const sdk = CG();
  if (sdk?.ad?.requestAd) {
    try {
      sdk.ad.requestAd('rewarded', {
        adStarted: adStart,
        adFinished: () => { adEnd(); onDone(); },
        adError: () => { adEnd(); onFail(); },
      });
      return;
    } catch (_) {}
  }
  setTimeout(onDone, 400);   // local/dev fallback: grant the reward
}
const sdkReadyPromise = sdkInit();
const onCrazyGames = /(^|\.)crazygames\.com$/.test(location.hostname);

// ---------------- Persistence: CrazyGames Data Module (cross-device save) ----------------
// Same get/set/remove signature as localStorage by design (docs.crazygames.com/sdk/data) —
// drop-in swap. Guests are proxied to localStorage by the SDK itself, so this only changes
// behavior for signed-in CrazyGames users (their save syncs across devices). Off-platform,
// or before init resolves, falls straight through to plain localStorage.
const store = {
  get(key) {
    const d = sdkReady && CG()?.data;
    try { return d ? d.getItem(key) : localStorage.getItem(key); } catch (_) { return localStorage.getItem(key); }
  },
  set(key, value) {
    const d = sdkReady && CG()?.data;
    try { if (d) { d.setItem(key, value); return; } } catch (_) {}
    localStorage.setItem(key, value);
  },
};

// ---------------- Audio (tiny synth) ----------------
let actx = null;
function audio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {} }
  if (actx?.state === 'suspended') actx.resume();
  return actx;
}
function tone(freq, dur, type = 'square', vol = 0.12, slide = 0) {
  if (adPlaying) return;
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
  if (adPlaying) return;
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
// ---------------- Audio (ElevenLabs-generated clips, balanced mix) ----------------
const SFX_MASTER = 0.8;
const SFX_FILES = {
  hop: ['assets/audio/sfx/goat_hop.mp3', 0.35],
  coin: ['assets/audio/sfx/coin.mp3', 0.5],
  crash: ['assets/audio/sfx/crash.mp3', 0.7],
  impact: ['assets/audio/sfx/impact_thud.mp3', 0.85],
  splash: ['assets/audio/sfx/splash.mp3', 0.55],
  eagle: ['assets/audio/sfx/eagle_screech.mp3', 0.6],
  deny: ['assets/audio/sfx/deny.mp3', 0.35],
  record: ['assets/audio/sfx/record_fanfare.mp3', 0.6],
  milestone: ['assets/audio/sfx/milestone.mp3', 0.45],
  shield: ['assets/audio/sfx/shield_pickup.mp3', 0.5],
  magnet: ['assets/audio/sfx/magnet_pickup.mp3', 0.5],
  speed: ['assets/audio/sfx/speed_pickup.mp3', 0.5],
  train_horn: ['assets/audio/sfx/train_horn.mp3', 0.55],
  train_rumble: ['assets/audio/sfx/train_rumble.mp3', 0.45],
  car_pass: ['assets/audio/sfx/car_pass.mp3', 0.4],
  car_horn: ['assets/audio/sfx/car_horn.mp3', 0.3],
  gameover: ['assets/audio/sfx/gameover.mp3', 0.5],
  bleat: ['assets/audio/sfx/goat_bleat_happy.mp3', 0.55],
  bleat_ram: ['assets/audio/sfx/ram_bleat.mp3', 0.6],
  bleat_alpaca: ['assets/audio/sfx/alpaca_hum.mp3', 0.55],
  bleat_hurt: ['assets/audio/sfx/goat_bleat_hurt.mp3', 0.5],
  bleat_pig: ['assets/audio/sfx/pig_oink.mp3', 0.6],
  bleat_bull: ['assets/audio/sfx/bull_snort.mp3', 0.6],
  bleat_horse: ['assets/audio/sfx/horse_neigh.mp3', 0.55],
  bleat_deer: ['assets/audio/sfx/deer_squeak.mp3', 0.55],
};
const sfxCache = new Map();
function playSfx(name, vol = 1) {
  if (adPlaying) return null;   // silence during ads (CrazyGames QA)
  const def = SFX_FILES[name];
  if (!def) return null;
  const [src, relVol] = def;
  let base = sfxCache.get(name);
  if (!base) { base = new Audio(src); base.preload = 'auto'; sfxCache.set(name, base); }
  const el = base.cloneNode();
  el.volume = Math.min(1, Math.max(0, SFX_MASTER * relVol * vol));
  el.play().catch(() => {});
  return el;
}
// distance falloff for world-anchored sounds: full volume on the player's row,
// silent past `range` rows away
function rowFalloff(r, range = 10) {
  const d = Math.abs(r - (player?.row ?? 0));
  return Math.max(0, 1 - d / range);
}
// a row is "on stage" if the camera can actually show it — sounds from anywhere
// else must stay silent (no more phantom trains behind you or 20 rows ahead)
function rowAudible(r) {
  const rel = r - camRow;
  return rel > -5 && rel < 14;
}
const snd = {
  hop: () => playSfx('hop'),
  coin: () => playSfx('coin'),
  crash: () => playSfx('crash'),
  splash: () => playSfx('splash'),
  warn: () => tone(660, 0.12, 'square', 0.1),
  eagle: () => playSfx('eagle'),
  deny: () => playSfx('deny'),
  record: () => playSfx('record'),
  whoosh: () => noise(0.18, 0.22, 1600, 'bandpass'),
  milestone: () => playSfx('milestone'),
  power: (kind) => playSfx(kind === 'magnet' ? 'magnet' : kind === 'speed' ? 'speed' : 'shield'),
};

// ---------------- Background music (ElevenLabs-generated loop) ----------------
const MUSIC_VOL = 0.22;   // sits well under SFX so pickups/impacts stay readable
let musicOn = true;   // real value loaded from store in loadPersistedState()
const bgMusic = new Audio('assets/audio/music/bg.mp3');
bgMusic.loop = true;
bgMusic.volume = MUSIC_VOL;
function startMusic() {
  if (!musicOn || !audio()) return;
  bgMusic.play().catch(() => {});
}
function setMusicOn(on) {
  musicOn = on;
  if (on) bgMusic.play().catch(() => {}); else bgMusic.pause();
}

// ---------------- Renderer / Scene ----------------
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const isMobileish = Math.min(window.innerWidth, window.innerHeight) < 500 || 'ontouchstart' in window;
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
sun.shadow.mapSize.set(isMobileish ? 1024 : 2048, isMobileish ? 1024 : 2048);   // low-end friendly
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

// scratch colors reused every call: dayTarget runs once per frame, zero allocations
const _dtSky = new THREE.Color(), _dtSun = new THREE.Color();
function dayTarget(row) {
  const BAND = 50, FADE = 10;
  const i = Math.floor(row / BAND) % 4;
  const j = (i + 1) % 4;
  const local = row % BAND;
  const t = local < BAND - FADE ? 0 : (local - (BAND - FADE)) / FADE;
  const A = DAY_PHASES[i], B = DAY_PHASES[j];
  _dtSky.setHex(A.sky).lerp(_cB.setHex(B.sky), t);
  _dtSun.setHex(A.sun).lerp(_cA.setHex(B.sun), t);
  return {
    sky: _dtSky,
    sun: _dtSun,
    sunI: A.sunI + (B.sunI - A.sunI) * t,
    amb: A.amb + (B.amb - A.amb) * t,
    hemiI: A.hemiI + (B.hemiI - A.hemiI) * t,
  };
}

// pure, no genRand: safe to call every frame without perturbing the daily-mode world seed
function biomeAtmoTarget(row) {
  const BAND = 100, FADE = 20;
  const i = (Math.floor(row / BAND) + effStartBiome()) % BIOMES.length;
  const j = (i + 1) % BIOMES.length;
  const local = row % BAND;
  const t = local < BAND - FADE ? 0 : (local - (BAND - FADE)) / FADE;
  const A = BIOMES[i].sky, B = BIOMES[j].sky;
  return {
    r: A.r + (B.r - A.r) * t, g: A.g + (B.g - A.g) * t, b: A.b + (B.b - A.b) * t,
    fogNear: BIOMES[i].fogNear + (BIOMES[j].fogNear - BIOMES[i].fogNear) * t,
    fogFar: BIOMES[i].fogFar + (BIOMES[j].fogFar - BIOMES[i].fogFar) * t,
  };
}
const bioCur = { r: 1, g: 1, b: 1, fogNear: 18, fogFar: 34 };
const _skyMul = new THREE.Color();

function updateDayCycle(dt) {
  const row = Math.max(score, 0);
  const tgt = dayTarget(row);
  const bTgt = biomeAtmoTarget(row);
  const k = Math.min(1, dt * 1.2);
  dayCur.sky.lerp(tgt.sky, k);
  dayCur.sun.lerp(tgt.sun, k);
  dayCur.sunI += (tgt.sunI - dayCur.sunI) * k;
  dayCur.amb += (tgt.amb - dayCur.amb) * k;
  dayCur.hemiI += (tgt.hemiI - dayCur.hemiI) * k;
  bioCur.r += (bTgt.r - bioCur.r) * k;
  bioCur.g += (bTgt.g - bioCur.g) * k;
  bioCur.b += (bTgt.b - bioCur.b) * k;
  bioCur.fogNear += (bTgt.fogNear - bioCur.fogNear) * k;
  bioCur.fogFar += (bTgt.fogFar - bioCur.fogFar) * k;
  _skyMul.copy(dayCur.sky);
  _skyMul.r = Math.min(1, _skyMul.r * bioCur.r);
  _skyMul.g = Math.min(1, _skyMul.g * bioCur.g);
  _skyMul.b = Math.min(1, _skyMul.b * bioCur.b);
  scene.background.copy(_skyMul);
  scene.fog.color.copy(_skyMul);
  scene.fog.near = bioCur.fogNear;
  scene.fog.far = bioCur.fogFar;
  sun.color.copy(dayCur.sun);
  sun.intensity = dayCur.sunI;
  ambient.intensity = dayCur.amb;
  hemi.intensity = dayCur.hemiI;
}

// ---------------- World state ----------------
let rows = new Map();          // rowIndex -> row data
let player, eagle = null;
let state = 'loading';         // loading | title | playing | dead
// persisted fields below get their real values from loadPersistedState(), called
// once the CrazyGames Data Module (or localStorage fallback) is ready to read
let score = 0, coins = 0, best = 0, newRecord = false;
let totalCoins = 0;
let ownedSkins = ['bianca'];
let currentSkin = 'bianca';
let ownedAcc = [];
let equippedAcc = { head: null, neck: null, back: null };
let ownedBiomes = [0];
let startBiome = 0;
let camRow = 0, minRow = 0, idleTimer = 0, eagleWarned = false;
let mode = 'endless';          // endless | daily
let runStarted = false;        // first forward hop fired gameplayStart
let reviveUsed = false;        // one rewarded revive per run
let dailyBest = 0;
const curBest = () => (mode === 'daily' ? dailyBest : best);
let deathAnim = null;
let nearMisses = 0;
let runTime = 0;
let lastBiomeIdx = 0;

// growing dark disc under the goat while the eagle closes in
const eagleShadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.5, 24),
  new THREE.MeshBasicMaterial({ color: 0x1a1a22, transparent: true, opacity: 0.45, depthWrite: false })
);
eagleShadow.rotation.x = -Math.PI / 2;
eagleShadow.visible = false;

function saveCoins() {
  store.set('capra_coins', totalCoins);
  store.set('capra_owned', JSON.stringify(ownedSkins));
  store.set('capra_skin', currentSkin);
  store.set('capra_acc', JSON.stringify(ownedAcc));
  store.set('capra_acc_eq', JSON.stringify(equippedAcc));
  store.set('capra_biomes', JSON.stringify(ownedBiomes));
  store.set('capra_start_biome', startBiome);
}

// called once, after the Data Module (or its localStorage fallback) is ready to read
function loadPersistedState() {
  best = +(store.get('capra_best') || 0);
  totalCoins = +(store.get('capra_coins') || 0);
  ownedSkins = JSON.parse(store.get('capra_owned') || '["bianca"]');
  currentSkin = store.get('capra_skin') || 'bianca';
  ownedAcc = JSON.parse(store.get('capra_acc') || '[]');
  equippedAcc = JSON.parse(store.get('capra_acc_eq') || '{"head":null,"neck":null,"back":null}');
  ownedBiomes = JSON.parse(store.get('capra_biomes') || '[0]');
  startBiome = +(store.get('capra_start_biome') || 0);
  if (!ownedBiomes.includes(startBiome)) startBiome = 0;
  musicOn = store.get('capra_music') !== '0';
  ui.mute.textContent = musicOn ? '🔊' : '🔇';
  if (onCrazyGames && !ownedSkins.includes('crazy')) { ownedSkins.push('crazy'); saveCoins(); }
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
// localized static UI (title screen, overlays) — set once at boot
function applyStaticI18n() {
  const set = (sel, txt) => { const el = document.querySelector(sel); if (el) el.textContent = txt; };
  set('.subtitle', t('subtitle'));
  set('#mode-endless', `🐐 ${t('endless')}`);
  set('#mode-daily', `🗓️ ${t('daily')}`);
  set('#loading-text', t('loading'));
  const hints = document.querySelectorAll('.controls-hint span');
  if (hints[0]) hints[0].textContent = t('hint_keys');
  if (hints[1]) hints[1].textContent = t('hint_swipe');
  set('.blink', t('press_start'));
  set('.splash-text', t('tagline'));
  set('#eagle-warning', t('eagle_warn'));
  set('#revive-btn', t('revive_btn'));
  set('#restart-btn', t('try_again'));
  set('#share-btn', t('share_btn'));
  set('.hint-small', t('or_enter'));
  set('#tab-animals', `🐐 ${t('tab_animals')}`);
  set('#tab-gear', `🎩 ${t('tab_gear')}`);
  set('#tab-worlds', `🌍 ${t('tab_worlds')}`);
}
applyStaticI18n();
// CrazyGames badge on the title screen, only when actually hosted there
if (onCrazyGames) document.getElementById('cg-badge')?.classList.remove('hidden');
// best/coins HUD text is set in resetWorld() at boot, once loadPersistedState() has
// actually loaded the save data (Data Module or localStorage fallback)

let toastTimer = null;
function toast(msg) {
  ui.toast.textContent = msg;
  ui.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.add('hidden'), 1800);
}

// ---------------- Shop: animals / gear / worlds ----------------
let shopTab = 'animals';

// CrazyGames-compliant rewarded unlock: always user-initiated from an explicit
// "WATCH AD" button, reward granted only on adFinished (sdkRewarded handles
// the local no-SDK fallback and the adError path)
function unlockByAd(label, grant) {
  sdkRewarded(() => {
    grant();
    saveCoins();
    snd.record();
    toast(t('t_unlocked', { name: label }));
    renderShop();
    refreshTitlePreview();
  }, () => toast(t('t_ad_fail')));
}

function refreshTitlePreview() {
  if (state === 'title' && player) {
    scene.remove(player.mesh);
    player = makePlayer();
  }
}

function card(inner, cls = '') {
  const btn = document.createElement('button');
  btn.className = 'skin-btn' + cls;
  btn.innerHTML = inner;
  return btn;
}

function renderAnimals() {
  for (const s of SKINS) {
    // progress unlock: granted automatically once the best score is reached
    if (s.bestUnlock && best >= s.bestUnlock && !ownedSkins.includes(s.id)) {
      ownedSkins.push(s.id); saveCoins();
    }
    const owned = ownedSkins.includes(s.id);
    const cgLocked = !!s.cgOnly && !onCrazyGames && !owned;
    const sw = `#${s.body.toString(16).padStart(6, '0')}`;
    let costLine;
    if (cgLocked) costLine = t('cg_lock');
    else if (owned) costLine = currentSkin === s.id ? t('equipped') : t('select');
    else if (s.adUnlock) costLine = t('watch_ad');
    else if (s.bestUnlock) costLine = t('reach_best', { n: s.bestUnlock });
    else costLine = `🪙 ${s.cost}`;
    const perkTxt = t('perk_' + s.id) || s.perk;
    const btn = card(
      `<img class="skin-icon" src="assets/icons/${s.id}.png" alt="${s.name}"` +
      ` onerror="this.outerHTML='<span class=&quot;skin-swatch&quot; style=&quot;background:${sw}&quot;></span>'">` +
      `<span class="skin-name">${s.name}</span>` +
      (s.perk ? `<span class="skin-perk">${perkTxt}</span>` : '') +
      `<span class="skin-cost">${costLine}</span>`,
      (currentSkin === s.id ? ' selected' : '') + (owned ? ' owned' : '') + (cgLocked ? ' locked' : '')
    );
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      audio();
      if (cgLocked) { toast(t('t_cg_only')); return; }
      if (owned) {
        currentSkin = s.id; saveCoins(); renderShop(); refreshTitlePreview();
      } else if (s.adUnlock) {
        unlockByAd(s.name, () => { ownedSkins.push(s.id); currentSkin = s.id; });
      } else if (s.bestUnlock) {
        toast(t('t_reach_best_full', { n: s.bestUnlock, name: s.name, b: best }));
      } else if (totalCoins >= s.cost) {
        totalCoins -= s.cost; ownedSkins.push(s.id); currentSkin = s.id;
        saveCoins(); snd.coin(); renderShop(); refreshTitlePreview();
        ui.coins.textContent = `🪙 ${totalCoins}`;
      } else {
        snd.deny();
        toast(t('t_no_coins', { name: s.name, c: s.cost }));
      }
    });
    ui.skinRow.appendChild(btn);
  }
}

function renderGear() {
  for (const a of ACCESSORIES) {
    const owned = ownedAcc.includes(a.id);
    const equipped = equippedAcc[a.slot] === a.id;
    const costLine = owned ? (equipped ? t('unwear') : t('wear')) : `🪙 ${a.cost}`;
    const btn = card(
      `<span class="gear-emoji">${a.emoji}</span>` +
      `<span class="skin-name">${t('acc_' + a.id) || a.name}</span>` +
      `<span class="skin-perk">${t('slot_' + a.slot)}</span>` +
      `<span class="skin-cost">${costLine}</span>`,
      (equipped ? ' selected' : '') + (owned ? ' owned' : '')
    );
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      audio();
      if (owned) {
        equippedAcc[a.slot] = equipped ? null : a.id;   // one item per slot
        saveCoins(); renderShop(); refreshTitlePreview();
      } else if (totalCoins >= a.cost) {
        totalCoins -= a.cost; ownedAcc.push(a.id); equippedAcc[a.slot] = a.id;
        saveCoins(); snd.coin(); renderShop(); refreshTitlePreview();
        ui.coins.textContent = `🪙 ${totalCoins}`;
      } else {
        snd.deny();
        toast(t('t_no_coins', { name: t('acc_' + a.id) || a.name, c: a.cost }));
      }
    });
    ui.skinRow.appendChild(btn);
  }
}

const BIOME_COST = 400;
function renderWorlds() {
  BIOMES.forEach((B, i) => {
    const owned = ownedBiomes.includes(i);
    const isStart = startBiome === i;
    const btn = card(
      `<span class="gear-emoji">${B.emoji}</span>` +
      `<span class="skin-name">${t('biome_' + i)}</span>` +
      (owned
        ? `<span class="skin-cost">${isStart ? t('starting_here') : t('start_here')}</span>`
        : `<span class="skin-perk">${t('unlock_hint')}</span>`),
      (isStart ? ' selected' : '') + (owned ? ' owned' : '')
    );
    if (!owned) {
      // two explicit unlock paths, both user-initiated
      const rowEl = document.createElement('span');
      rowEl.className = 'unlock-row';
      const buyBtn = document.createElement('span');
      buyBtn.className = 'mini-btn';
      buyBtn.textContent = `🪙 ${BIOME_COST}`;
      buyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        audio();
        if (totalCoins >= BIOME_COST) {
          totalCoins -= BIOME_COST; ownedBiomes.push(i); startBiome = i;
          saveCoins(); snd.coin(); renderShop();
          ui.coins.textContent = `🪙 ${totalCoins}`;
          if (state === 'title') resetWorld();
        } else {
          snd.deny();
          toast(t('t_no_coins', { name: t('biome_' + i), c: BIOME_COST }));
        }
      });
      const adBtn = document.createElement('span');
      adBtn.className = 'mini-btn';
      adBtn.textContent = '📺 AD';
      adBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        audio();
        unlockByAd(t('biome_' + i), () => {
          ownedBiomes.push(i); startBiome = i;
          if (state === 'title') resetWorld();
        });
      });
      rowEl.append(buyBtn, adBtn);
      btn.appendChild(rowEl);
    }
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      audio();
      if (!owned) return;   // unlock only via the two explicit mini buttons
      startBiome = i; saveCoins(); renderShop();
      if (state === 'title') resetWorld();   // instant preview of the new landscape
    });
    ui.skinRow.appendChild(btn);
  });
}

function renderShop() {
  ui.titleCoins.textContent = `🪙 ${totalCoins}`;
  for (const [id, tab] of [['tab-animals', 'animals'], ['tab-gear', 'gear'], ['tab-worlds', 'worlds']]) {
    document.getElementById(id).classList.toggle('selected', shopTab === tab);
  }
  ui.skinRow.innerHTML = '';
  if (shopTab === 'animals') renderAnimals();
  else if (shopTab === 'gear') renderGear();
  else renderWorlds();
}
for (const [id, tab] of [['tab-animals', 'animals'], ['tab-gear', 'gear'], ['tab-worlds', 'worlds']]) {
  document.getElementById(id).addEventListener('click', (e) => {
    e.stopPropagation();
    audio();
    shopTab = tab;
    renderShop();
  });
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
  { name: 'campagna', label: 'MEADOWLANDS', emoji: '🌼', style: 'meadow', water: 0x4aa8e0, grassA: 0xa8d878, grassB: 0x9ccc68, trees: ['tree_default', 'tree_oak', 'tree_fat', 'tree_detailed'], sky: { r: 1, g: 1, b: 1 }, fogNear: 18, fogFar: 34 },
  { name: 'autunno', label: 'AUTUMN WOODS', emoji: '🍂', style: 'leaves', water: 0x4a98c8, grassA: 0xcdb45e, grassB: 0xc1a852, trees: ['tree_default_fall', 'tree_oak_fall', 'tree_detailed_fall', 'tree_fat_fall'], sky: { r: 1.08, g: 0.96, b: 0.8 }, fogNear: 16, fogFar: 30 },
  { name: 'costa', label: 'SUNNY COAST', emoji: '🏖️', style: 'sand', water: 0x2ec4c9, grassA: 0xe6d8a2, grassB: 0xdccd94, trees: ['tree_palm', 'tree_palmShort', 'tree_palmTall', 'tree_palmBend', 'cactus_short', 'cactus_tall'], sky: { r: 0.92, g: 1.04, b: 1.1 }, fogNear: 21, fogFar: 39 },
  { name: 'deserto', label: 'DUSTY DESERT', emoji: '🌵', style: 'sand', water: 0x58b0c0, grassA: 0xe8c27a, grassB: 0xdbb066, trees: ['cactus_short', 'cactus_tall'], sky: { r: 1.16, g: 0.97, b: 0.76 }, fogNear: 13, fogFar: 26 },
  { name: 'montagna', label: 'HIGH PEAKS', emoji: '⛰️', style: 'alpine', water: 0x4a9fd8, grassA: 0x9fae9a, grassB: 0x93a38d, trees: ['tree_pineDefaultA', 'tree_pineDefaultB', 'tree_pineRoundA', 'tree_pineRoundB', 'tree_cone'], sky: { r: 0.94, g: 1.0, b: 1.1 }, fogNear: 22, fogFar: 40 },
  { name: 'inverno', label: 'FROZEN FIELDS', emoji: '❄️', style: 'snow', water: 0x9fd4e8, grassA: 0xdde8ea, grassB: 0xd0dde0, trees: ['tree_pineDefaultA', 'tree_pineDefaultB', 'tree_pineRoundA', 'tree_pineRoundB'], sky: { r: 1.0, g: 1.03, b: 1.14 }, fogNear: 15, fogFar: 28 },
  { name: 'bosco scuro', label: 'DARK FOREST', emoji: '🍄', style: 'forest', water: 0x3a7a8a, grassA: 0x87996a, grassB: 0x7b8d5f, trees: ['tree_default_dark', 'tree_oak_dark', 'tree_detailed_dark', 'tree_blocks_dark'], sky: { r: 0.74, g: 0.82, b: 0.72 }, fogNear: 11, fogFar: 22 },
];
const _gA = new THREE.Color(), _gB = new THREE.Color();

// chosen starting landscape shifts the whole biome cycle (endless only —
// the daily challenge world must be identical for every player)
const effStartBiome = () => (mode === 'daily' ? 0 : startBiome);

function biomeAt(r) {
  const BAND = 100, FADE = 20;
  const i = (Math.floor(r / BAND) + effStartBiome()) % BIOMES.length;
  const j = (i + 1) % BIOMES.length;
  const local = r % BAND;
  const t = local < BAND - FADE ? 0 : (local - (BAND - FADE)) / FADE;
  const A = BIOMES[i], B = BIOMES[j];
  const cross = genRand() < t;                  // gradual mix inside the fade
  return {
    grassA: _gA.setHex(A.grassA).lerp(_gB.setHex(B.grassA), t).getHex() & 0xF0F0F0,
    grassB: _gA.setHex(A.grassB).lerp(_gB.setHex(B.grassB), t).getHex() & 0xF0F0F0,
    trees: cross ? B.trees : A.trees,
    style: cross ? B.style : A.style,
    water: _gA.setHex(A.water).lerp(_gB.setHex(B.water), t).getHex() & 0xF0F0F0,
  };
}
const biomeIndexAt = (r) => (Math.floor(Math.max(r, 0) / 100) + effStartBiome()) % BIOMES.length;

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
function stopRumble(tr) {
  if (tr?.rumble) { try { tr.rumble.pause(); } catch (_) {} tr.rumble = null; }
}
function recycleRow(row) {
  stopRumble(row.train);
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

// textured lane materials, cached per type+color(+biome style for grass)
const laneMats = new Map();
function laneMat(type, color, style = 'meadow') {
  const key = `${type}_${color}_${style}`;
  if (!laneMats.has(key)) {
    let tex;
    if (type === 'grass') tex = grassTexture(color, style);
    else if (type === 'road') tex = roadTexture(color);
    else if (type === 'rail') tex = railTexture(color);
    else tex = waterTexture(color);
    laneMats.set(key, new THREE.MeshLambertMaterial({ color: 0xffffff, map: tex }));
  }
  return laneMats.get(key);
}

function lanePlane(type, color, y = 0, style = 'meadow') {
  let m;
  if (type === 'water') {
    m = poolGet('lane_water');
    if (!m) {
      m = new THREE.Mesh(GEO.lane, new THREE.MeshLambertMaterial({ color: 0xffffff, map: waterTexture(color).clone() }));
      m.userData._pk = 'lane_water';
    } else {
      m.material.map?.dispose();                      // free the old GPU texture
      m.material.map = waterTexture(color).clone();   // recolor pooled water to the biome
      m.material.needsUpdate = true;
    }
  } else {
    m = poolGet('lane_solid');
    if (m) m.material = laneMat(type, color, style);
    else {
      m = new THREE.Mesh(GEO.lane, laneMat(type, color, style));
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
    row.lane = lanePlane('grass', r % 2 ? biome.grassA : biome.grassB, 0, biome.style);
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
        // hearts are rarer than the other power-ups
        const kind = genRand() < 0.18 ? 'heart' : gpick(['shield', 'magnet', 'speed']);
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
    const water = lanePlane('water', biomeAt(r).water, -0.08);
    row.lane = water;
    group.add(water);
    const dir = genRand() < 0.5 ? 1 : -1;
    const speed = grand(1.25, 1.8) + diff * 1.3 + late * 1.0;
    const n = grandi(4, 5) + (speed < 1.5 ? 1 : 0);
    const span = LANE_W;
    const addLog = (x) => {
      const tiles = late > 0.35 && genRand() < 0.4 + late * 0.3 ? 2 : grandi(2, 3);
      let l = poolGet('log_' + tiles);
      if (!l) { l = makeLog(tiles); l.userData._pk = 'log_' + tiles; }
      l.position.x = x; l.position.y = 0.02;
      group.add(l);
      row.logs.push({ mesh: l, x, halfLen: l.userData.halfLen, topY: l.userData.topY, bobPhase: grand(0, 6.28) });
    };
    for (let i = 0; i < n; i++) addLog(-span / 2 + (i + grand(0.2, 0.8)) * (span / n));
    // crossability guarantee: random jitter used to open gaps of up to ~17 units —
    // longer than the eagle timer allows you to wait. Cap every water gap (incl.
    // the wraparound one) so a log is always reachable in time.
    const MAX_GAP = 4.2;
    const beltLen = span + 4;    // logs wrap at ±(span/2 + 2): the real belt length
    for (let pass = 0; pass < 8; pass++) {
      row.logs.sort((a, b) => a.x - b.x);
      const inserts = [];
      for (let i = 0; i < row.logs.length; i++) {
        const a = row.logs[i];
        const b = row.logs[(i + 1) % row.logs.length];
        const bx = i + 1 < row.logs.length ? b.x : b.x + beltLen;   // wraparound gap
        const gap = bx - a.x - a.halfLen - b.halfLen;
        if (gap > MAX_GAP) {
          let fx = a.x + a.halfLen + gap / 2;
          if (fx > span / 2 + 2) fx -= beltLen;
          inserts.push(fx);
        }
      }
      if (!inserts.length) break;
      for (const fx of inserts) addLog(fx);
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

let backdrop = null, backdropBiome = -1;
function buildBackdrop() {
  if (backdrop) scene.remove(backdrop);
  const B = BIOMES[effStartBiome()];
  backdropBiome = effStartBiome();
  backdrop = new THREE.Group();
  for (let r = -1; r >= -12; r--) {
    const g = new THREE.Group();
    g.position.z = -r * TILE;
    g.add(lanePlane('grass', r % 2 ? B.grassA : B.grassB, 0, B.style));
    for (let c = -20; c <= 20; c++) {
      if (Math.abs(c) <= COLS && r >= -2) continue;
      if (Math.random() < 0.4) { const t = makeTree(randi(1, 2), B.trees); t.position.x = c; g.add(t); }
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

let genMaxRow = -1;   // rows are built strictly in order: skip the O(row) rescan per frame
function ensureRows() {
  const target = Math.floor(camRow) + AHEAD;
  for (let r = genMaxRow + 1; r <= target; r++) buildRow(r);
  if (target > genMaxRow) genMaxRow = target;
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
  attachAccessories(goat, equippedAcc);    // cosmetic gear from the shop
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
    shield: currentSkin === 'montone', magnetT: 0, speedT: 0, invulnT: 0, ramT: 0,
    lives: 0,                              // extra life (❤️ pickup), max 1
  };
}

// invisible wall: never let the goat hop back past the camera's visibility edge
const backWallRow = () => Math.floor(camRow) - (BEHIND - 2);

function tryHop(dx, dz) {
  if (!player.alive || state !== 'playing') return;
  if (player.hopping) {
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
    // Bull perk: charge straight through, smashing the obstacle
    if (currentSkin === 'bull') {
      targetRow.trees.delete(toCol);
      const idx = targetRow.props.findIndex((o) => Math.round(o.position.x) === toCol);
      if (idx >= 0) {
        const o = targetRow.props[idx];
        targetRow.props.splice(idx, 1);
        poolPut(o.userData._pk, o);
      }
      playSfx('impact', 0.7);
      shake.add(0.15);
      particles.leaves(new THREE.Vector3(toCol, 0.7, -toRow));
      celebrate(t('c_smash'), 'thrill');
      // fall through: the hop continues into the now-cleared cell
    } else {
      snd.deny();
      player.facing = Math.atan2(dx, -dz || 0.0001);
      player.mesh.rotation.y = player.facing;
      // bump feedback: leaf burst on the tree
      particles.leaves(new THREE.Vector3(toCol, 0.7, -toRow));
      return;
    }
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

let lastHud = '';
function updatePowerHud() {
  const parts = [];
  if (player?.lives > 0) parts.push('❤️');
  if (player?.shield) parts.push('🛡️');
  if (player?.magnetT > 0) parts.push(`🧲${Math.ceil(player.magnetT)}`);
  if (player?.speedT > 0) parts.push(`⚡${Math.ceil(player.speedT)}`);
  const s = parts.join(' ');
  if (s !== lastHud) { lastHud = s; ui.powerHud.textContent = s; }   // no DOM churn per frame
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
    // biome banner the moment the goat crosses into a new landscape
    const bi = biomeIndexAt(r);
    if (bi !== lastBiomeIdx) {
      lastBiomeIdx = bi;
      const B = BIOMES[bi];
      celebrate(`${B.emoji} ${t('biome_' + bi)}`, 'milestone');
      snd.milestone();
    }
    score = r;
    ui.score.textContent = score;
    if (score > curBest() && !newRecord && curBest() >= 5) {
      newRecord = true;
      snd.record();
      celebrate(t('c_new_best'), 'record');
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
    snd.power(kind);
    particles.confetti(new THREE.Vector3(col, 0.5, -r));
    if (kind === 'shield') { player.shield = true; celebrate(t('c_shield'), 'gold'); toast(t('t_shield')); }
    if (kind === 'magnet') { player.magnetT = 8; celebrate(t('c_magnet'), 'gold'); toast(t('t_magnet')); }
    if (kind === 'speed') { player.speedT = 6; celebrate(t('c_speed'), 'gold'); toast(t('t_speed')); }
    if (kind === 'heart') {
      if (player.lives < 1) { player.lives = 1; celebrate(t('c_life'), 'record'); toast(t('t_heart')); }
      else { const bonus = 10; coins += bonus; totalCoins += bonus; saveCoins(); ui.coins.textContent = `🪙 ${totalCoins}`; celebrate(`+${bonus}`, 'gold'); }
    }
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
    spin: (3 + Math.random() * 3) * (Math.random() < 0.5 ? 1 : -1),
  };
}

let bleatCd = 0;
// each species has its own voice and cry
const VOICES = {
  montone: { sfx: 'bleat_ram', text: 'BRAAA!' },
  alpaca: { sfx: 'bleat_alpaca', text: 'MHMM~' },
  pig: { sfx: 'bleat_pig', text: 'OINK!' },
  bull: { sfx: 'bleat_bull', text: 'SNORT!' },
  horse: { sfx: 'bleat_horse', text: 'NEIGH!' },
  deer: { sfx: 'bleat_deer', text: 'EEP!' },
};
function bleat() {
  if (state !== 'playing' || !player.alive || bleatCd > 0) return;
  bleatCd = 0.5;
  const voice = VOICES[currentSkin] || { sfx: 'bleat', text: 'BAAA!' };
  playSfx(voice.sfx);
  floats.show(player.mesh.position.clone().add(new THREE.Vector3(0, 1.0, 0)), voice.text, 'thrill');
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
    playSfx('impact');
    shake.add(0.3);
    postfx.flash = 0.3;
    particles.crash(player.mesh.position.clone());
    celebrate(t('c_shield_down'), 'thrill');
    return;
  }
  // shield also saves the goat from the eagle: one grab absorbed, bird driven off
  if (kind === 'eagle' && player.shield) {
    player.shield = false;
    player.ramT = 0;
    player.invulnT = 1.5;
    updatePowerHud();
    if (eagle) { scene.remove(eagle.g); eagle = null; }
    idleTimer = 0; eagleWarned = false;
    ui.eagleWarn.classList.add('hidden');
    eagleShadow.visible = false;
    minRow = Math.min(minRow, player.row - 1);   // slack so it doesn't re-trigger instantly
    snd.eagle();
    shake.add(0.35);
    postfx.flash = 0.3;
    particles.feathers(player.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0)));
    celebrate(t('c_shield_saved'), 'thrill');
    return;
  }
  // extra life: one death fully absorbed, instant respawn (max 1 held)
  if (player.lives > 0) {
    player.lives = 0;
    updatePowerHud();
    if (kind === 'crash' || kind === 'train') { snd.crash(); playSfx('impact'); }
    if (kind === 'splash') snd.splash();
    if (kind === 'eagle') snd.eagle();
    playSfx('bleat_hurt');
    shake.add(0.4);
    postfx.flash = 0.35;
    particles.crash(player.mesh.position.clone());
    respawnPlayer(2.5);
    celebrate(t('c_life'), 'record');
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
  if (kind === 'crash') { snd.crash(); playSfx('impact'); playSfx('bleat_hurt'); deathAnim = ragdoll(); ui.goReason.textContent = t('go_crash'); particles.crash(p.clone()); }
  if (kind === 'splash') { snd.splash(); deathAnim = { kind, t: 0 }; ui.goReason.textContent = t('go_splash'); particles.splash(p.clone()); }
  if (kind === 'train') { snd.crash(); playSfx('impact'); playSfx('bleat_hurt'); deathAnim = ragdoll(1.6); ui.goReason.textContent = t('go_train'); particles.crash(p.clone()); }
  if (kind === 'eagle') { snd.eagle(); playSfx('bleat_hurt'); deathAnim = { kind, t: 0 }; ui.goReason.textContent = t('go_eagle'); particles.feathers(p.clone().add(new THREE.Vector3(0, 0.8, 0))); }
  if (mode === 'daily') {
    if (score > dailyBest) {
      dailyBest = score;
      store.set(dailyKey(), dailyBest);
      ui.goBest.classList.add('new-record');
      ui.goBest.textContent = t('new_daily_best_n', { n: dailyBest });
    } else {
      ui.goBest.classList.remove('new-record');
      ui.goBest.textContent = t('daily_best_n', { n: dailyBest });
    }
    ui.best.textContent = `${t('daily_hud')} ${dailyLabel()} · ${dailyBest}`;
  } else if (score > best) {
    best = score;
    store.set('capra_best', best);
    ui.goBest.classList.add('new-record');
    ui.goBest.textContent = t('new_best_n', { n: best });
    ui.best.textContent = `${t('best')} ${best}`;
  } else {
    ui.goBest.classList.remove('new-record');
    ui.goBest.textContent = `${t('best')} ${best}`;
    ui.best.textContent = `${t('best')} ${best}`;
  }
  ui.goScore.textContent = score;
  ui.goStats.innerHTML =
    `<span>🪙 ${coins}</span><span>⚡ ${nearMisses} ${t('close_calls')}</span>` +
    `<span>⏱️ ${Math.round(runTime)}s</span>`;
  const menuDelay = deathAnim?.kind === 'ragdoll' ? 1400 : 700;
  setTimeout(() => {
    ui.over.classList.remove('hidden');
    ui.reviveBtn.classList.toggle('hidden', reviveUsed);
    postfx.darken = 0.25;
    sdkGameplayStop();
    playSfx('gameover');
  }, menuDelay);
}

// ---------------- Share ----------------
async function shareScore() {
  const emo = score >= best && score > 0 ? '👑' : score >= 100 ? '🔥' : score >= 50 ? '⚡' : '🐐';
  const text = t('share_text', { emo, n: score, b: curBest() });
  try {
    if (navigator.share) {
      await navigator.share({ text, title: 'Goat Crosser 🐐' });
      return;
    }
  } catch (_) { /* cancelled → fallback */ }
  try {
    await navigator.clipboard.writeText(text);
    toast(t('t_copied'));
  } catch (_) {
    toast(text);
  }
}

// ---------------- Reset / start ----------------
function resetWorld() {
  for (const [, row] of rows) recycleRow(row);
  rows.clear();
  genMaxRow = -1;
  genState = { lastTypes: [], lastPowerRow: 0 };
  genRand = mode === 'daily' ? mulberry32((dailySeed() * 2654435761) >>> 0) : Math.random;
  dailyBest = +(store.get(dailyKey()) || 0);
  if (player) scene.remove(player.mesh);
  if (eagle) { scene.remove(eagle.g); eagle = null; }
  if (!backdrop || backdropBiome !== effStartBiome()) buildBackdrop();
  if (!clouds.length) buildClouds();
  player = makePlayer();
  score = 0; coins = 0; newRecord = false; nearMisses = 0; runTime = 0; lastBiomeIdx = effStartBiome();
  camRow = 0; minRow = -2; idleTimer = 0; deathAnim = null;
  runStarted = false; reviveUsed = false; coinCarry = 0;
  timeScale = 1;
  postfx.darken = 0;
  eagleWarned = false; ui.eagleWarn.classList.add('hidden');
  eagleShadow.visible = false;
  ui.score.textContent = '0';
  ui.coins.textContent = `🪙 ${totalCoins}`;
  ui.best.textContent = mode === 'daily' ? `${t('daily_hud')} ${dailyLabel()} · ${dailyBest}` : `${t('best')} ${best}`;
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
  // Crazy Goat perk: every run kicks off with a random power-up
  if (currentSkin === 'crazy') {
    const kind = pick(['shield', 'magnet', 'speed']);
    if (kind === 'shield') player.shield = true;
    if (kind === 'magnet') player.magnetT = 8;
    if (kind === 'speed') player.speedT = 6;
    updatePowerHud();
    snd.power(kind);
    toast(t('t_crazy_start', { kind: kind.toUpperCase() }));
  }
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
  setMusicOn(!musicOn);
  store.set('capra_music', musicOn ? '1' : '0');
  ui.mute.textContent = musicOn ? '🔊' : '🔇';
});
// initial icon set in loadPersistedState(), once musicOn reflects the real saved value

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

// bring the goat back on the nearest grass row at a free column
function respawnPlayer(invuln = 2.5) {
  ui.over.classList.add('hidden');
  postfx.darken = 0;
  deathAnim = null;
  if (eagle) { scene.remove(eagle.g); eagle = null; }
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
  player.alive = true; player.invulnT = invuln;
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
  ui.eagleWarn.classList.add('hidden');
  timeScale = 1;
  state = 'playing';
}

function revive() {
  if (reviveUsed || state !== 'dead') return;
  sdkRewarded(() => {
    reviveUsed = true;
    respawnPlayer(2.5);
    sdkGameplayStart();
    snd.record();
    celebrate(t('c_revived'), 'milestone');
  }, () => toast(t('t_ad_fail')));
}
ui.share.addEventListener('click', (e) => { e.stopPropagation(); shareScore(); });

let touchStart = null;
window.addEventListener('touchstart', (e) => {
  audio();
  if (e.target.closest?.('#skin-shop') || e.target.closest?.('#restart-btn') || e.target.closest?.('#share-btn') ||
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

function nearMiss(pos, kind = 'car') {
  nearMisses++;
  snd.whoosh();
  if (kind === 'car') playSfx('car_horn');
  shake.add(0.18);
  postfx.aberration = Math.max(postfx.aberration, 0.4);
  floats.show(pos, t('c_close'), 'thrill');
}

function updateVehicles(dt) {
  for (const [, row] of rows) {
    if (row.type === 'road') {
      const nearPlayer = state === 'playing' && Math.abs(row.r - player.row) <= 2;
      for (const v of row.vehicles) {
        v.x += row.dir * row.speed * dt;
        if (v.x > LANE_W / 2 + 2) { v.x = -LANE_W / 2 - 2; v.passed = false; }
        if (v.x < -LANE_W / 2 - 2) { v.x = LANE_W / 2 + 2; v.passed = false; }
        v.mesh.position.x = v.x;
        // suspension wobble
        v.mesh.position.y = Math.abs(Math.sin(worldT * row.speed * 2.4 + v.phase)) * 0.015;
        // engine pass-by: every car sweeping past the goat is heard, closer = louder
        if (nearPlayer) {
          const dx = Math.abs(v.x - player.x);
          if (!v.passed && dx < 2.2) {
            v.passed = true;
            const prox = 1 - Math.abs(row.r - player.row) / 3;   // same row loudest
            playSfx('car_pass', 0.4 + prox * 0.6);
          } else if (v.passed && dx > 5) {
            v.passed = false;
          }
        }
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
        // horn only for trains the camera can show, volume drops with distance
        if (rowAudible(row.r)) {
          const v = rowFalloff(row.r, 10);
          if (v > 0.05) { snd.warn(); playSfx('train_horn', 0.35 + v * 0.65); }
        }
      } else if (tr.phase === 'warn') {
        const blink = Math.floor(tr.t * 6) % 2 === 0;
        tr.signal.userData.light.material.emissive.setHex(blink ? 0xff2020 : 0x000000);
        if (tr.t <= 0) {
          tr.phase = 'run';
          tr.mesh.visible = true;
          tr.nm = false;
          tr.x = row.dir > 0 ? -LANE_W / 2 - tr.mesh.userData.totalLen : LANE_W / 2 + tr.mesh.userData.totalLen;
          tr.mesh.position.x = tr.x;      // sync now: no 1-frame flash at old position
          if (rowAudible(row.r) && rowFalloff(row.r, 10) > 0.05) {
            tr.rumble = playSfx('train_rumble', rowFalloff(row.r, 10));
            if (tr.rumble) tr.rumble.loop = true;
          }
        }
      } else if (tr.phase === 'run') {
        tr.x += row.dir * tr.speed * dt;
        tr.mesh.position.x = tr.x;
        // rumble tracks the train: fades with distance, dies with the train
        if (tr.rumble) {
          const v = rowAudible(row.r) ? rowFalloff(row.r, 10) : 0;
          tr.rumble.volume = Math.min(1, SFX_MASTER * SFX_FILES.train_rumble[1] * v);
        }
        const off = tr.mesh.userData.totalLen + LANE_W / 2 + 4;
        if ((row.dir > 0 && tr.x > off) || (row.dir < 0 && tr.x < -off)) {
          tr.phase = 'idle'; tr.t = rand(3, 7 - (tr.diff || 0) * 3 - (tr.late || 0) * 1.5); tr.mesh.visible = false;
          tr.signal.userData.light.material.emissive.setHex(0x000000);
          stopRumble(tr);
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
  // physical position of the goat right now (mid-hop it is between two rows)
  const px = player.hopping
    ? player.hopFrom.x + (player.hopTo.x - player.hopFrom.x) * player.hopT
    : player.x;
  const pz = player.hopping
    ? player.hopFrom.z + (player.hopTo.z - player.hopFrom.z) * player.hopT
    : -player.row;
  // cars can be cleared only at the very top of the arc; trains are far too
  // tall to ever hop over
  const arc = player.hopping ? Math.sin(Math.PI * player.hopT) : 0;
  const overCars = arc > 0.8;

  // every row the goat's body overlaps (at most two while mid-hop)
  const rLo = Math.floor(-pz + 0.45), rHi = Math.ceil(-pz - 0.45);
  for (let ri = Math.min(rLo, rHi); ri <= Math.max(rLo, rHi); ri++) {
    const row = rows.get(ri);
    if (!row) continue;

    if (row.type === 'road') {
      for (const v of row.vehicles) {
        const dist = Math.abs(v.x - px);
        if (!overCars && dist < v.hit + 0.26) { die('crash'); return; }
        // near-miss: the car whooshes right past the goat (only on the main row)
        if (ri === Math.round(-pz)) {
          if (dist < v.halfLen + 0.95) v.nm = true;
          else if (v.nm && dist > v.halfLen + 1.6) {
            v.nm = false;
            if (state === 'playing') nearMiss(new THREE.Vector3(px, 1.0, -row.r));
          }
        }
      }
    }
    if (row.type === 'rail' && row.train?.phase === 'run') {
      const tr = row.train;
      const head = tr.x, tail = tr.x - Math.sign(row.dir) * tr.mesh.userData.totalLen;
      const lo = Math.min(head, tail) - 0.95, hi = Math.max(head, tail) + 0.95;
      if (px > lo && px < hi) { die('train'); return; }   // no hop-over: a train is a wall
      if (ri === Math.round(-pz)) {
        const distEdge = Math.min(Math.abs(px - lo), Math.abs(px - hi));
        if (px > lo - 1.3 && px < hi + 1.3 && distEdge < 1.3) tr.nm = true;
        else if (tr.nm && (px < lo - 2 || px > hi + 2 || tr.phase !== 'run')) {
          tr.nm = false;
          if (state === 'playing') nearMiss(new THREE.Vector3(px, 1.0, -row.r), 'train');
        }
      }
    }
  }
}

function updatePlayer(dt) {
  const goat = player.goat.userData;
  player.animT += dt;
  if (player.hopping) {
    const hopDur = (player.hopBig ? HOP_TIME * 1.6 : HOP_TIME) * (player.speedT > 0 ? 0.55 : 1)
      * (currentSkin === 'horse' ? 0.8 : 1);   // Horse perk: 20% faster hops
    player.hopT = Math.min(1, player.hopT + dt / hopDur);
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
    if (goat.head) goat.head.position.y = (goat.headBaseY || 0.72) + Math.sin(player.animT * 2.2) * 0.015;
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
      celebrate(t('c_ram_shield'), 'gold');
      snd.power('shield');
      updatePowerHud();
    }
  }
  if (player.speedT > 0) player.speedT -= dt;
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
    p.rotation.x += deathAnim.spin * 0.3 * dt;
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
  const calm = currentSkin === 'deer' ? 2 : 0;   // Deer perk: the eagle waits +2s
  const warnSlow = idleTimer > 4.0 + calm;
  const warnBehind = player.row < minRow - 2.5;
  const tooSlow = idleTimer > 5.5 + calm;
  const behind = player.row < minRow - 3.5;
  // pre-warning: banner + screech + growing shadow, escape still possible
  if ((warnSlow || warnBehind) && !eagle) {
    if (!eagleWarned) { eagleWarned = true; snd.eagle(); scene.add(eagleShadow); }
    ui.eagleWarn.classList.remove('hidden');
    const g = Math.min(1, (idleTimer - (4.0 + calm)) / 1.5);
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
  frame(Math.min(clock.getDelta(), 0.05));
  requestAnimationFrame(tick);
}

function frame(rawDt) {
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
  step: (dt = 1 / 60) => frame(dt),   // manual tick for headless/automated tests
};

// Boot: branded splash + preload GLB library + wait for the SDK (so the Data
// Module is ready before the first save read), then title with backdrop
const bootT = performance.now();
sdkLoadingStart();
Promise.all([sdkReadyPromise, loadLibrary()]).then(() => {
  sdkLoadingStop();
  loadPersistedState();
  resetWorld();
  renderShop();
  document.getElementById('loading-text')?.classList.add('hidden');
  const wait = Math.max(0, 1400 - (performance.now() - bootT));
  setTimeout(() => {
    document.getElementById('splash-screen').classList.add('fade');
    ui.title.classList.remove('hidden');
    state = 'title';
  }, wait);
});
tick();
