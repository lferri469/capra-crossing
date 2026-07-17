// Models: Kenney CC0 GLB (cars/trees/rocks) + procedural (goat/logs/train/eagle).
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

// ---------- GLB library ----------
const LIB = {};
const CAR_MODELS = ['sedan', 'sedan-sports', 'suv', 'taxi', 'police', 'hatchback-sports'];
const TRUCK_MODELS = ['truck', 'delivery', 'van', 'ambulance'];
const TREE_MODELS = ['tree_default', 'tree_oak', 'tree_fat', 'tree_pineDefaultA', 'tree_pineDefaultB', 'tree_cone', 'tree_detailed'];
const ROCK_MODELS = ['rock_largeA', 'rock_largeB', 'rock_tallA'];

function prepModel(scene, targetLen, axis = 'x') {
  const bbox = new THREE.Box3().setFromObject(scene);
  const size = bbox.getSize(new THREE.Vector3());
  let s = targetLen / (axis === 'x' ? size.x : Math.max(size.x, size.z));
  if (axis === 'x') {
    const depth = size.z * s;                 // vehicles must fit inside 1-tile lane depth
    if (depth > 0.92) s *= 0.92 / depth;
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

export const PALETTE = {
  grassA: 0xa8d878, grassB: 0x9ccc68,
  road: 0x4a4a58, roadLine: 0x6a6a78,
  water: 0x5db8e8,
  rail: 0x8a7860, railSleeper: 0x6b5844,
  goatBody: 0xf5f0e8, goatHorn: 0xd9a066,
  treeTrunk: 0x8a6642,
  treeLeaf: [0x5a9e4b, 0x6db05c, 0x4d8f3f],
  carColors: [0xd95763, 0x5b7ede, 0xf2a65a, 0x8fce5a, 0xb06ac9, 0xf5e04b],
  truckColors: [0x7a9cc6, 0xc67a7a],
  log: 0x9c7048,
  train: 0xc0392b, trainCar: 0x9b5445,
  coin: 0xffd700,
  eagle: 0x5a4632,
};

// ---------- GOAT SKINS ----------
export const SKINS = [
  { id: 'bianca', name: 'Rosetta', cost: 0, body: 0xf5f0e8, snout: 0xe8ded0, horn: 0xd9a066 },
  { id: 'nera', name: 'Nerina', cost: 20, body: 0x3a3a42, snout: 0x55555f, horn: 0xcccccc },
  { id: 'marrone', name: 'Ciocco', cost: 40, body: 0x8a5f3b, snout: 0xa87f57, horn: 0xf0e6d8 },
  { id: 'dorata', name: 'Aurelia', cost: 80, body: 0xe8c84a, snout: 0xf5e04b, horn: 0xffffff },
  { id: 'zombie', name: 'Zombina', cost: 150, body: 0x8aa86a, snout: 0xa8c88a, horn: 0x666655 },
];

// ---------- GOAT (player) ----------
export function makeGoat(skinId = 'bianca') {
  const skin = SKINS.find((s) => s.id === skinId) || SKINS[0];
  const g = new THREE.Group();
  const c = skin.body;

  const body = box(0.55, 0.42, 0.72, c, 0, 0.42, 0);
  const head = box(0.36, 0.34, 0.32, c, 0, 0.72, 0.38);
  const snout = box(0.22, 0.16, 0.14, skin.snout, 0, 0.64, 0.58);
  // horns
  const h1 = box(0.07, 0.2, 0.07, skin.horn, -0.11, 0.96, 0.3);
  const h2 = box(0.07, 0.2, 0.07, skin.horn, 0.11, 0.96, 0.3);
  h1.rotation.x = -0.4; h2.rotation.x = -0.4;
  // ears
  const e1 = box(0.16, 0.08, 0.1, skin.snout, -0.24, 0.8, 0.34);
  const e2 = box(0.16, 0.08, 0.1, skin.snout, 0.24, 0.8, 0.34);
  // eyes
  const eyeL = box(0.05, 0.07, 0.03, 0x2a2a2a, -0.11, 0.76, 0.545, false);
  const eyeR = box(0.05, 0.07, 0.03, 0x2a2a2a, 0.11, 0.76, 0.545, false);
  // legs
  const legs = [];
  for (const [lx, lz] of [[-0.18, 0.24], [0.18, 0.24], [-0.18, -0.24], [0.18, -0.24]]) {
    const leg = box(0.13, 0.24, 0.13, skin.snout, lx, 0.12, lz);
    legs.push(leg);
    g.add(leg);
  }
  // tail
  const tail = box(0.1, 0.12, 0.08, c, 0, 0.55, -0.4);
  tail.rotation.x = 0.5;
  // beard
  const beard = box(0.1, 0.12, 0.06, skin.snout, 0, 0.5, 0.52);

  g.add(body, head, snout, h1, h2, e1, e2, eyeL, eyeR, tail, beard);
  g.userData.legs = legs;
  return g;
}

// ---------- TREE ----------
export function makeTree(size = 1) {
  const name = TREE_MODELS[Math.floor(Math.random() * TREE_MODELS.length)];
  const glb = cloneLib(name);
  if (glb) {
    const s = 0.85 + size * 0.25 + Math.random() * 0.15;
    glb.scale.setScalar(s);
    glb.rotation.y = Math.random() * Math.PI * 2;
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
  return g;
}

// ---------- TRUCK ----------
export function makeTruck(dir) {
  const name = TRUCK_MODELS[Math.floor(Math.random() * TRUCK_MODELS.length)];
  const glb = cloneLib(name);
  if (glb) {
    glb.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    glb.userData.halfLen = 1.1;
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
  return g;
}

// ---------- LOG ----------
export function makeLog(tiles) {
  const g = new THREE.Group();
  const len = tiles * 1.0 - 0.15;
  const main = box(len, 0.3, 0.66, PALETTE.log, 0, 0.02, 0);
  g.add(main);
  // bark rings at ends
  g.add(box(0.08, 0.34, 0.7, 0x7a5636, -len / 2 + 0.06, 0.02, 0));
  g.add(box(0.08, 0.34, 0.7, 0x7a5636, len / 2 - 0.06, 0.02, 0));
  g.userData.halfLen = len / 2;
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
  g.add(loco);
  for (let i = 1; i <= cars; i++) {
    const car = box(segLen, 0.8, 0.8, PALETTE.trainCar, -i * (segLen + gap), 0.55, 0);
    g.add(car);
  }
  g.userData.halfLen = ((cars + 1) * (segLen + gap)) / 2;
  g.userData.totalLen = (cars + 1) * (segLen + gap);
  return g;
}

// ---------- COIN ----------
export function makeCoin() {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.07, 12),
    new THREE.MeshLambertMaterial({ color: PALETTE.coin, emissive: 0x8a6d00 })
  );
  m.rotation.z = Math.PI / 2;
  m.castShadow = true;
  return m;
}

// ---------- EAGLE ----------
export function makeEagle() {
  const g = new THREE.Group();
  g.add(box(0.5, 0.3, 0.9, PALETTE.eagle, 0, 0, 0));
  g.add(box(0.34, 0.26, 0.3, 0xe8e4da, 0, 0.1, 0.55));   // white head
  g.add(box(0.14, 0.1, 0.16, 0xf2a65a, 0, 0.06, 0.76));  // beak
  const wingL = box(1.1, 0.08, 0.5, PALETTE.eagle, -0.8, 0.08, -0.05);
  const wingR = box(1.1, 0.08, 0.5, PALETTE.eagle, 0.8, 0.08, -0.05);
  g.add(wingL, wingR);
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
  g.add(box(0.4, 0.05, 0.4, 0x4d8f3f, 0, 0, 0, false));
  g.add(box(0.12, 0.08, 0.12, 0xf0a0c0, 0.08, 0.05, 0.08, false));
  return g;
}
