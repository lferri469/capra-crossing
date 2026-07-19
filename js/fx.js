// FX: pooled particles, floating HUD text, fullscreen post pass (vignette/grade/aberration), camera shake.
import * as THREE from 'three';

// ================= PARTICLES =================
const POOL_SIZE = 220;

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.geoBox = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < POOL_SIZE; i++) {
      const m = new THREE.Mesh(this.geoBox, new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true }));
      m.visible = false;
      m.castShadow = false;
      scene.add(m);
      this.pool.push({ mesh: m, life: 0, ttl: 1, vel: new THREE.Vector3(), spin: new THREE.Vector3(), grav: 0, size: 0.1, shrink: true });
    }
    this.cursor = 0;
  }

  spawn({ pos, color, count = 8, speed = 1.6, up = 2.2, grav = 6, size = 0.09, ttl = 0.6, spread = 1, shrink = true, flat = false }) {
    for (let i = 0; i < count; i++) {
      const p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % POOL_SIZE;
      const m = p.mesh;
      m.visible = true;
      m.position.copy(pos);
      m.position.x += (Math.random() - 0.5) * 0.3 * spread;
      m.position.z += (Math.random() - 0.5) * 0.3 * spread;
      const s = size * (0.6 + Math.random() * 0.8);
      m.scale.setScalar(s);
      if (flat) m.scale.y = s * 0.3;
      m.material.color.setHex(Array.isArray(color) ? color[Math.floor(Math.random() * color.length)] : color);
      m.material.opacity = 1;
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random() * 0.9);
      p.vel.set(Math.cos(a) * sp * spread, up * (0.5 + Math.random() * 0.8), Math.sin(a) * sp * spread);
      p.spin.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
      p.grav = grav;
      p.life = 0;
      p.ttl = ttl * (0.7 + Math.random() * 0.6);
      p.size = s;
      p.shrink = shrink;
    }
  }

  dust(pos, color = 0xd8cfb8) {
    this.spawn({ pos, color, count: 6, speed: 0.9, up: 1.1, grav: 4, size: 0.08, ttl: 0.45 });
  }
  splash(pos) {
    this.spawn({ pos, color: [0x7cc4ec, 0xa8dcf5, 0xffffff], count: 16, speed: 1.6, up: 3.2, grav: 9, size: 0.09, ttl: 0.7 });
  }
  ripple(pos) {
    this.spawn({ pos, color: 0xcfeafa, count: 4, speed: 1.4, up: 0.2, grav: 0.5, size: 0.07, ttl: 0.5, flat: true });
  }
  crash(pos) {
    this.spawn({ pos, color: [0xffffff, 0xffe066, 0xd95763], count: 18, speed: 2.6, up: 3.4, grav: 8, size: 0.1, ttl: 0.8 });
  }
  confetti(pos) {
    this.spawn({ pos, color: [0xff6b6b, 0xffe066, 0x7bed9f, 0x70a1ff, 0xff9ecb, 0xffffff], count: 26, speed: 2.2, up: 4.2, grav: 5, size: 0.09, ttl: 1.3, spread: 2, shrink: false });
  }
  coin(pos) {
    this.spawn({ pos, color: [0xffd700, 0xfff2a8], count: 10, speed: 1.4, up: 2.6, grav: 6, size: 0.07, ttl: 0.55 });
  }
  leaves(pos, color = 0x5a9e4b) {
    this.spawn({ pos, color: [color, 0x6db05c], count: 8, speed: 1.2, up: 1.8, grav: 3, size: 0.08, ttl: 0.7 });
  }
  feathers(pos) {
    this.spawn({ pos, color: [0x5a4632, 0xe8e4da], count: 12, speed: 1.5, up: 1.4, grav: 1.6, size: 0.09, ttl: 1.1, flat: true });
  }

  update(dt) {
    for (const p of this.pool) {
      if (!p.mesh.visible) continue;
      p.life += dt;
      if (p.life >= p.ttl) { p.mesh.visible = false; continue; }
      p.vel.y -= p.grav * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.y < 0.02 && p.vel.y < 0) {
        p.mesh.position.y = 0.02;
        p.vel.y *= -0.3;
        p.vel.x *= 0.7; p.vel.z *= 0.7;
      }
      p.mesh.rotation.x += p.spin.x * dt;
      p.mesh.rotation.y += p.spin.y * dt;
      p.mesh.rotation.z += p.spin.z * dt;
      const k = 1 - p.life / p.ttl;
      p.mesh.material.opacity = Math.min(1, k * 2.5);
      if (p.shrink) p.mesh.scale.setScalar(Math.max(0.01, p.size * (0.4 + k * 0.6)));
    }
  }
}

// ================= FLOATING TEXT (HTML overlay, projected) =================
export class FloatingText {
  constructor(container, camera) {
    this.container = container;
    this.camera = camera;
    this.items = [];
    this._v = new THREE.Vector3();
  }

  show(worldPos, text, cls = '') {
    const el = document.createElement('div');
    el.className = `float-text ${cls}`;
    el.textContent = text;
    this.container.appendChild(el);
    this.items.push({ el, pos: worldPos.clone(), life: 0, ttl: 1.1 });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life += dt;
      if (it.life >= it.ttl) {
        it.el.remove();
        this.items.splice(i, 1);
        continue;
      }
      it.pos.y += dt * 0.9;
      this._v.copy(it.pos).project(this.camera);
      const x = (this._v.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-this._v.y * 0.5 + 0.5) * window.innerHeight;
      const k = it.life / it.ttl;
      it.el.style.transform = `translate(${x}px, ${y}px) translate(-50%,-50%) scale(${1 + Math.min(k * 3, 0.35)})`;
      it.el.style.opacity = k > 0.65 ? String(1 - (k - 0.65) / 0.35) : '1';
    }
  }
}

// ================= POST PASS (vignette + grade + chromatic aberration + flash) =================
export class PostFX {
  constructor(renderer) {
    this.renderer = renderer;
    this.enabled = true;
    this.target = new THREE.WebGLRenderTarget(1, 1, { samples: 4 });
    this.aberration = 0;   // spikes on death / near-miss
    this.flash = 0;        // white flash
    this.darken = 0;       // death dim
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uAberr: { value: 0 },
        uFlash: { value: 0 },
        uDark: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uAberr;
        uniform float uFlash;
        uniform float uDark;
        varying vec2 vUv;
        void main() {
          vec2 d = vUv - 0.5;
          float r2 = dot(d, d);
          vec2 off = d * uAberr * r2 * 2.0;
          vec3 col;
          col.r = texture2D(tDiffuse, vUv + off).r;
          col.g = texture2D(tDiffuse, vUv).g;
          col.b = texture2D(tDiffuse, vUv - off).b;
          // linear render target -> sRGB output
          col = pow(max(col, 0.0), vec3(0.4545));
          // gentle saturation + warmth
          float l = dot(col, vec3(0.299, 0.587, 0.114));
          col = mix(vec3(l), col, 1.13);
          col *= vec3(1.02, 1.005, 0.985);
          // vignette
          float vig = smoothstep(0.85, 0.28, r2);
          col *= mix(0.72, 1.0, vig);
          // flash & darken
          col = mix(col, vec3(1.0), clamp(uFlash, 0.0, 1.0));
          col *= 1.0 - clamp(uDark, 0.0, 0.6);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
    this.setSize(window.innerWidth, window.innerHeight);
  }

  setSize(w, h) {
    const pr = this.renderer.getPixelRatio();
    this.target.setSize(Math.floor(w * pr), Math.floor(h * pr));
  }

  render(scene, camera, dt) {
    this.aberration = Math.max(0, this.aberration - dt * 2.2);
    this.flash = Math.max(0, this.flash - dt * 3.5);
    this.material.uniforms.uAberr.value = this.aberration * 0.02;
    this.material.uniforms.uFlash.value = this.flash;
    this.material.uniforms.uDark.value = this.darken;
    if (!this.enabled) {
      this.renderer.setRenderTarget(null);
      this.renderer.render(scene, camera);
      return;
    }
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.material.uniforms.tDiffuse.value = this.target.texture;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }
}

// ================= CAMERA SHAKE =================
export class Shake {
  constructor() { this.trauma = 0; this.t = 0; }
  add(amount) { this.trauma = Math.min(1, this.trauma + amount); }
  update(dt) {
    this.t += dt * 30;
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    const s = this.trauma * this.trauma;
    return {
      x: Math.sin(this.t * 1.9) * 0.35 * s,
      y: Math.cos(this.t * 2.7) * 0.25 * s,
      rot: Math.sin(this.t * 2.3) * 0.012 * s,
    };
  }
}
