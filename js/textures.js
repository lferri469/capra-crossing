// Procedural canvas textures — no external files, instant load, biome-tintable.
import * as THREE from 'three';

const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function toTexture(c, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

function shade(colorHex, f) {
  // f > 0 lighten, f < 0 darken
  const r = (colorHex >> 16) & 255, g = (colorHex >> 8) & 255, b = colorHex & 255;
  const adj = (v) => Math.max(0, Math.min(255, Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f))));
  return `rgb(${adj(r)},${adj(g)},${adj(b)})`;
}

// ---------- GRASS: mottled base + blade strokes + tiny flowers ----------
export function grassTexture(colorHex, withFlowers = true) {
  const key = `grass_${colorHex}_${withFlowers}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(256, 128);
  const x = c.getContext('2d');
  x.fillStyle = hex(colorHex);
  x.fillRect(0, 0, 256, 128);
  // mottling
  for (let i = 0; i < 900; i++) {
    x.fillStyle = shade(colorHex, (Math.random() - 0.52) * 0.22);
    const s = 2 + Math.random() * 5;
    x.fillRect(Math.random() * 256, Math.random() * 128, s, s * 0.6);
  }
  // grass blades
  x.lineWidth = 1;
  for (let i = 0; i < 260; i++) {
    const gx = Math.random() * 256, gy = Math.random() * 128;
    const len = 3 + Math.random() * 5;
    x.strokeStyle = shade(colorHex, Math.random() < 0.5 ? 0.18 : -0.2);
    x.beginPath();
    x.moveTo(gx, gy);
    x.lineTo(gx + (Math.random() - 0.5) * 3, gy - len);
    x.stroke();
  }
  // tiny flowers
  if (withFlowers) {
    const fl = ['#ffffff', '#ffe066', '#ff9ecb'];
    for (let i = 0; i < 14; i++) {
      x.fillStyle = fl[Math.floor(Math.random() * fl.length)];
      const fx = Math.random() * 256, fy = Math.random() * 128;
      x.fillRect(fx, fy, 2.4, 2.4);
      x.fillStyle = 'rgba(255,200,0,.9)';
      x.fillRect(fx + 0.7, fy + 0.7, 1, 1);
    }
  }
  const t = toTexture(c, 8, 1);
  cache.set(key, t);
  return t;
}

// ---------- ROAD: asphalt grain + wear tracks + cracks ----------
export function roadTexture(colorHex) {
  const key = `road_${colorHex}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(256, 128);
  const x = c.getContext('2d');
  x.fillStyle = hex(colorHex);
  x.fillRect(0, 0, 256, 128);
  // asphalt grain
  for (let i = 0; i < 2600; i++) {
    x.fillStyle = shade(colorHex, (Math.random() - 0.5) * 0.3);
    x.fillRect(Math.random() * 256, Math.random() * 128, 1.4, 1.4);
  }
  // darker wheel-wear bands (vehicles run along X)
  x.fillStyle = 'rgba(0,0,0,0.13)';
  x.fillRect(0, 28, 256, 18);
  x.fillRect(0, 82, 256, 18);
  // cracks
  x.strokeStyle = 'rgba(0,0,0,0.25)';
  x.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    let cx = Math.random() * 256, cy = Math.random() * 128;
    x.beginPath(); x.moveTo(cx, cy);
    for (let j = 0; j < 5; j++) {
      cx += (Math.random() - 0.5) * 22; cy += (Math.random() - 0.5) * 14;
      x.lineTo(cx, cy);
    }
    x.stroke();
  }
  // faded edge lines
  x.fillStyle = 'rgba(255,255,255,0.28)';
  x.fillRect(0, 4, 256, 3);
  x.fillRect(0, 121, 256, 3);
  const t = toTexture(c, 8, 1);
  cache.set(key, t);
  return t;
}

// ---------- RAIL BED: gravel ballast ----------
export function railTexture(colorHex) {
  const key = `rail_${colorHex}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(256, 128);
  const x = c.getContext('2d');
  x.fillStyle = hex(colorHex);
  x.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 1500; i++) {
    x.fillStyle = shade(colorHex, (Math.random() - 0.45) * 0.5);
    const s = 2 + Math.random() * 4;
    x.save();
    x.translate(Math.random() * 256, Math.random() * 128);
    x.rotate(Math.random() * Math.PI);
    x.fillRect(-s / 2, -s / 4, s, s / 2);
    x.restore();
  }
  const t = toTexture(c, 8, 1);
  cache.set(key, t);
  return t;
}

// ---------- WATER: caustic ripple sheet (offset scrolled every frame) ----------
export function waterTexture(colorHex) {
  const key = `water_${colorHex}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(256, 128);
  const x = c.getContext('2d');
  const grad = x.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, shade(colorHex, 0.10));
  grad.addColorStop(0.5, hex(colorHex));
  grad.addColorStop(1, shade(colorHex, -0.12));
  x.fillStyle = grad;
  x.fillRect(0, 0, 256, 128);
  // caustic ripples: light arcs
  for (let i = 0; i < 60; i++) {
    const rx = Math.random() * 256, ry = Math.random() * 128;
    const rr = 6 + Math.random() * 16;
    x.strokeStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.1})`;
    x.lineWidth = 1.5 + Math.random() * 1.5;
    x.beginPath();
    x.arc(rx, ry, rr, Math.random() * Math.PI, Math.random() * Math.PI + 1.6);
    x.stroke();
  }
  // darker undulations
  for (let i = 0; i < 30; i++) {
    x.strokeStyle = `rgba(0,30,70,${0.05 + Math.random() * 0.08})`;
    x.lineWidth = 2 + Math.random() * 2;
    const wy = Math.random() * 128;
    x.beginPath();
    x.moveTo(0, wy);
    x.bezierCurveTo(64, wy + (Math.random() - 0.5) * 16, 192, wy + (Math.random() - 0.5) * 16, 256, wy);
    x.stroke();
  }
  const t = toTexture(c, 6, 1);
  cache.set(key, t);
  return t;
}

// ---------- BARK: log wrap (cylindrical) ----------
export function barkTexture(colorHex) {
  const key = `bark_${colorHex}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(256, 128);
  const x = c.getContext('2d');
  x.fillStyle = hex(colorHex);
  x.fillRect(0, 0, 256, 128);
  // long grain strokes along X
  for (let i = 0; i < 90; i++) {
    const gy = Math.random() * 128;
    x.strokeStyle = shade(colorHex, (Math.random() - 0.55) * 0.4);
    x.lineWidth = 1 + Math.random() * 2.5;
    x.beginPath();
    x.moveTo(0, gy);
    x.bezierCurveTo(85, gy + (Math.random() - 0.5) * 10, 170, gy + (Math.random() - 0.5) * 10, 256, gy + (Math.random() - 0.5) * 6);
    x.stroke();
  }
  // knots
  for (let i = 0; i < 4; i++) {
    const kx = Math.random() * 256, ky = Math.random() * 128;
    x.strokeStyle = shade(colorHex, -0.4);
    x.lineWidth = 2;
    for (let r = 3; r <= 9; r += 3) {
      x.beginPath(); x.ellipse(kx, ky, r * 1.6, r, 0, 0, Math.PI * 2); x.stroke();
    }
  }
  const t = toTexture(c, 2, 1);
  cache.set(key, t);
  return t;
}

// ---------- LOG END: growth rings ----------
export function logEndTexture(colorHex) {
  const key = `logend_${colorHex}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(64, 64);
  const x = c.getContext('2d');
  x.fillStyle = shade(colorHex, 0.25);
  x.fillRect(0, 0, 64, 64);
  x.strokeStyle = shade(colorHex, -0.25);
  x.lineWidth = 1.5;
  for (let r = 4; r <= 30; r += 4.5) {
    x.beginPath();
    x.arc(32 + (Math.random() - 0.5) * 3, 32 + (Math.random() - 0.5) * 3, r, 0, Math.PI * 2);
    x.stroke();
  }
  const t = toTexture(c);
  cache.set(key, t);
  return t;
}

// ---------- FUR: soft noise for the goat ----------
export function furTexture(colorHex) {
  const key = `fur_${colorHex}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(128, 128);
  const x = c.getContext('2d');
  x.fillStyle = hex(colorHex);
  x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1800; i++) {
    x.strokeStyle = shade(colorHex, (Math.random() - 0.45) * 0.14);
    x.lineWidth = 1;
    const fx = Math.random() * 128, fy = Math.random() * 128;
    x.beginPath();
    x.moveTo(fx, fy);
    x.lineTo(fx + (Math.random() - 0.5) * 2, fy + 2 + Math.random() * 3);
    x.stroke();
  }
  const t = toTexture(c, 2, 2);
  cache.set(key, t);
  return t;
}
