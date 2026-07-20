// Models: Kenney CC0 GLB (cars/trees/rocks) + procedural (goat/logs/train/eagle).
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { barkTexture, logEndTexture, furTexture } from './textures.js';

// ---------- GLB library ----------
const LIB = {};
const CAR_MODELS = ['sedan', 'sedan-sports', 'suv', 'taxi', 'police', 'hatchback-sports'];
const TRUCK_MODELS = ['truck', 'delivery', 'van', 'ambulance'];
const TREE_MODELS = ['tree_default', 'tree_oak', 'tree_fat', 'tree_pineDefaultA', 'tree_pineDefaultB', 'tree_cone', 'tree_detailed'];
const BIOME_TREES = [
  'tree_default_fall', 'tree_oak_fall', 'tree_detailed_fall', 'tree_fat_fall',
  'tree_palm', 'tree_palmShort', 'tree_palmTall', 'tree_palmBend', 'cactus_short', 'cactus_tall',
  'tree_pineRoundA', 'tree_pineRoundB',
  'tree_default_dark', 'tree_oak_dark', 'tree_detailed_dark', 'tree_blocks_dark',
];
const ROCK_MODELS = ['rock_largeA', 'rock_largeB', 'rock_tallA'];

function prepModel(scene, targetLen, axis = 'x') {
  const bbox = new THREE.Box3().setFromObject(scene);
  const size = bbox.getSize(new THREE.Vector3());
  let s = targetLen / (axis === 'x' ? size.x : Math.max(size.x, size.z));
  if (axis === 'x') {
    const depth = size.z * s;                 // vehicles must fit inside 1-tile lane depth
    if (depth > 0.92) s *= 0.92 / depth;
  } else {
    const h = size.y * s;                     // props: cap height (thin models like cacti blow up otherwise)
    if (h > 1.7) s *= 1.7 / h;
  }
  scene.scale.setScalar(s);
  bbox.setFromObject(scene);
  scene.position.y -= bbox.min.y;                       // feet on ground
  const center = bbox.getCenter(new THREE.Vector3());
  scene.position.x -= center.x; scene.position.z -= center.z;
  scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const wrap = new THREE.Group();
  wrap.add(scene);
  return wrap;
}

export function loadLibrary() {
  const loader = new GLTFLoader();
  const load = (name, targetLen, axis) => new Promise((res) => {
    loader.load(`assets/models/${name}.glb`, (g) => {
      LIB[name] = { scene: prepModel(g.scene, targetLen, axis), len: targetLen };
      res();
    }, undefined, () => { console.warn('GLB fallito:', name); res(); });   // fallback: procedural
  });
  const jobs = [];
  for (const m of CAR_MODELS) jobs.push(load(m, 1.7, 'x'));
  for (const m of TRUCK_MODELS) jobs.push(load(m, 2.0, 'x'));
  for (const m of TREE_MODELS) jobs.push(load(m, 0.9, 'xz'));
  for (const m of BIOME_TREES) jobs.push(load(m, 0.9, 'xz'));
  for (const m of ROCK_MODELS) jobs.push(load(m, 0.75, 'xz'));
  return Promise.all(jobs);
}

function cloneLib(name) {
  const entry = LIB[name];
  return entry ? entry.scene.clone(true) : null;
}

const mats = new Map();
export function mat(color) {
  if (!mats.has(color)) mats.set(color, new THREE.MeshLambertMaterial({ color }));
  return mats.get(color);
}

function box(w, h, d, color, x = 0, y = 0, z = 0, castShadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = castShadow;
  m.receiveShadow = true;
  return m;
}

function ball(r, color, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, material = null) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 12), material || mat(color));
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export const PALETTE = {
  grassA: 0xa8d878, grassB: 0x9ccc68,
  road: 0x4a4a58, roadLine: 0x6a6a78,
  water: 0x4aa8e0,
  rail: 0x8a7860, railSleeper: 0x6b5844,
  goatBody: 0xf5f0e8, goatHorn: 0xd9a066,
  treeTrunk: 0x8a6642,
  treeLeaf: [0x5a9e4b, 0x6db05c, 0x4d8f3f],
  carColors: [0xd95763, 0x5b7ede, 0xf2a65a, 0x8fce5a, 0xb06ac9, 0xf5e04b],
  truckColors: [0x7a9cc6, 0xc67a7a],
  log: 0x8a6240,
  train: 0xc0392b, trainCar: 0x9b5445,
  coin: 0xffd700,
  eagle: 0x5a4632,
};

// ---------- GOAT SKINS ----------
export const SKINS = [
  { id: 'bianca', name: 'Rosetta', cost: 0, body: 0xf5f0e8, snout: 0xe8ded0, horn: 0xd9a066 },
  { id: 'nera', name: 'Nerina', cost: 20, body: 0x3a3a42, snout: 0x55555f, horn: 0xcccccc, shape: { earLen: 1.35, earDroop: 0.3 } },
  { id: 'marrone', name: 'Ciocco', cost: 40, body: 0x8a5f3b, snout: 0xa87f57, horn: 0xf0e6d8, shape: { bodyScale: 1.14, hornScale: 0.75 } },
  { id: 'dorata', name: 'Aurelia', cost: 80, body: 0xe8c84a, snout: 0xf5e04b, horn: 0xffffff, shape: { hornScale: 1.4, tailFluff: 1.5 } },
  { id: 'zombie', name: 'Zombina', cost: 150, body: 0x8aa86a, snout: 0xa8c88a, horn: 0x666655, shape: { spotted: 0x4a5a3f, earDroop: 0.6, hornScale: 0.6 } },
  // ability skins: perk text shown in the shop, logic lives in main.js
  { id: 'montone', name: 'Montone', cost: 5000, body: 0xb8ada0, snout: 0x8f8478, horn: 0x6b5a48, perk: '🛡️ auto-shield every 45s', shape: { hornScale: 1.9, hornCurl: 1, bodyScale: 1.1 } },
  { id: 'alpaca', name: 'Alpaca', cost: 10000, body: 0xe8d8c2, snout: 0xcbb49b, horn: 0xd9cfc0, perk: '🪙 1.2× coins', shape: { neck: 0.16, earLen: 1.6, hornScale: 0.4 } },
  // site-exclusive: auto-unlocks only on crazygames.com domains
  { id: 'crazy', name: 'Crazy Goat', cost: 0, body: 0xff6b00, snout: 0x1a1a1a, horn: 0x1a1a1a, cgOnly: true, shape: { hornScale: 1.6, hornCurl: -0.6, spotted: 0x1a1a1a } },
];

// ---------- GOAT (player) — rounded, furry, fully riggable ----------
export function makeGoat(skinId = 'bianca') {
  const skin = SKINS.find((s) => s.id === skinId) || SKINS[0];
  const shp = skin.shape || {};
  const bodyScale = shp.bodyScale || 1;
  const hornScale = shp.hornScale || 1;
  const hornCurl = shp.hornCurl || 0;
  const earLen = shp.earLen || 1;
  const earDroop = shp.earDroop || 0;
  const tailFluff = shp.tailFluff || 1;
  const neck = shp.neck || 0;
  const g = new THREE.Group();
  const furMat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: furTexture(skin.body) });
  const snoutMat = new THREE.MeshLambertMaterial({ color: skin.snout });
  const hornMat = new THREE.MeshLambertMaterial({ color: skin.horn });

  // body: plump ellipsoid + chest tuft
  const body = ball(0.34 * bodyScale, 0, 0, 0.46, -0.02, 1.0, 0.82, 1.24, furMat);
  const rump = ball(0.26 * bodyScale, 0, 0, 0.48, -0.3, 1.05, 0.9, 1.0, furMat);
  // breed markings: a couple of darker patches over the coat
  if (shp.spotted) {
    const spotMat = new THREE.MeshLambertMaterial({ color: shp.spotted });
    g.add(ball(0.1, 0, -0.14, 0.5, -0.12, 1, 0.7, 1, spotMat));
    g.add(ball(0.08, 0, 0.15, 0.42, -0.34, 1, 0.7, 1, spotMat));
  }

  // head group (bobs / looks around)
  const headG = new THREE.Group();
  headG.position.set(0, 0.72 + neck, 0.34 + neck * 0.4);
  const head = ball(0.21, 0, 0, 0, 0, 0.95, 0.95, 1.0, furMat);
  const snout = ball(0.115, 0, 0, -0.055, 0.175, 1.0, 0.8, 1.05, snoutMat);
  const nose = ball(0.035, 0x554444, 0, -0.03, 0.28);
  nose.castShadow = false;
  // eyes: white + dark pupil, slightly out to the sides
  const eyes = [];
  for (const sx of [-1, 1]) {
    const eye = ball(0.052, 0xffffff, sx * 0.13, 0.06, 0.135);
    eye.castShadow = false;
    const pupil = ball(0.028, 0x22201f, sx * 0.145, 0.06, 0.175);
    pupil.castShadow = false;
    eyes.push(eye);
    headG.add(eye, pupil);
  }
  // horns: two-segment curved cones (scale/curl vary per breed — ram = big+curled, alpaca = stubby)
  for (const sx of [-1, 1]) {
    const h1 = new THREE.Mesh(new THREE.ConeGeometry(0.05 * hornScale, 0.2 * hornScale, 8), hornMat);
    h1.position.set(sx * 0.1, 0.2, -0.04);
    h1.rotation.x = -0.55 - hornCurl * 0.3; h1.rotation.z = sx * (-0.18 - hornCurl * 0.35);
    h1.castShadow = true;
    const h2 = new THREE.Mesh(new THREE.ConeGeometry(0.033 * hornScale, 0.14 * hornScale, 8), hornMat);
    h2.position.set(sx * (0.13 + hornCurl * 0.05), 0.3, -0.11);
    h2.rotation.x = -1.0 - hornCurl * 0.4; h2.rotation.z = sx * (-0.25 - hornCurl * 0.45);
    h2.castShadow = true;
    headG.add(h1, h2);
  }
  // floppy ears (animatable) — length/droop vary per breed
  const ears = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.17, 0.1, -0.02);
    const ear = ball(0.09, 0, sx * 0.07, -0.03, 0, 1.45 * earLen, 0.55, 0.8, snoutMat);
    pivot.add(ear);
    pivot.rotation.z = sx * (0.5 + earDroop);
    ears.push(pivot);
    headG.add(pivot);
  }
  // beard
  const beard = ball(0.06, 0, 0, -0.15, 0.16, 0.8, 1.5, 0.8, snoutMat);
  headG.add(head, snout, nose, beard);

  // legs: pivots at hip so they swing during the hop
  const legs = [];
  for (const [lx, lz] of [[-0.16, 0.26], [0.16, 0.26], [-0.16, -0.26], [0.16, -0.26]]) {
    const pivot = new THREE.Group();
    pivot.position.set(lx, 0.34, lz);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.048, 0.3, 8), snoutMat);
    leg.position.y = -0.15;
    leg.castShadow = true;
    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.07, 8), mat(0x3d332c));
    hoof.position.y = -0.3;
    hoof.castShadow = true;
    pivot.add(leg, hoof);
    legs.push(pivot);
    g.add(pivot);
  }
  // tail: perky pivot
  const tailG = new THREE.Group();
  tailG.position.set(0, 0.62, -0.42);
  const tail = ball(0.085 * tailFluff, 0, 0, 0.04, -0.02, 0.8, 1.1, 0.8, furMat);
  tailG.add(tail);
  tailG.rotation.x = 0.6;

  g.add(body, rump, headG, tailG);
  g.userData.legs = legs;
  g.userData.head = headG;
  g.userData.tail = tailG;
  g.userData.ears = ears;
  g.userData.eyes = eyes;
  return g;
}

// ---------- TREE ----------
export function makeTree(size = 1, pool = null) {
  const names = pool && pool.length ? pool : TREE_MODELS;
  const name = names[Math.floor(Math.random() * names.length)];
  const glb = cloneLib(name);
  if (glb) {
    const s = 0.85 + size * 0.25 + Math.random() * 0.15;
    glb.scale.setScalar(s);
    glb.rotation.y = Math.random() * Math.PI * 2;
    glb.userData.model = name;
    return glb;
  }
  const g = new THREE.Group();
  const trunkH = 0.35 + size * 0.15;
  g.add(box(0.22, trunkH, 0.22, PALETTE.treeTrunk, 0, trunkH / 2, 0));
  const leaf = PALETTE.treeLeaf[Math.floor(Math.random() * PALETTE.treeLeaf.length)];
  const l1 = 0.72 - size * 0.06;
  g.add(box(l1, 0.5, l1, leaf, 0, trunkH + 0.25, 0));
  g.add(box(l1 * 0.72, 0.4, l1 * 0.72, leaf, 0, trunkH + 0.68, 0));
  if (size > 1) g.add(box(l1 * 0.45, 0.3, l1 * 0.45, leaf, 0, trunkH + 1.0, 0));
  return g;
}

// ---------- ROCK ----------
export function makeRock() {
  const name = ROCK_MODELS[Math.floor(Math.random() * ROCK_MODELS.length)];
  const glb = cloneLib(name);
  if (glb) { glb.rotation.y = Math.random() * Math.PI * 2; return glb; }
  const g = new THREE.Group();
  g.add(box(0.5, 0.3, 0.45, 0x9a9aa8, 0, 0.15, 0));
  g.add(box(0.3, 0.2, 0.28, 0xacacba, 0.1, 0.35, 0.05));
  return g;
}

// ---------- CAR ----------
export function makeCar(dir) {
  const name = CAR_MODELS[Math.floor(Math.random() * CAR_MODELS.length)];
  const glb = cloneLib(name);
  if (glb) {
    glb.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;   // Kenney cars face +Z
    glb.userData.halfLen = 0.95;
    glb.userData.hitLen = 0.74;    // real body extent: no ghost-tail kills
    return glb;
  }
  const g = new THREE.Group();
  const color = PALETTE.carColors[Math.floor(Math.random() * PALETTE.carColors.length)];
  g.add(box(1.5, 0.36, 0.72, color, 0, 0.36, 0));
  g.add(box(0.8, 0.3, 0.62, 0xd7ecf5, -0.08, 0.68, 0));
  for (const [wx, wz] of [[-0.48, 0.34], [0.48, 0.34], [-0.48, -0.34], [0.48, -0.34]]) {
    g.add(box(0.26, 0.26, 0.12, 0x2e2e38, wx, 0.16, wz));
  }
  const hx = dir > 0 ? 0.76 : -0.76;
  g.add(box(0.04, 0.1, 0.12, 0xfff6b0, hx, 0.38, 0.22, false));
  g.add(box(0.04, 0.1, 0.12, 0xfff6b0, hx, 0.38, -0.22, false));
  if (dir < 0) g.rotation.y = Math.PI;
  g.userData.halfLen = 0.85;
  g.userData.hitLen = 0.72;
  return g;
}

// ---------- TRUCK ----------
export function makeTruck(dir) {
  const name = TRUCK_MODELS[Math.floor(Math.random() * TRUCK_MODELS.length)];
  const glb = cloneLib(name);
  if (glb) {
    glb.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    glb.userData.halfLen = 1.1;
    glb.userData.hitLen = 0.92;
    return glb;
  }
  const g = new THREE.Group();
  const color = PALETTE.truckColors[Math.floor(Math.random() * PALETTE.truckColors.length)];
  g.add(box(0.7, 0.55, 0.78, color, 0.75, 0.5, 0));            // cab
  g.add(box(1.5, 0.75, 0.82, 0xe8e8ee, -0.45, 0.62, 0));       // cargo
  for (const [wx, wz] of [[0.75, 0.36], [-0.1, 0.36], [-0.85, 0.36], [0.75, -0.36], [-0.1, -0.36], [-0.85, -0.36]]) {
    g.add(box(0.28, 0.28, 0.12, 0x2e2e38, wx, 0.16, wz));
  }
  if (dir < 0) g.rotation.y = Math.PI;
  g.userData.halfLen = 1.15;
  g.userData.hitLen = 0.98;
  return g;
}

// ---------- LOG: real cylinder with bark + growth-ring ends ----------
let logMats = null;
export function makeLog(tiles) {
  if (!logMats) {
    logMats = {
      bark: new THREE.MeshLambertMaterial({ color: 0xffffff, map: barkTexture(PALETTE.log) }),
      end: new THREE.MeshLambertMaterial({ color: 0xffffff, map: logEndTexture(PALETTE.log) }),
    };
  }
  const g = new THREE.Group();
  const len = tiles * 1.0 - 0.15;
  const R = 0.26;
  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, len, 12, 1, false),
    [logMats.bark, logMats.end, logMats.end]
  );
  cyl.rotation.z = Math.PI / 2;         // axis along X
  cyl.position.y = R * 0.55;            // partly submerged
  cyl.castShadow = true;
  cyl.receiveShadow = true;
  g.add(cyl);
  // a couple of branch stubs for character
  const stubs = Math.random() < 0.6 ? 1 : 2;
  for (let i = 0; i < stubs; i++) {
    const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.16, 6), logMats.bark);
    stub.position.set((Math.random() - 0.5) * len * 0.7, R + 0.05, (Math.random() - 0.5) * 0.2);
    stub.rotation.z = (Math.random() - 0.5) * 0.8;
    stub.castShadow = true;
    g.add(stub);
  }
  g.userData.halfLen = len / 2;
  g.userData.topY = R * 0.55 + R;       // surface height the goat stands on
  return g;
}

// ---------- TRAIN ----------
export function makeTrain(cars = 4) {
  const g = new THREE.Group();
  const segLen = 2.2, gap = 0.15;
  // locomotive
  const loco = new THREE.Group();
  loco.add(box(segLen, 0.85, 0.85, PALETTE.train, 0, 0.6, 0));
  loco.add(box(0.5, 0.4, 0.7, 0x8a2318, segLen / 2 - 0.35, 1.2, 0));
  loco.add(box(0.25, 0.3, 0.25, 0x3a3a3a, segLen / 2 - 0.9, 1.25, 0));
  // headlight
  const lamp = box(0.08, 0.14, 0.14, 0xfff2b8, segLen / 2 + 0.01, 0.6, 0, false);
  loco.add(lamp);
  g.add(loco);
  for (let i = 1; i <= cars; i++) {
    const car = box(segLen, 0.8, 0.8, PALETTE.trainCar, -i * (segLen + gap), 0.55, 0);
    g.add(car);
    // windows strip
    const win = box(segLen * 0.8, 0.22, 0.82, 0xbdd8e8, -i * (segLen + gap), 0.72, 0, false);
    g.add(win);
  }
  g.userData.halfLen = ((cars + 1) * (segLen + gap)) / 2;
  g.userData.totalLen = (cars + 1) * (segLen + gap);
  return g;
}

// ---------- COIN ----------
export function makeCoin() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.07, 16),
    new THREE.MeshLambertMaterial({ color: PALETTE.coin, emissive: 0x8a6d00 })
  );
  m.rotation.z = Math.PI / 2;
  m.castShadow = true;
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.03, 8, 20),
    new THREE.MeshLambertMaterial({ color: 0xffe680, emissive: 0xa88400 })
  );
  rim.rotation.y = Math.PI / 2;
  g.add(m, rim);
  return g;
}

// ---------- EAGLE ----------
export function makeEagle() {
  const g = new THREE.Group();
  g.add(ball(0.3, PALETTE.eagle, 0, 0, 0, 0.9, 0.65, 1.6));
  g.add(ball(0.17, 0xe8e4da, 0, 0.1, 0.5));               // white head
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 8), mat(0xf2a65a));
  beak.position.set(0, 0.07, 0.72);
  beak.rotation.x = Math.PI / 2;
  g.add(beak);
  // tail feathers
  g.add(ball(0.12, 0xe8e4da, 0, 0.02, -0.5, 1.2, 0.4, 1.6));
  const wingL = box(1.1, 0.07, 0.5, PALETTE.eagle, -0.8, 0.08, -0.05);
  const wingR = box(1.1, 0.07, 0.5, PALETTE.eagle, 0.8, 0.08, -0.05);
  const tipL = box(0.4, 0.06, 0.42, 0x4a3826, -1.5, 0.08, -0.05);
  const tipR = box(0.4, 0.06, 0.42, 0x4a3826, 1.5, 0.08, -0.05);
  g.add(wingL, wingR, tipL, tipR);
  g.userData.wings = [wingL, wingR];
  return g;
}

// ---------- RAIL SIGNAL ----------
export function makeSignal() {
  const g = new THREE.Group();
  g.add(box(0.1, 1.1, 0.1, 0x555560, 0, 0.55, 0));
  g.add(box(0.34, 0.34, 0.1, 0x333340, 0, 1.15, 0));
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 8, 8),
    new THREE.MeshLambertMaterial({ color: 0x550000, emissive: 0x000000 })
  );
  light.position.set(0, 1.15, 0.07);
  g.add(light);
  g.userData.light = light;
  return g;
}

// ---------- WATER LILY (river deco, non-landable) ----------
export function makeLily() {
  const g = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.CircleGeometry(0.24, 10, 0.5, Math.PI * 1.75), mat(0x4d8f3f));
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.01;
  g.add(pad);
  if (Math.random() < 0.5) {
    const fl = ball(0.07, 0xf0a0c0, 0.05, 0.05, 0.05, 1, 0.7, 1);
    fl.castShadow = false;
    g.add(fl);
  }
  return g;
}

// ---------- POWER-UPS ----------
export function makePowerup(kind) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.TorusGeometry(0.26, 0.045, 8, 20),
    new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x555555 })
  );
  base.rotation.x = Math.PI / 2;
  g.add(base);
  if (kind === 'shield') {
    base.material.emissive.setHex(0x113366);
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 12, 10),
      new THREE.MeshLambertMaterial({ color: 0x5b7ede, emissive: 0x223a88, transparent: true, opacity: 0.85 })
    );
    g.add(s);
  } else if (kind === 'magnet') {
    base.material.emissive.setHex(0x661111);
    const m1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.1), mat(0xd95763));
    const m2 = m1.clone(); m2.position.x = 0.16;
    m1.position.x = -0.16;
    const arc = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.1), mat(0xd95763));
    arc.position.y = 0.18;
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.1), mat(0xe8e8ee));
    t1.position.set(-0.16, -0.16, 0);
    const t2 = t1.clone(); t2.position.x = 0.16;
    g.add(m1, m2, arc, t1, t2);
  } else {  // speed
    base.material.emissive.setHex(0x665500);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.36, 10), mat(0xffd23f));
    cone.position.y = 0.1;
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 8), new THREE.MeshLambertMaterial({ color: 0xffe066, emissive: 0x886600 }));
    fl.position.y = -0.12; fl.rotation.x = Math.PI;
    g.add(cone, fl);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------- CLOUD (drifting sky deco) ----------
let cloudMat = null;
export function makeCloud() {
  if (!cloudMat) cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const g = new THREE.Group();
  const n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const r = 0.5 + Math.random() * 0.7;
    const p = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), cloudMat);
    p.position.set(i * 0.8 - n * 0.4, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.6);
    p.scale.y = 0.55;
    p.castShadow = false;
    g.add(p);
  }
  return g;
}
