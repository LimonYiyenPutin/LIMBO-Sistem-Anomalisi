'use strict';

/* L.I.M.B.O. // yazılım tabanlı raycaster motoru. Tüm dokular ve sprite'lar kodla üretilir. */
const LimboEngine = (() => {
  const W = 480;
  const H = 270;
  const TEX = 64;
  const FOV = 0.72;

  let view, vctx;
  let vm, vmctx;
  let bloom, bctx;
  let image, data;
  let zbuf;
  let map = null;
  let mapW = 0;
  let mapH = 0;
  let theme = null;
  let level = null;
  let wallTex = [];
  let floorTex = null;
  let ceilTex = null;
  let hazardTex = null;
  let skyTex = null;
  let lightGrid = null;
  let glitchLine = null;
  let skyCols = null;
  let spriteCache = new Map();
  let lastTime = 0;
  let particles = [];
  let flicker = 1;
  let frameNo = 0;
  let flashEnabled = false;
  let flashStrength = 1;

  function init() {
    view = document.getElementById('view');
    vctx = view.getContext('2d', { alpha: false });
    vm = document.getElementById('viewmodel');
    vmctx = vm.getContext('2d', { alpha: true });
    image = vctx.createImageData(W, H);
    data = new Uint32Array(image.data.buffer);
    zbuf = new Float32Array(W);
    glitchLine = new Uint32Array(W);
    skyCols = new Int32Array(W);
    bloom = document.createElement('canvas');
    bloom.width = 240;
    bloom.height = 135;
    bloom.id = 'bloom';
    bctx = bloom.getContext('2d');
    const renderLayer = document.getElementById('render-layer');
    if (renderLayer) renderLayer.appendChild(bloom);
    vctx.imageSmoothingEnabled = false;
    vmctx.imageSmoothingEnabled = false;
    lastTime = performance.now();
  }

  // ---------------------------------------------------------------- utilities
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hexRgb(hex) {
    const h = String(hex || '#ffffff').replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbStr(c, alpha) {
    return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha == null ? 1 : alpha})`;
  }

  function mix(a, b, t) {
    const A = hexRgb(a);
    const B = hexRgb(b);
    return rgbStr([
      A[0] + (B[0] - A[0]) * t,
      A[1] + (B[1] - A[1]) * t,
      A[2] + (B[2] - A[2]) * t,
    ], 1);
  }

  function shade(hex, factor) {
    const c = hexRgb(hex);
    return rgbStr([
      Math.max(0, Math.min(255, c[0] * factor)),
      Math.max(0, Math.min(255, c[1] * factor)),
      Math.max(0, Math.min(255, c[2] * factor)),
    ], 1);
  }

  function rgba(hex, alpha) {
    const c = hexRgb(hex);
    return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
  }

  function canvas2d(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    return { c, x };
  }

  function textureFromCanvas(c) {
    const src = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const arr = new Uint32Array(c.width * c.height);
    for (let i = 0; i < arr.length; i++) {
      arr[i] = ((src[i * 4 + 3] << 24) | (src[i * 4 + 2] << 16) | (src[i * 4 + 1] << 8) | src[i * 4]) >>> 0;
    }
    return { data: arr, w: c.width, h: c.height };
  }

  function grain(ctx, w, h, rng, amount, dark, light) {
    for (let i = 0; i < amount; i++) {
      const x = Math.floor(rng() * w);
      const y = Math.floor(rng() * h);
      const s = rng() < 0.82 ? 1 : 2;
      ctx.fillStyle = rng() < 0.55 ? rgba(dark, 0.08 + rng() * 0.2) : rgba(light, 0.04 + rng() * 0.12);
      ctx.fillRect(x, y, s, s);
    }
  }

  function stains(ctx, w, h, rng, color, count) {
    for (let i = 0; i < count; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const rw = 4 + rng() * 19;
      const rh = 3 + rng() * 25;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rw, rh));
      grad.addColorStop(0, rgba(color, 0.16 + rng() * 0.24));
      grad.addColorStop(0.65, rgba(color, 0.05));
      grad.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(x - rw, y - rh, rw * 2, rh * 2);
    }
  }

  function cracks(ctx, rng, color, count, w, h) {
    ctx.strokeStyle = rgba(color, 0.35);
    ctx.lineWidth = 1;
    for (let i = 0; i < count; i++) {
      let x = rng() * w;
      let y = rng() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      const steps = 3 + Math.floor(rng() * 5);
      for (let j = 0; j < steps; j++) {
        x += (rng() - 0.5) * 11;
        y += rng() * 7;
        ctx.lineTo(x, y);
        if (rng() < 0.3) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + (rng() - 0.5) * 10, y + rng() * 8);
          ctx.moveTo(x, y);
        }
      }
      ctx.stroke();
    }
  }

  function bolts(ctx, color, positions) {
    for (const [x, y] of positions) {
      ctx.fillStyle = rgba(color, 0.7);
      ctx.fillRect(x, y, 2, 2);
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.fillRect(x + 2, y + 1, 1, 1);
    }
  }

  function drawGlyphBlocks(ctx, x0, y0, cols, rows, color, rng, alpha) {
    ctx.fillStyle = rgba(color, alpha);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (rng() < 0.36) ctx.fillRect(x0 + x * 2, y0 + y * 2, 1, 2);
      }
    }
  }

  function addVignette(ctx, w, h) {
    const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.16, w / 2, h / 2, w * 0.72);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,.36)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // ---------------------------------------------------------------- wall textures
  function makeWallTexture(th, variant, seed) {
    const { c, x } = canvas2d(TEX, TEX);
    const rng = mulberry32(seed + variant * 191 + 17);
    const base = th.wall[0];
    const dark = th.wall[1];
    const light = th.wall[2];
    const accent = th.accent;
    const accent2 = th.accent2;
    const pattern = th.pattern;

    x.fillStyle = base;
    x.fillRect(0, 0, TEX, TEX);

    if (pattern === 'concrete') {
      x.fillStyle = shade(base, 0.82);
      x.fillRect(0, 31, TEX, 2);
      x.fillStyle = shade(base, 1.2);
      x.fillRect(0, 30, TEX, 1);
      x.fillStyle = rgba(dark, 0.55);
      x.fillRect(0, 0, 2, TEX);
      bolts(x, light, [[5, 5], [57, 5], [5, 57], [57, 57], [28, 5], [28, 57]]);
      stains(x, TEX, TEX, rng, dark, 4);
      cracks(x, rng, dark, 2 + variant, TEX, TEX);
      grain(x, TEX, TEX, rng, 260, dark, light);
      if (variant === 1) {
        x.fillStyle = rgba(dark, 0.9);
        x.fillRect(12, 12, 40, 40);
        x.fillStyle = rgba(light, 0.5);
        for (let i = 0; i < 7; i++) x.fillRect(14, 15 + i * 5, 36, 1);
        x.strokeStyle = rgba(light, 0.4);
        x.strokeRect(11.5, 11.5, 41, 41);
        bolts(x, light, [[14, 14], [48, 14], [14, 48], [48, 48]]);
      } else if (variant === 2) {
        x.fillStyle = rgba(accent2, 0.7);
        for (let i = -2; i < 9; i++) {
          x.save();
          x.translate(i * 10, 0);
          x.rotate(-0.5);
          x.fillRect(0, 46, 5, 24);
          x.restore();
        }
        x.fillStyle = rgba(dark, 0.5);
        x.fillRect(0, 44, TEX, 2);
        x.fillStyle = rgba(accent, 0.55);
        x.fillRect(6, 8, 24, 2);
        x.fillRect(6, 12, 14, 1);
      }
      if (variant === 0 && rng() < 0.7) {
        x.fillStyle = rgba(accent, 0.34);
        x.fillRect(44, 20, 3, 12);
      }
    } else if (pattern === 'office') {
      // vertical yellowed wallpaper
      for (let i = 0; i < TEX; i += 8) {
        x.fillStyle = rgba(i % 16 === 0 ? light : dark, 0.09);
        x.fillRect(i, 0, 4, TEX);
      }
      x.fillStyle = rgba(dark, 0.55);
      x.fillRect(0, 55, TEX, 9);
      x.fillStyle = rgba(light, 0.55);
      x.fillRect(0, 54, TEX, 1);
      x.fillStyle = rgba(light, 0.22);
      x.fillRect(0, 2, TEX, 2);
      stains(x, TEX, TEX, rng, dark, 5);
      stains(x, TEX, TEX, rng, accent, 2);
      grain(x, TEX, TEX, rng, 350, dark, light);
      if (variant === 1) {
        x.fillStyle = rgba(dark, 0.9);
        x.fillRect(14, 13, 36, 30);
        x.fillStyle = rgba(light, 0.45);
        for (let i = 0; i < 6; i++) x.fillRect(16, 16 + i * 4, 32, 1);
        x.strokeStyle = rgba(dark, 0.8);
        x.strokeRect(13.5, 12.5, 37, 31);
        bolts(x, light, [[16, 15], [46, 15], [16, 39], [46, 39]]);
      } else if (variant === 2) {
        x.fillStyle = rgba(dark, 0.68);
        x.fillRect(6, 8, 52, 42);
        x.strokeStyle = rgba(light, 0.5);
        x.strokeRect(6.5, 8.5, 51, 41);
        x.fillStyle = rgba(light, 0.6);
        x.fillRect(42, 28, 7, 2);
        x.fillStyle = rgba(accent, 0.22);
        x.fillRect(10, 12, 20, 1);
      }
      if (rng() < 0.55) {
        x.fillStyle = rgba(accent2, 0.16);
        x.fillRect(20 + rng() * 20, 38, 2 + rng() * 8, 1);
      }
    } else if (pattern === 'circuit') {
      x.fillStyle = shade(base, 0.8);
      x.fillRect(0, 0, TEX, TEX);
      x.strokeStyle = rgba(dark, 0.9);
      x.strokeRect(4.5, 4.5, 55, 55);
      x.strokeStyle = rgba(accent, 0.28);
      x.strokeRect(8.5, 8.5, 47, 47);
      for (let i = 0; i < 8; i++) {
        let px = 10 + Math.floor(rng() * 44);
        let py = 10 + Math.floor(rng() * 44);
        x.strokeStyle = rgba(rng() < 0.75 ? accent : accent2, 0.25 + rng() * 0.3);
        x.beginPath();
        x.moveTo(px, py);
        const horiz = rng() < 0.5;
        for (let j = 0; j < 3; j++) {
          if (j % 2 === 0) px += (rng() - 0.5) * 28;
          else py += (rng() - 0.5) * 28;
          x.lineTo(px, py);
        }
        x.stroke();
        x.fillStyle = rgba(accent, 0.5);
        x.fillRect(px - 1, py - 1, 2, 2);
      }
      if (variant === 1) {
        x.fillStyle = rgba(dark, 0.8);
        x.fillRect(10, 8, 44, 48);
        for (let i = 0; i < 6; i++) {
          x.fillStyle = rgba(dark, 0.9);
          x.fillRect(13, 12 + i * 7, 38, 4);
          x.fillStyle = rgba(i % 3 === 0 ? accent2 : accent, 0.7);
          x.fillRect(15, 13 + i * 7, 2, 2);
          x.fillStyle = rgba(light, 0.2);
          x.fillRect(18, 14 + i * 7, 28, 1);
        }
      } else if (variant === 2) {
        x.fillStyle = rgba(dark, 0.9);
        x.fillRect(5, 18, 54, 28);
        x.fillStyle = rgba(accent, 0.6);
        x.fillRect(8, 22, 28, 2);
        x.fillRect(8, 26, 42, 1);
        x.fillRect(8, 29, 22, 1);
        x.fillStyle = rgba(accent2, 0.75);
        x.fillRect(8, 35, 8, 2);
        drawGlyphBlocks(x, 40, 23, 6, 5, accent, rng, 0.4);
      }
      grain(x, TEX, TEX, rng, 120, dark, light);
    } else if (pattern === 'shadow') {
      const grad = x.createLinearGradient(0, 0, TEX, TEX);
      grad.addColorStop(0, base);
      grad.addColorStop(0.5, shade(base, 0.75));
      grad.addColorStop(1, dark);
      x.fillStyle = grad;
      x.fillRect(0, 0, TEX, TEX);
      for (let i = 0; i < 5; i++) {
        x.strokeStyle = rgba(accent, 0.08 + rng() * 0.16);
        x.lineWidth = 1 + (rng() < 0.25 ? 1 : 0);
        x.beginPath();
        let px = rng() * TEX;
        let py = 0;
        x.moveTo(px, py);
        while (py < TEX) {
          px += (rng() - 0.5) * 14;
          py += 5 + rng() * 7;
          x.lineTo(px, py);
        }
        x.stroke();
      }
      if (variant === 1) {
        x.strokeStyle = rgba(accent, 0.38);
        x.beginPath();
        x.ellipse(32, 32, 21, 12, 0, 0, Math.PI * 2);
        x.stroke();
        x.fillStyle = rgba(accent2, 0.5);
        x.fillRect(30, 31, 4, 2);
        x.fillStyle = rgba(dark, 0.9);
        x.fillRect(31, 28, 2, 8);
      } else if (variant === 2) {
        x.strokeStyle = rgba(accent, 0.22);
        for (let i = 0; i < 3; i++) {
          x.beginPath();
          x.arc(32, 32, 8 + i * 8, rng() * 1.5, rng() * 1.5 + 2.5);
          x.stroke();
        }
        drawGlyphBlocks(x, 24, 10, 8, 3, accent, rng, 0.35);
      }
      x.fillStyle = 'rgba(0,0,0,.28)';
      x.fillRect(0, 0, TEX, 4);
      x.fillRect(0, 60, TEX, 4);
      grain(x, TEX, TEX, rng, 200, dark, accent);
    } else if (pattern === 'tile') {
      x.fillStyle = base;
      x.fillRect(0, 0, TEX, TEX);
      x.strokeStyle = rgba(dark, 0.65);
      x.lineWidth = 1;
      for (let i = 0; i <= 64; i += 16) {
        x.beginPath(); x.moveTo(i + 0.5, 0); x.lineTo(i + 0.5, TEX); x.stroke();
        x.beginPath(); x.moveTo(0, i + 0.5); x.lineTo(TEX, i + 0.5); x.stroke();
      }
      x.strokeStyle = rgba(light, 0.35);
      x.beginPath(); x.moveTo(0, 64); x.lineTo(64, 64); x.stroke();
      stains(x, TEX, TEX, rng, dark, 3);
      stains(x, TEX, TEX, rng, accent2, 1);
      cracks(x, rng, dark, 2, TEX, TEX);
      grain(x, TEX, TEX, rng, 160, dark, light);
      if (variant === 1) {
        x.strokeStyle = rgba(dark, 0.55);
        x.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          x.beginPath();
          x.moveTo(32, 32);
          x.lineTo(8 + rng() * 48, rng() * 64);
          x.stroke();
        }
      } else if (variant === 2) {
        x.fillStyle = rgba(dark, 0.6);
        x.fillRect(8, 8, 48, 48);
        x.strokeStyle = rgba(light, 0.5);
        x.strokeRect(8.5, 8.5, 47, 47);
        x.fillStyle = rgba(accent2, 0.2);
        x.fillRect(12, 44, 22, 1);
      }
    } else if (pattern === 'void') {
      const grad = x.createRadialGradient(32, 32, 2, 32, 32, 46);
      grad.addColorStop(0, shade(base, 1.15));
      grad.addColorStop(0.6, base);
      grad.addColorStop(1, dark);
      x.fillStyle = grad;
      x.fillRect(0, 0, TEX, TEX);
      x.strokeStyle = rgba(accent, 0.14);
      for (let i = 0; i < 7; i++) {
        x.beginPath();
        x.moveTo(rng() * 64, rng() * 64);
        x.lineTo(rng() * 64, rng() * 64);
        x.stroke();
      }
      for (let i = 0; i < 26; i++) {
        x.fillStyle = rgba(rng() < 0.4 ? accent2 : light, 0.25 + rng() * 0.5);
        x.fillRect(rng() * 64, rng() * 64, 1, 1);
      }
      if (variant === 1) {
        x.strokeStyle = rgba(accent2, 0.28);
        x.beginPath(); x.arc(32, 32, 22, 0, Math.PI * 2); x.stroke();
        x.beginPath(); x.arc(32, 32, 14, 0, Math.PI * 2); x.stroke();
        x.fillStyle = rgba(accent, 0.16);
        x.fillRect(30, 20, 4, 24);
      } else if (variant === 2) {
        x.strokeStyle = rgba(accent, 0.35);
        x.strokeRect(12.5, 12.5, 39, 39);
        drawGlyphBlocks(x, 16, 16, 12, 8, accent, rng, 0.3);
      }
      addVignette(x, TEX, TEX);
    } else if (pattern === 'grave') {
      x.fillStyle = base;
      x.fillRect(0, 0, TEX, TEX);
      for (let ry = 0; ry < 4; ry++) {
        for (let rx = 0; rx < 2; rx++) {
          const ox = rx * 32 + (ry % 2) * 8;
          const oy = ry * 16;
          x.fillStyle = rgba(ry % 2 ? light : dark, 0.1);
          x.fillRect(ox + 2, oy + 2, 28, 12);
          x.strokeStyle = rgba(dark, 0.55);
          x.strokeRect(ox + 1.5, oy + 1.5, 29, 13);
        }
      }
      x.fillStyle = rgba(dark, 0.6);
      x.fillRect(22, 23, 20, 22);
      x.strokeStyle = rgba(light, 0.28);
      x.strokeRect(22.5, 23.5, 19, 21);
      x.fillStyle = rgba(light, 0.22);
      x.fillRect(28, 29, 8, 1);
      x.fillRect(28, 32, 6, 1);
      x.fillStyle = rgba(accent, 0.34);
      x.fillRect(30, 38, 4, 1);
      for (let i = 0; i < 22; i++) {
        x.fillStyle = rgba(accent, 0.06 + rng() * 0.15);
        x.fillRect(rng() * 64, 40 + rng() * 24, 1 + rng() * 3, 1);
      }
      stains(x, TEX, TEX, rng, dark, 4);
      cracks(x, rng, light, 2, TEX, TEX);
      grain(x, TEX, TEX, rng, 300, dark, light);
    } else if (pattern === 'corrupt') {
      x.fillStyle = base;
      x.fillRect(0, 0, TEX, TEX);
      for (let i = 0; i < 9; i++) {
        const y = rng() * 64;
        const h = 1 + rng() * 5;
        x.fillStyle = rgba(rng() < 0.5 ? accent2 : accent, 0.06 + rng() * 0.12);
        x.fillRect(0, y, TEX, h);
      }
      x.fillStyle = rgba(dark, 0.35);
      x.fillRect(0, 0, TEX, 4);
      x.fillRect(0, 58, TEX, 6);
      x.fillStyle = rgba(accent2, 0.25);
      x.fillRect(6 + rng() * 20, 16, 20, 1);
      x.fillRect(30, 40, 28, 1);
      drawGlyphBlocks(x, 6, 6, 22, 4, light, rng, 0.23);
      stains(x, TEX, TEX, rng, accent2, 3);
      cracks(x, rng, light, 2, TEX, TEX);
      grain(x, TEX, TEX, rng, 360, dark, light);
      if (variant === 1) {
        x.fillStyle = rgba(dark, 0.85);
        x.fillRect(8, 14, 48, 36);
        x.strokeStyle = rgba(accent2, 0.5);
        x.strokeRect(8.5, 14.5, 47, 35);
        x.fillStyle = rgba(accent2, 0.65);
        x.fillRect(12, 20, 20, 2);
        x.fillRect(12, 24, 34, 1);
        x.fillRect(12, 27, 26, 1);
        x.fillStyle = rgba(accent, 0.4);
        x.fillRect(12, 34, 10, 2);
      }
    } else if (pattern === 'code') {
      x.fillStyle = '#020604';
      x.fillRect(0, 0, TEX, TEX);
      x.strokeStyle = rgba(accent, 0.2);
      x.strokeRect(2.5, 2.5, 59, 59);
      for (let col = 0; col < 16; col++) {
        const cxx = 4 + col * 4;
        const bright = rng() < 0.2;
        x.fillStyle = rgba(bright ? accent : shade(accent, 0.45), 0.12 + rng() * 0.45);
        for (let i = 0; i < 12; i++) {
          if (rng() < 0.65) x.fillRect(cxx, 4 + Math.floor(rng() * 56), 2, 1);
        }
      }
      if (variant === 1) {
        x.fillStyle = rgba(dark, 0.75);
        x.fillRect(7, 8, 50, 48);
        for (let i = 0; i < 8; i++) {
          x.fillStyle = rgba(accent, 0.28 + rng() * 0.35);
          x.fillRect(10, 12 + i * 5, 5 + rng() * 38, 1);
        }
        x.fillStyle = rgba(accent, 0.7);
        x.fillRect(10, 50, 3, 2);
        x.fillStyle = rgba(accent2, 0.55);
        x.fillRect(49, 10, 3, 3);
      } else if (variant === 2) {
        x.fillStyle = rgba(dark, 0.85);
        x.fillRect(4, 22, 56, 20);
        x.fillStyle = rgba(accent, 0.65);
        x.fillRect(7, 26, 25, 2);
        x.fillRect(7, 30, 40, 1);
        x.fillRect(7, 33, 30, 1);
        x.fillRect(7, 36, 15, 1);
        drawGlyphBlocks(x, 42, 26, 8, 6, accent2, rng, 0.3);
      }
      grain(x, TEX, TEX, rng, 140, dark, accent);
    } else if (pattern === 'rust') {
      x.fillStyle = base;
      x.fillRect(0, 0, TEX, TEX);
      x.fillStyle = rgba(dark, 0.7);
      for (let i = 0; i < 4; i++) x.fillRect(0, i * 16, TEX, 1);
      for (let i = 0; i < 3; i++) x.fillRect(i * 21, 0, 1, TEX);
      bolts(x, light, [[4, 4], [58, 4], [4, 58], [58, 58], [30, 4], [4, 30]]);
      for (let i = 0; i < 7; i++) {
        x.fillStyle = rgba(rng() < 0.5 ? '#8c4a24' : '#5c2f18', 0.12 + rng() * 0.26);
        x.beginPath();
        x.ellipse(rng() * 64, rng() * 64, 4 + rng() * 14, 3 + rng() * 12, rng() * 3, 0, Math.PI * 2);
        x.fill();
      }
      stains(x, TEX, TEX, rng, '#b06a32', 4);
      cracks(x, rng, dark, 2, TEX, TEX);
      grain(x, TEX, TEX, rng, 300, dark, light);
      if (variant === 1) {
        x.save();
        x.beginPath();
        x.rect(0, 48, 64, 12);
        x.clip();
        x.fillStyle = rgba(accent, 0.8);
        x.fillRect(0, 48, 64, 12);
        x.fillStyle = 'rgba(0,0,0,.75)';
        for (let i = -2; i < 9; i++) {
          x.save();
          x.translate(i * 10, 48);
          x.rotate(-0.5);
          x.fillRect(0, 0, 5, 18);
          x.restore();
        }
        x.restore();
      } else if (variant === 2) {
        x.strokeStyle = rgba(accent, 0.36);
        x.beginPath(); x.arc(32, 30, 14, 0, Math.PI * 2); x.stroke();
        x.beginPath(); x.arc(32, 30, 7, 0, Math.PI * 2); x.stroke();
        x.fillStyle = rgba(accent, 0.45);
        x.fillRect(30, 22, 4, 16);
        x.fillRect(22, 29, 20, 2);
      }
      for (let i = 0; i < 8; i++) {
        x.fillStyle = rgba(accent, 0.15 + rng() * 0.3);
        x.fillRect(rng() * 64, rng() * 64, 1, 1);
      }
    } else if (pattern === 'mirror') {
      const grad = x.createLinearGradient(0, 0, 64, 64);
      grad.addColorStop(0, light);
      grad.addColorStop(0.35, base);
      grad.addColorStop(0.55, shade(base, 1.15));
      grad.addColorStop(1, dark);
      x.fillStyle = grad;
      x.fillRect(0, 0, TEX, TEX);
      x.fillStyle = rgba(light, 0.12);
      x.beginPath();
      x.moveTo(0, 20); x.lineTo(64, 4); x.lineTo(64, 12); x.lineTo(0, 30);
      x.closePath(); x.fill();
      x.fillStyle = rgba(dark, 0.22);
      x.fillRect(0, 31, 64, 2);
      x.fillRect(31, 0, 2, 64);
      cracks(x, rng, dark, 1 + variant, TEX, TEX);
      grain(x, TEX, TEX, rng, 120, dark, light);
      if (variant === 1) {
        x.strokeStyle = rgba(accent, 0.25);
        x.strokeRect(8.5, 8.5, 47, 47);
        x.fillStyle = rgba(dark, 0.18);
        x.fillRect(10, 10, 44, 16);
      } else if (variant === 2) {
        x.fillStyle = rgba(dark, 0.35);
        x.fillRect(16, 12, 32, 43);
        x.strokeStyle = rgba(light, 0.5);
        x.strokeRect(16.5, 12.5, 31, 42);
        x.fillStyle = rgba(dark, 0.5);
        x.fillRect(22, 44, 20, 8);
      }
      addVignette(x, TEX, TEX);
    } else if (pattern === 'ice') {
      x.fillStyle = base;
      x.fillRect(0, 0, TEX, TEX);
      const grad = x.createLinearGradient(0, 0, 64, 64);
      grad.addColorStop(0, rgba(light, 0.22));
      grad.addColorStop(0.6, 'rgba(255,255,255,0)');
      x.fillStyle = grad;
      x.fillRect(0, 0, 64, 64);
      x.strokeStyle = rgba(light, 0.55);
      x.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        let px = rng() * 64;
        let py = rng() * 64;
        x.beginPath();
        x.moveTo(px, py);
        for (let j = 0; j < 5; j++) {
          px += (rng() - 0.5) * 20;
          py += (rng() - 0.5) * 20;
          x.lineTo(px, py);
        }
        x.stroke();
      }
      for (let i = 0; i < 12; i++) {
        x.fillStyle = rgba(light, 0.2 + rng() * 0.5);
        x.fillRect(rng() * 64, rng() * 64, 1 + rng() * 2, 1);
      }
      if (variant === 1) {
        x.fillStyle = rgba(light, 0.25);
        for (let i = 0; i < 7; i++) {
          const ix = rng() * 64;
          x.beginPath();
          x.moveTo(ix, 0);
          x.lineTo(ix - 2, 8 + rng() * 14);
          x.lineTo(ix + 2, 4 + rng() * 9);
          x.closePath();
          x.fill();
        }
      } else if (variant === 2) {
        x.strokeStyle = rgba(accent2, 0.35);
        x.beginPath(); x.arc(32, 32, 20, 0, Math.PI * 2); x.stroke();
        x.fillStyle = rgba(accent2, 0.18);
        x.fillRect(30, 12, 4, 40);
      }
      addVignette(x, TEX, TEX);
    } else if (pattern === 'hazard') {
      x.fillStyle = base;
      x.fillRect(0, 0, TEX, TEX);
      x.fillStyle = rgba(dark, 0.8);
      for (let i = 0; i < 4; i++) x.fillRect(0, i * 16 + 15, TEX, 1);
      x.fillRect(0, 0, TEX, 2);
      bolts(x, light, [[4, 4], [58, 4], [4, 58], [58, 58]]);
      x.save();
      x.beginPath(); x.rect(0, 46, 64, 16); x.clip();
      x.fillStyle = rgba(accent, 0.6);
      x.fillRect(0, 46, 64, 16);
      x.fillStyle = 'rgba(0,0,0,.8)';
      for (let i = -1; i < 9; i++) {
        x.save();
        x.translate(i * 10, 46);
        x.rotate(-0.45);
        x.fillRect(0, 0, 5, 22);
        x.restore();
      }
      x.restore();
      x.fillStyle = rgba(dark, 0.8);
      x.fillRect(8, 10, 30, 18);
      x.fillStyle = rgba(accent2, 0.45);
      x.fillRect(11, 14, 20, 2);
      x.fillRect(11, 18, 13, 1);
      x.fillRect(11, 21, 24, 1);
      x.fillStyle = rgba(accent, 0.3);
      x.fillRect(48, 12, 3, 22);
      stains(x, TEX, TEX, rng, dark, 4);
      grain(x, TEX, TEX, rng, 300, dark, light);
      if (variant === 2) {
        x.strokeStyle = rgba(accent2, 0.4);
        x.strokeRect(20.5, 26.5, 24, 14);
        x.fillStyle = rgba(accent2, 0.32);
        x.fillRect(24, 31, 7, 2);
        x.fillRect(24, 35, 14, 1);
      }
    } else if (pattern === 'root') {
      const grad = x.createLinearGradient(0, 0, 0, 64);
      grad.addColorStop(0, base);
      grad.addColorStop(0.7, dark);
      grad.addColorStop(1, '#0c0303');
      x.fillStyle = grad;
      x.fillRect(0, 0, TEX, TEX);
      for (let i = 0; i < 8; i++) {
        x.strokeStyle = rgba(rng() < 0.35 ? accent2 : accent, 0.07 + rng() * 0.22);
        x.lineWidth = 1 + Math.floor(rng() * 3);
        x.beginPath();
        let px = rng() * 64;
        let py = 0;
        x.moveTo(px, py);
        while (py < 64) {
          px += (rng() - 0.5) * 18;
          py += 4 + rng() * 8;
          x.lineTo(px, py);
        }
        x.stroke();
      }
      for (let i = 0; i < 28; i++) {
        x.fillStyle = rgba(accent, 0.12 + rng() * 0.45);
        x.fillRect(rng() * 64, rng() * 64, 1, 1 + rng() * 2);
      }
      if (variant === 1) {
        x.fillStyle = '#080202';
        x.beginPath();
        x.ellipse(32, 32, 15, 22, 0, 0, Math.PI * 2);
        x.fill();
        x.fillStyle = rgba(accent, 0.7);
        x.fillRect(28, 21, 8, 2);
        x.fillRect(28, 38, 8, 2);
        for (let i = 0; i < 6; i++) {
          x.fillRect(25 + i * 3, 26 + (i % 2) * 10, 2, 4);
        }
      } else if (variant === 2) {
        drawGlyphBlocks(x, 12, 8, 20, 20, accent, rng, 0.22);
        x.strokeStyle = rgba(accent2, 0.25);
        x.strokeRect(6.5, 6.5, 51, 51);
      }
      addVignette(x, TEX, TEX);
    } else {
      grain(x, TEX, TEX, rng, 400, dark, light);
      stains(x, TEX, TEX, rng, dark, 4);
      cracks(x, rng, dark, 2, TEX, TEX);
    }

    // common top/bottom edge
    x.fillStyle = 'rgba(0,0,0,.28)';
    x.fillRect(0, 0, TEX, 1);
    x.fillRect(0, 63, TEX, 1);
    return textureFromCanvas(c).data;
  }

  // ---------------------------------------------------------------- floor / ceiling
  function makeFloorTexture(th, seed) {
    const { c, x } = canvas2d(TEX, TEX);
    const rng = mulberry32(seed + 777);
    const base = th.floor[0];
    const dark = th.floor[1];
    const light = th.floor[2];
    const accent = th.accent;
    const accent2 = th.accent2 || accent;
    const p = th.pattern;
    x.fillStyle = base;
    x.fillRect(0, 0, TEX, TEX);

    if (p === 'office') {
      // damp mustard carpet
      for (let i = 0; i < 500; i++) {
        x.fillStyle = rgba(rng() < 0.5 ? dark : light, 0.06 + rng() * 0.13);
        x.fillRect(rng() * 64, rng() * 64, 1, 1 + (rng() < 0.15 ? 1 : 0));
      }
      stains(x, TEX, TEX, rng, dark, 5);
      stains(x, TEX, TEX, rng, accent, 1);
      x.strokeStyle = rgba(dark, 0.18);
      for (let i = 0; i < 5; i++) {
        x.beginPath();
        x.moveTo(rng() * 64, 0);
        x.lineTo(rng() * 64, 64);
        x.stroke();
      }
      grain(x, TEX, TEX, rng, 180, dark, light);
    } else if (p === 'tile' || p === 'mirror') {
      x.strokeStyle = rgba(dark, 0.7);
      for (let i = 0; i <= 64; i += 16) {
        x.beginPath(); x.moveTo(i + 0.5, 0); x.lineTo(i + 0.5, 64); x.stroke();
        x.beginPath(); x.moveTo(0, i + 0.5); x.lineTo(64, i + 0.5); x.stroke();
      }
      x.fillStyle = rgba(light, 0.08);
      x.beginPath(); x.moveTo(0, 0); x.lineTo(34, 0); x.lineTo(0, 34); x.closePath(); x.fill();
      stains(x, TEX, TEX, rng, dark, 2);
      cracks(x, rng, dark, 1, TEX, TEX);
      grain(x, TEX, TEX, rng, 180, dark, light);
    } else if (p === 'code') {
      x.fillStyle = '#020604';
      x.fillRect(0, 0, TEX, TEX);
      x.strokeStyle = rgba(accent, 0.18);
      x.strokeRect(0.5, 0.5, 63, 63);
      for (let i = 0; i < 9; i++) {
        x.fillStyle = rgba(rng() < 0.3 ? accent : shade(accent, 0.4), 0.15 + rng() * 0.4);
        x.fillRect(Math.floor(rng() * 64), Math.floor(rng() * 64), 1 + rng() * 7, 1);
      }
      x.fillStyle = rgba(dark, 0.5);
      x.fillRect(0, 0, 64, 2);
      grain(x, TEX, TEX, rng, 220, dark, accent);
    } else if (p === 'ice') {
      for (let i = 0; i < 5; i++) {
        x.strokeStyle = rgba(light, 0.25 + rng() * 0.25);
        x.beginPath();
        let px = rng() * 64, py = rng() * 64;
        x.moveTo(px, py);
        for (let j = 0; j < 4; j++) {
          px += (rng() - 0.5) * 26;
          py += (rng() - 0.5) * 26;
          x.lineTo(px, py);
        }
        x.stroke();
      }
      stains(x, TEX, TEX, rng, '#ffffff', 2);
      grain(x, TEX, TEX, rng, 400, dark, light);
    } else if (p === 'hazard' || p === 'rust') {
      x.fillStyle = rgba(dark, 0.65);
      for (let i = 0; i < 64; i += 8) {
        x.fillRect(i, 0, 1, 64);
      }
      for (let i = 0; i < 64; i += 8) {
        x.fillRect(0, i, 64, 1);
      }
      x.fillStyle = rgba(light, 0.15);
      x.fillRect(2, 2, 4, 4);
      x.fillRect(58, 58, 4, 4);
      stains(x, TEX, TEX, rng, dark, 3);
      grain(x, TEX, TEX, rng, 300, dark, light);
    } else if (p === 'root') {
      for (let i = 0; i < 7; i++) {
        x.strokeStyle = rgba(rng() < 0.4 ? accent : dark, 0.12 + rng() * 0.25);
        x.lineWidth = 1 + Math.floor(rng() * 2);
        x.beginPath();
        let px = rng() * 64, py = rng() * 64;
        x.moveTo(px, py);
        for (let j = 0; j < 4; j++) {
          px += (rng() - 0.5) * 22;
          py += (rng() - 0.5) * 22;
          x.lineTo(px, py);
        }
        x.stroke();
      }
      for (let i = 0; i < 20; i++) {
        x.fillStyle = rgba(accent, 0.12 + rng() * 0.3);
        x.fillRect(rng() * 64, rng() * 64, 1, 1);
      }
      addVignette(x, TEX, TEX);
      grain(x, TEX, TEX, rng, 200, dark, light);
    } else if (p === 'void') {
      const grad = x.createRadialGradient(32, 32, 1, 32, 32, 40);
      grad.addColorStop(0, shade(base, 1.2));
      grad.addColorStop(1, dark);
      x.fillStyle = grad;
      x.fillRect(0, 0, TEX, TEX);
      for (let i = 0; i < 20; i++) {
        x.fillStyle = rgba(accent, 0.12 + rng() * 0.3);
        x.fillRect(rng() * 64, rng() * 64, 1, 1);
      }
      x.strokeStyle = rgba(accent, 0.1);
      x.strokeRect(8.5, 8.5, 47, 47);
      grain(x, TEX, TEX, rng, 180, dark, light);
    } else if (p === 'grave') {
      x.fillStyle = rgba(dark, 0.5);
      for (let i = 0; i < 64; i += 16) x.fillRect(i, 0, 1, 64);
      for (let i = 0; i < 64; i += 16) x.fillRect(0, i, 64, 1);
      stains(x, TEX, TEX, rng, dark, 4);
      for (let i = 0; i < 20; i++) {
        x.fillStyle = rgba(accent, 0.08 + rng() * 0.18);
        x.fillRect(rng() * 64, rng() * 64, 1, 2);
      }
      grain(x, TEX, TEX, rng, 300, dark, light);
    } else if (p === 'shadow' || p === 'corrupt') {
      for (let i = 0; i < 5; i++) {
        x.fillStyle = rgba(rng() < 0.4 ? accent : accent2, 0.04 + rng() * 0.12);
        x.fillRect(0, rng() * 64, 64, 1 + rng() * 4);
      }
      x.fillStyle = rgba(dark, 0.4);
      x.fillRect(0, 31, 64, 1);
      grain(x, TEX, TEX, rng, 400, dark, light);
    } else {
      // concrete slabs / default
      x.fillStyle = rgba(dark, 0.45);
      x.fillRect(0, 31, 64, 2);
      x.fillRect(31, 0, 2, 64);
      x.fillStyle = rgba(light, 0.06);
      x.fillRect(0, 0, 64, 2);
      cracks(x, rng, dark, 1 + (p === 'concrete' ? 1 : 0), 64, 64);
      stains(x, TEX, TEX, rng, dark, 3);
      grain(x, TEX, TEX, rng, 380, dark, light);
    }
    // sparse accent flecks
    for (let i = 0; i < 5; i++) {
      x.fillStyle = rgba(accent, 0.08 + rng() * 0.12);
      x.fillRect(rng() * 64, rng() * 64, 1, 1);
    }
    return textureFromCanvas(c).data;
  }

  function makeCeilingTexture(th, seed) {
    const { c, x } = canvas2d(TEX, TEX);
    const rng = mulberry32(seed + 911);
    const base = th.ceil[0];
    const dark = th.ceil[1];
    const light = th.ceil[2];
    const accent = th.accent;
    const p = th.pattern;
    x.fillStyle = base;
    x.fillRect(0, 0, TEX, TEX);
    x.fillStyle = rgba(dark, 0.5);
    x.fillRect(0, 31, 64, 2);
    x.fillRect(31, 0, 2, 64);
    x.strokeStyle = rgba(dark, 0.4);
    x.strokeRect(3.5, 3.5, 57, 57);
    const noLight = ['void', 'root', 'grave', 'code', 'shadow', 'corrupt'].includes(p);
    if (!noLight) {
      x.fillStyle = rgba(light, 0.16);
      x.fillRect(16, 16, 32, 32);
      x.fillStyle = rgba(accent, 0.34);
      x.fillRect(22, 22, 20, 20);
      x.fillStyle = rgba('#ffffff', 0.14);
      x.fillRect(26, 26, 12, 12);
      x.strokeStyle = rgba(dark, 0.7);
      x.strokeRect(21.5, 21.5, 21, 21);
    }
    stains(x, TEX, TEX, rng, dark, 3);
    grain(x, TEX, TEX, rng, 220, dark, light);
    cracks(x, rng, dark, 1, TEX, TEX);
    if (p === 'code') {
      x.fillStyle = rgba(accent, 0.2);
      for (let i = 0; i < 6; i++) x.fillRect(rng() * 64, rng() * 64, 1 + rng() * 10, 1);
    }
    return textureFromCanvas(c).data;
  }

  // ---------------------------------------------------------------- sky / corruption
  function makeSkyTexture(th, seed) {
    const cfg = th.sky || {};
    const SW = 512;
    const SH = 192;
    const { c, x } = canvas2d(SW, SH);
    const rng = mulberry32(seed + 4207);
    const top = cfg.top || th.ceil[1];
    const mid = cfg.mid || th.ceil[0];
    const horizon = cfg.horizon || th.accent;
    const haze = cfg.haze || horizon;
    const sun = cfg.sun || '#fff3c7';
    const skyline = cfg.skyline || th.wall[1];
    const grad = x.createLinearGradient(0, 0, 0, SH);
    grad.addColorStop(0, top);
    grad.addColorStop(0.55, mid);
    grad.addColorStop(0.9, horizon);
    grad.addColorStop(1, haze);
    x.fillStyle = grad;
    x.fillRect(0, 0, SW, SH);

    const stars = Math.max(0, Math.floor(cfg.stars || 0));
    for (let i = 0; i < stars; i++) {
      const sx = rng() * SW;
      const sy = rng() * SH * 0.7;
      x.fillStyle = `rgba(255,255,255,${0.18 + rng() * 0.7})`;
      x.fillRect(sx | 0, sy | 0, rng() < 0.16 ? 2 : 1, 1);
    }

    const clouds = Math.max(0, Math.min(18, Math.floor((cfg.clouds || 0) * 20)));
    for (let i = 0; i < clouds; i++) {
      const cx = rng() * SW;
      const cy = SH * (0.1 + rng() * 0.48);
      const cw = 24 + rng() * 90;
      const ch = 3 + rng() * 12;
      x.fillStyle = rgba(haze, 0.04 + rng() * 0.1);
      x.beginPath();
      x.ellipse(cx, cy, cw, ch, 0, 0, Math.PI * 2);
      x.fill();
    }

    const sunX = SW * (cfg.sunX == null ? 0.5 : cfg.sunX);
    const sunY = SH * (cfg.sunY == null ? 0.72 : cfg.sunY);
    const sunSize = cfg.sunSize || 20;
    const glow = x.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunSize * 4.2);
    glow.addColorStop(0, rgba(sun, 0.85));
    glow.addColorStop(0.12, rgba(sun, 0.42));
    glow.addColorStop(0.48, rgba(haze, 0.12));
    glow.addColorStop(1, rgba(haze, 0));
    x.fillStyle = glow;
    x.fillRect(sunX - sunSize * 5, sunY - sunSize * 5, sunSize * 10, sunSize * 10);
    x.fillStyle = rgba(sun, 0.92);
    x.beginPath();
    x.arc(sunX, sunY, sunSize * 0.52, 0, Math.PI * 2);
    x.fill();

    const baseY = SH * 0.86;
    const style = cfg.skylineStyle || 'city';
    x.fillStyle = rgba(skyline, 0.92);
    if (style === 'industrial') {
      let px = -12;
      while (px < SW + 20) {
        const bw = 16 + rng() * 42;
        const bh = 10 + rng() * 32;
        x.fillRect(px, baseY - bh, bw, bh + SH - baseY);
        if (rng() < 0.4) {
          x.fillRect(px + bw * 0.5, baseY - bh - 12 - rng() * 18, 2, 12 + rng() * 18);
          x.fillRect(px + bw * 0.2, baseY - bh - 8, bw * 0.7, 2);
        }
        px += bw + 3 + rng() * 16;
      }
      for (let i = 0; i < 22; i++) {
        x.fillStyle = rgba(rng() < 0.5 ? th.accent : th.accent2, 0.25 + rng() * 0.4);
        x.fillRect(rng() * SW, baseY - rng() * 30, 1, 1);
      }
    } else if (style === 'ruins') {
      for (let i = 0; i < 28; i++) {
        const bw = 6 + rng() * 34;
        const bh = 4 + rng() * 34;
        const px = rng() * SW;
        x.fillStyle = rgba(skyline, 0.82 + rng() * 0.16);
        x.fillRect(px, baseY - bh, bw, bh + SH - baseY);
        if (rng() < 0.35) {
          x.beginPath();
          x.moveTo(px, baseY - bh);
          x.lineTo(px + bw * 0.5, baseY - bh - 8 - rng() * 16);
          x.lineTo(px + bw, baseY - bh);
          x.closePath();
          x.fill();
        }
      }
    } else {
      let px = -8;
      while (px < SW + 20) {
        const bw = 10 + rng() * 34;
        const bh = 8 + rng() * 44;
        x.fillStyle = rgba(skyline, 0.88);
        x.fillRect(px, baseY - bh, bw, bh + SH - baseY);
        if (rng() < 0.4) {
          x.fillStyle = rgba(th.accent, 0.22 + rng() * 0.3);
          for (let wy = baseY - bh + 4; wy < baseY - 2; wy += 5) {
            for (let wx = px + 3; wx < px + bw - 2; wx += 5) {
              if (rng() < 0.55) x.fillRect(wx, wy, 1, 1);
            }
          }
        }
        px += bw + 2 + rng() * 10;
      }
    }
    const hazeGrad = x.createLinearGradient(0, SH * 0.68, 0, SH);
    hazeGrad.addColorStop(0, rgba(haze, 0));
    hazeGrad.addColorStop(0.75, rgba(haze, 0.18));
    hazeGrad.addColorStop(1, rgba(haze, 0.5));
    x.fillStyle = hazeGrad;
    x.fillRect(0, SH * 0.68, SW, SH * 0.32);
    return textureFromCanvas(c);
  }

  function corruptTextureData(arr, w, h, amount, seed) {
    if (!arr || amount <= 0.01) return arr;
    const rng = mulberry32(seed + 991);
    const bands = Math.max(1, Math.floor(amount * 16));
    for (let i = 0; i < bands; i++) {
      const y0 = Math.floor(rng() * h);
      const bh = 1 + Math.floor(rng() * Math.max(1, amount * 7));
      const shift = Math.floor((rng() - 0.5) * w * (0.06 + amount * 0.2));
      for (let y = y0; y < Math.min(h, y0 + bh); y++) {
        const off = y * w;
        const row = arr.slice(off, off + w);
        for (let x = 0; x < w; x++) arr[off + x] = row[(x + shift + w) % w];
      }
    }
    const blocks = Math.max(1, Math.floor(amount * 10));
    for (let i = 0; i < blocks; i++) {
      const bx = Math.floor(rng() * w);
      const by = Math.floor(rng() * h);
      const bw = 1 + Math.floor(rng() * Math.max(1, w * 0.1));
      const bh = 1 + Math.floor(rng() * 3);
      const mode = rng();
      for (let y = by; y < Math.min(h, by + bh); y++) {
        for (let x = bx; x < Math.min(w, bx + bw); x++) {
          const idx = y * w + x;
          const col = arr[idx];
          let r = col & 255;
          let g = (col >>> 8) & 255;
          let b = (col >>> 16) & 255;
          if (mode < 0.5) {
            const t = r; r = b; b = t;
          } else if (mode < 0.8) {
            r = 255 - r;
          } else {
            g = 255 - g;
          }
          arr[idx] = 0xff000000 | (b << 16) | (g << 8) | r;
        }
      }
    }
    return arr;
  }

  function applyGlitchPass() {
    const amount = (theme && theme.glitch) || 0;
    if (amount < 0.03) return;
    if (Math.random() > Math.min(0.92, amount * 1.25)) return;
    const bands = 1 + Math.floor(amount * 4 + Math.random() * 2);
    for (let i = 0; i < bands; i++) {
      const y0 = Math.floor(Math.random() * H);
      const bh = 1 + Math.floor(Math.random() * Math.max(1, amount * 13));
      const shift = Math.floor((Math.random() - 0.5) * amount * 86);
      for (let y = y0; y < Math.min(H, y0 + bh); y++) {
        const off = y * W;
        glitchLine.set(data.subarray(off, off + W));
        if (shift >= 0) {
          for (let x = 0; x < W; x++) data[off + x] = glitchLine[(x + shift) % W];
        } else {
          for (let x = 0; x < W; x++) data[off + x] = glitchLine[(x - shift) % W];
        }
      }
    }
    if (amount > 0.28 && Math.random() < amount * 0.18) {
      const tintR = Math.random() < 0.5;
      for (let i = 0; i < data.length; i += 3) {
        const col = data[i];
        const r = col & 255;
        const g = (col >>> 8) & 255;
        const b = (col >>> 16) & 255;
        data[i] = tintR
          ? (0xff000000 | (r << 16) | (g << 8) | b)
          : (0xff000000 | (b << 16) | (r << 8) | g);
      }
    }
  }

  function makeHazardTexture(th) {
    const { c, x } = canvas2d(TEX, TEX);
    const rng = mulberry32(331);
    x.fillStyle = '#170b06';
    x.fillRect(0, 0, TEX, TEX);
    x.strokeStyle = rgba(th.accent2, 0.45);
    for (let i = 0; i < 5; i++) {
      x.beginPath();
      x.arc(32, 32, 6 + i * 6, rng() * 2, rng() * 2 + 4);
      x.stroke();
    }
    x.fillStyle = rgba(th.accent2, 0.4);
    for (let i = 0; i < 30; i++) x.fillRect(rng() * 64, rng() * 64, 1, 1);
    x.fillStyle = rgba(th.accent, 0.22);
    for (let i = 0; i < 4; i++) x.fillRect(0, rng() * 64, 64, 1);
    addVignette(x, TEX, TEX);
    return textureFromCanvas(c).data;
  }

  // ---------------------------------------------------------------- lights / level setup
  function parseMap(rows) {
    mapH = rows.length;
    mapW = Math.max(...rows.map((r) => r.length));
    map = rows.map((r) => r.padEnd(mapW, '#').split(''));
  }

  function buildLights() {
    lightGrid = new Float32Array(mapW * mapH);
    lightGrid.fill(0);
    const rng = mulberry32(1337 + (level ? level.id * 71 : 0));
    const candidates = [];
    for (let y = 1; y < mapH - 1; y++) {
      for (let x = 1; x < mapW - 1; x++) {
        if (!isWallCell(map[y][x])) candidates.push([x, y]);
      }
    }
    const count = Math.max(3, Math.min(8, Math.floor(candidates.length / 95)));
    const lights = [];
    for (let i = 0; i < count; i++) {
      const [lx, ly] = candidates[Math.floor(rng() * candidates.length)];
      lights.push([lx + 0.5, ly + 0.5]);
    }
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        let light = 0.62;
        for (const [lx, ly] of lights) {
          const d = Math.hypot(x + 0.5 - lx, y + 0.5 - ly);
          if (d < 5.2) light += Math.pow(1 - d / 5.2, 2) * 0.8;
        }
        if (map[y][x] === '~') light += 0.35;
        if (map[y][x] === 'E') light += 0.3;
        lightGrid[y * mapW + x] = Math.min(1.7, light);
      }
    }
  }

  function isWallCell(ch) {
    return ch === '#' || ch === '%' || ch === '+' || ch === 'D' || ch === 'L';
  }

  function setCell(x, y, ch) {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    if (!map || cx < 0 || cy < 0 || cx >= mapW || cy >= mapH) return false;
    map[cy][cx] = ch;
    return true;
  }

  function getCell(x, y) {
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    if (!map || cx < 0 || cy < 0 || cx >= mapW || cy >= mapH) return '#';
    return map[cy][cx];
  }

  function setLevel(lv) {
    level = lv;
    theme = LIMBO_CONTENT.THEMES[lv.theme] || LIMBO_CONTENT.THEMES.awakening;
    parseMap(lv.map);
    const seed = lv.id * 433 + 9;
    const glitch = theme.glitch || 0;
    wallTex = [0, 1, 2].map((v) => corruptTextureData(
      makeWallTexture(theme, v, seed), TEX, TEX, glitch * 0.8, seed + v * 97,
    ));
    floorTex = corruptTextureData(makeFloorTexture(theme, seed), TEX, TEX, glitch * 0.55, seed + 301);
    ceilTex = corruptTextureData(makeCeilingTexture(theme, seed), TEX, TEX, glitch * 0.55, seed + 302);
    hazardTex = makeHazardTexture(theme);
    if (theme.sky) {
      skyTex = makeSkyTexture(theme, seed);
      corruptTextureData(skyTex.data, skyTex.w, skyTex.h, glitch * 0.34, seed + 303);
    } else {
      skyTex = null;
    }
    buildLights();
    particles = [];
    frameNo = 0;
    flicker = 1;
    ensureSprites();
  }

  // ---------------------------------------------------------------- sprites
  function ensureSprites() {
    if (spriteCache.size > 0) return;
    const defs = [
      ['tick', 2, 24, 20, drawTick],
      ['crawler', 2, 32, 44, drawCrawler],
      ['drone', 2, 32, 32, drawDrone],
      ['wraith', 2, 36, 56, drawWraith],
      ['brute', 2, 48, 60, drawBrute],
      ['mirror', 2, 36, 54, drawMirror],
      ['admin', 1, 80, 100, drawAdmin],
      ['core', 1, 96, 110, drawCore],
      ['root', 1, 104, 120, drawRoot],
      ['orb', 1, 14, 14, drawOrb],
      ['orb_big', 1, 20, 20, drawOrbBig],
      ['pickup', 1, 18, 24, drawPickup],
      ['keycard', 1, 24, 16, drawKeycard],
      ['note', 1, 20, 24, drawNote],
      ['gate', 1, 56, 72, drawGate],
      ['terminal', 1, 48, 64, drawTerminal],
      ['playerbody', 2, 36, 52, drawPlayerBody],
      ['hurt', 1, 24, 24, drawHurt],
    ];
    for (const [name, frames, w, h, fn] of defs) {
      for (let f = 0; f < frames; f++) {
        const { c, x } = canvas2d(w, h);
        x.imageSmoothingEnabled = false;
        fn(x, f, w, h);
        const tex = textureFromCanvas(c);
        spriteCache.set(`${name}_${f}`, { data: tex.data, w, h, name, frame: f });
      }
    }
  }

  function px(x, color, rects) {
    x.fillStyle = color;
    for (const r of rects) x.fillRect(r[0], r[1], r[2], r[3]);
  }

  function glowPixels(x, color, points, alpha) {
    for (const [gx, gy, s] of points) {
      x.fillStyle = rgba(color, alpha);
      x.fillRect(gx, gy, s, s);
    }
  }

  function drawTick(x, frame) {
    const a = frame === 0 ? 0 : 1;
    px(x, 'rgba(5,9,6,.9)', [[8, 7, 10, 8], [5, 9, 15, 6], [10, 5, 6, 5]]);
    px(x, '#2b4a2a', [[9, 8, 8, 7], [6, 10, 13, 4], [10, 6, 5, 4], [11, 13, 7, 4]]);
    px(x, '#4d7a3f', [[10, 9, 6, 2], [8, 11, 9, 1]]);
    px(x, '#a9ff86', [[11, 7, 2, 2], [14, 9, 1, 1], [8, 12, 1, 1]]);
    px(x, '#ff5a3d', [[12, 7, 2, 1], [13, 8, 1, 1]]);
    // legs
    px(x, '#111b12', [
      [5, 11, 3, 1], [3, 10 + a, 2, 1], [2, 9 + a, 2, 1],
      [4, 14, 3, 1], [2, 14 - a, 2, 1], [1, 15 - a, 2, 1],
      [5, 16, 3, 1], [3, 17 + a, 2, 1], [2, 18, 1, 1],
      [16, 11, 3, 1], [19, 10 + a, 2, 1], [20, 9 + a, 2, 1],
      [16, 14, 3, 1], [19, 14 - a, 2, 1], [20, 15 - a, 2, 1],
      [15, 16, 3, 1], [18, 17 + a, 2, 1], [20, 18, 1, 1],
    ]);
    px(x, '#29402b', [[3, 10 + a, 1, 1], [2, 15 - a, 1, 1], [19, 10 + a, 1, 1], [20, 15 - a, 1, 1]]);
    glowPixels(x, '#b7ff7a', [[7, 15, 1], [16, 15, 1], [10, 17, 1]], 0.3);
  }

  function drawCrawler(x, frame) {
    const a = frame === 0 ? 0 : 1;
    px(x, '#050a07', [
      [10, 4, 12, 10], [8, 13, 16, 11], [7, 22, 18, 12],
      [5, 24, 4, 13], [23, 24, 4, 13],
      [8, 37, 6, 5], [18, 37, 6, 5],
      [11, 14, 10, 4],
    ]);
    px(x, '#203a28', [
      [11, 5, 10, 9], [9, 14, 14, 9], [8, 23, 16, 10],
      [6, 25, 3, 11], [23, 25, 3, 11],
      [9, 37, 4, 4], [19, 37, 4, 4],
    ]);
    px(x, '#335839', [[12, 6, 8, 3], [10, 16, 12, 4], [9, 24, 14, 4]]);
    px(x, '#7fbf6a', [[12, 6, 3, 1], [10, 15, 4, 1], [18, 20, 2, 1], [8, 28, 2, 1]]);
    px(x, '#f0ffd8', [[13, 8, 2, 1], [18, 8, 2, 1]]);
    px(x, '#ff5a3d', [[13, 9, 1, 1], [18, 9, 1, 1], [16, 16, 2, 2]]);
    // long arms
    px(x, '#17281b', [[4, 23 + a, 3, 1], [2, 25 + a, 3, 1], [1, 27 - a, 2, 8], [3, 35, 2, 5], [1, 39, 3, 2]]);
    px(x, '#17281b', [[25, 23 - a, 3, 1], [27, 25 - a, 3, 1], [29, 27 + a, 2, 8], [27, 35, 2, 5], [28, 39, 3, 2]]);
    px(x, '#739f5d', [[2, 28, 1, 5], [29, 28, 1, 5]]);
    // legs / feet
    px(x, '#0c1710', [[7, 39, 6, 3], [19, 39, 6, 3], [8, 41, 8, 2], [16, 41, 8, 2]]);
    px(x, '#5d8a50', [[12, 5, 1, 2], [9, 18, 2, 1], [20, 26, 2, 1]]);
    glowPixels(x, '#b7ff7a', [[7, 30, 1], [24, 30, 1], [15, 12, 1]], 0.35);
  }

  function drawDrone(x, frame) {
    const rot = frame === 0 ? 0 : 0.35;
    const cx = 16;
    const cy = 16;
    x.strokeStyle = '#0b0f0a';
    x.lineWidth = 4;
    x.beginPath();
    x.arc(cx, cy, 12, rot, rot + Math.PI * 1.75);
    x.stroke();
    x.strokeStyle = '#7d8d5a';
    x.lineWidth = 1.5;
    x.beginPath();
    x.arc(cx, cy, 12, rot, rot + Math.PI * 1.75);
    x.stroke();
    x.strokeStyle = 'rgba(255,220,120,.45)';
    x.lineWidth = 1;
    x.beginPath();
    x.arc(cx, cy, 10.5, rot + 0.4, rot + 1.4);
    x.stroke();
    // wires
    px(x, '#20261a', [[6, 24, 1, 5], [12, 27, 1, 4], [20, 26, 1, 5], [25, 23, 1, 6]]);
    px(x, '#ff7b42', [[6, 28, 1, 1], [20, 29, 1, 1]]);
    // eyeball
    px(x, '#0b0805', [[8, 8, 16, 16], [7, 10, 18, 12]]);
    px(x, '#d7c994', [[9, 8, 14, 15], [8, 10, 16, 11]]);
    px(x, '#efe5b8', [[10, 9, 11, 6], [11, 15, 9, 3]]);
    px(x, '#8a2b1d', [[12, 11, 9, 8], [14, 10, 5, 10]]);
    px(x, '#ff5c3e', [[14, 12, 5, 6]]);
    px(x, '#180502', [[16, 13, 2, 4], [15, 14, 4, 2]]);
    px(x, '#ffffff', [[13, 11, 2, 2]]);
    // ring nodes
    for (let i = 0; i < 6; i++) {
      const ang = rot + i * (Math.PI / 3);
      const gx = Math.round(cx + Math.cos(ang) * 12) - 1;
      const gy = Math.round(cy + Math.sin(ang) * 12) - 1;
      px(x, i % 2 ? '#c7a757' : '#7a5f2c', [[gx, gy, 2, 2]]);
    }
    glowPixels(x, '#ffd173', [[5, 6, 1], [26, 9, 1], [24, 25, 1]], 0.4);
  }

  function drawWraith(x, frame) {
    const sway = frame === 0 ? 0 : 1;
    // tattered body
    px(x, 'rgba(4,12,16,.9)', [
      [14, 3, 9, 12], [10, 14, 17, 19], [8, 29, 21, 12],
      [6, 38, 7, 14], [13, 40, 5, 12], [20, 37, 7, 13], [25, 42, 6, 9],
    ]);
    px(x, 'rgba(25,60,70,.8)', [[15, 5, 7, 10], [12, 16, 13, 15], [10, 30, 17, 8]]);
    px(x, 'rgba(58,117,130,.55)', [[16, 6, 3, 7], [13, 18, 3, 8], [23, 22, 2, 7]]);
    // hood
    px(x, '#061014', [[13, 2, 11, 12], [11, 4, 15, 9], [10, 8, 17, 7]]);
    px(x, '#14303a', [[14, 4, 9, 8], [12, 8, 13, 5]]);
    px(x, '#b7f6ff', [[15, 8, 2, 2], [20, 8, 2, 2]]);
    px(x, '#ffffff', [[16, 8, 1, 1], [20, 8, 1, 1]]);
    // arms
    px(x, '#08161a', [[8, 18, 2, 1 + sway], [5, 20 + sway, 3, 1], [3, 21 + sway, 2, 7], [2, 27, 1, 5], [1, 31, 2, 2]]);
    px(x, '#08161a', [[28, 17, 2, 1 + sway], [30, 19 - sway, 3, 1], [32, 20 - sway, 2, 7], [33, 26, 1, 5], [33, 30, 2, 2]]);
    px(x, '#4a9fb0', [[2, 28, 1, 3], [33, 27, 1, 3]]);
    // tatters / glitches
    px(x, '#2a7080', [[8, 45, 2, 5], [12, 48, 1, 4], [17, 46, 2, 4], [23, 44, 2, 6], [28, 46, 1, 3]]);
    for (let i = 0; i < 4; i++) {
      const gx = 5 + ((i * 7 + frame * 3) % 28);
      const gy = 12 + ((i * 11) % 40);
      px(x, 'rgba(120,240,255,.5)', [[gx, gy, 2 + (i % 2), 1]]);
    }
    glowPixels(x, '#7ee8ff', [[10, 36, 1], [27, 17, 1], [18, 50, 1]], 0.4);
  }

  function drawBrute(x, frame) {
    const a = frame === 0 ? 0 : 1;
    px(x, '#0b0604', [
      [10, 7, 28, 20], [5, 12, 10, 27], [33, 12, 10, 27],
      [12, 25, 24, 20], [8, 43, 12, 15], [28, 43, 12, 15],
      [15, 2, 18, 12],
    ]);
    px(x, '#4b2d1e', [
      [12, 9, 24, 16], [8, 14, 8, 21], [32, 14, 8, 21],
      [13, 26, 22, 16], [10, 44, 9, 12], [29, 44, 9, 12], [17, 4, 14, 8],
    ]);
    px(x, '#6d442b', [[14, 11, 20, 5], [10, 16, 5, 9], [33, 16, 5, 9], [16, 28, 16, 5]]);
    px(x, '#2a160d', [[14, 18, 20, 5], [15, 33, 18, 6]]);
    // furnace chest
    px(x, '#170802', [[18, 24, 12, 10]]);
    px(x, '#ff7a2f', [[20, 26, 8, 6], [19, 28, 10, 2]]);
    px(x, '#ffd08a', [[22, 27, 4, 3]]);
    // head
    px(x, '#1a0d07', [[18, 2, 12, 9], [19, 0, 10, 4]]);
    px(x, '#e2b16a', [[20, 4, 8, 5]]);
    px(x, '#ff5a3d', [[21, 6, 2, 1], [25, 6, 2, 1]]);
    px(x, '#0a0403', [[21, 7, 2, 1], [25, 7, 2, 1]]);
    // massive fists
    px(x, '#0c0604', [[3, 34, 10, 10], [35, 34, 10, 10]]);
    px(x, '#613b26', [[5, 36, 7, 7], [36, 36, 7, 7]]);
    px(x, '#9a6140', [[6, 37, 5, 3], [37, 37, 5, 3]]);
    px(x, '#d39a68', [[7, 40, 2, 1], [38, 40, 2, 1]]);
    // knees
    px(x, '#2b170e', [[11, 48 + a, 8, 2], [29, 48 - a, 8, 2]]);
    glowPixels(x, '#ff9c3c', [[7, 43, 1], [40, 43, 1], [24, 1, 1]], 0.35);
  }

  function drawMirror(x, frame) {
    const a = frame === 0 ? 0 : 1;
    px(x, 'rgba(2,10,14,.6)', [
      [12, 3, 12, 10], [9, 13, 18, 18], [7, 29, 22, 13],
      [9, 41, 7, 10], [20, 41, 7, 10],
    ]);
    px(x, '#cfe6ee', [[13, 4, 10, 8], [10, 14, 16, 16], [8, 30, 20, 10]]);
    px(x, '#eefaff', [[14, 5, 5, 4], [10, 15, 4, 9], [22, 16, 3, 8]]);
    px(x, '#4c6470', [[16, 12, 4, 4], [9, 21, 18, 2], [12, 31, 12, 4]]);
    // black visor
    px(x, '#03080a', [[13, 7, 10, 4]]);
    px(x, '#52f4ff', [[14, 8, 3, 1], [20, 8, 2, 1]]);
    // plating seams
    px(x, '#8fb2bf', [[13, 16, 1, 9], [22, 16, 1, 9], [16, 23, 4, 1], [11, 33, 5, 1], [20, 33, 5, 1]]);
    px(x, '#2c3b42', [[9, 29, 22, 2], [10, 39, 4, 3], [22, 39, 4, 3]]);
    // arms
    px(x, '#a9c8d4', [[10, 18, 3, 10], [23, 18, 3, 10]]);
    px(x, '#dff7ff', [[9, 27, 2, 5], [25, 27, 2, 5]]);
    px(x, '#6f9cad', [[8, 31 + a, 2, 6], [26, 31 - a, 2, 6]]);
    // legs
    px(x, '#b6d2dc', [[11, 39, 5, 9], [20, 39, 5, 9]]);
    px(x, '#dff7ff', [[12, 46, 5, 5], [19, 46, 5, 5]]);
    px(x, '#1b2a31', [[11, 50 + a, 7, 2], [19, 50 - a, 7, 2]]);
    // reflection shards
    px(x, 'rgba(130,240,255,.5)', [[8, 12, 1, 3], [28, 20, 1, 4], [6, 35, 1, 2], [29, 34, 1, 3]]);
    glowPixels(x, '#bff4ff', [[12, 4, 1], [27, 18, 1], [6, 25, 1]], 0.4);
  }

  function drawAdmin(x) {
    // cloak
    px(x, 'rgba(3,2,5,.95)', [
      [24, 26, 32, 46], [18, 34, 44, 38], [12, 46, 56, 30],
      [8, 68, 64, 22], [30, 10, 20, 18],
    ]);
    px(x, '#25112d', [[26, 28, 28, 42], [20, 36, 40, 32], [14, 48, 52, 24]]);
    px(x, '#3b1a48', [[28, 30, 24, 8], [22, 40, 12, 20], [48, 36, 10, 24]]);
    // monitor head
    px(x, '#0a050b', [[25, 6, 30, 24]]);
    px(x, '#2a1233', [[27, 8, 26, 20]]);
    px(x, '#ff5bb8', [[28, 9, 24, 2], [28, 24, 24, 2], [28, 9, 2, 17], [50, 9, 2, 17]]);
    px(x, '#0c2606', [[31, 12, 18, 11]]);
    px(x, '#64ff7a', [[32, 13, 15, 1], [32, 16, 9, 1], [32, 19, 13, 1], [45, 14, 2, 2], [35, 22, 6, 1]]);
    px(x, '#ff3f55', [[32, 14, 3, 1], [44, 20, 2, 1]]);
    // arms
    px(x, '#1b0b22', [[14, 38, 12, 6], [8, 43, 8, 4], [4, 45, 6, 3]]);
    px(x, '#2e1338', [[54, 38, 12, 6], [64, 43, 8, 4], [70, 45, 6, 3]]);
    px(x, '#ff5bb8', [[2, 45, 3, 2], [72, 45, 3, 2], [9, 47, 2, 1], [66, 47, 2, 1]]);
    // tendrils
    for (let i = 0; i < 7; i++) {
      const tx = 14 + i * 8;
      const ty = 76 + (i % 3) * 5;
      px(x, '#2a0e33', [[tx, 72, 2, ty - 72], [tx - 2, ty, 4, 2], [tx - 1, ty + 2, 2, 3]]);
      px(x, 'rgba(255,91,184,.5)', [[tx, ty + 4, 1, 1]]);
    }
    // floating windows
    px(x, 'rgba(255,91,184,.22)', [[5, 18, 15, 10], [63, 22, 14, 9]]);
    px(x, '#ff5bb8', [[5, 18, 15, 1], [5, 18, 1, 10], [63, 22, 14, 1]]);
    px(x, 'rgba(97,255,160,.35)', [[7, 21, 7, 1], [7, 24, 4, 1], [65, 25, 6, 1]]);
    // core eye in chest
    px(x, '#0b020d', [[34, 36, 14, 10]]);
    px(x, '#ff5bb8', [[37, 39, 8, 4], [39, 38, 4, 6]]);
    px(x, '#fff0fb', [[40, 40, 2, 1]]);
    glowPixels(x, '#ff5bb8', [[10, 34, 1], [70, 34, 1], [4, 51, 1], [74, 52, 1], [15, 82, 1], [88, 76, 1]], 0.35);
  }

  function drawCore(x) {
    // pistons / cables
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const ex = 48 + Math.cos(ang) * 40;
      const ey = 55 + Math.sin(ang) * 44;
      x.strokeStyle = '#1a110b';
      x.lineWidth = 3;
      x.beginPath();
      x.moveTo(48, 55);
      x.lineTo(ex, ey);
      x.stroke();
      x.strokeStyle = 'rgba(255,140,50,.28)';
      x.lineWidth = 1;
      x.beginPath();
      x.moveTo(48, 55);
      x.lineTo(ex, ey);
      x.stroke();
      px(x, '#3b2313', [[Math.round(ex) - 2, Math.round(ey) - 2, 5, 5]]);
      px(x, '#ff9c3c', [[Math.round(ex) - 1, Math.round(ey) - 1, 2, 2]]);
    }
    // outer rings
    x.strokeStyle = '#0a0604';
    x.lineWidth = 8;
    x.beginPath(); x.arc(48, 55, 34, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = '#593722';
    x.lineWidth = 4;
    x.beginPath(); x.arc(48, 55, 34, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = 'rgba(255,156,60,.55)';
    x.lineWidth = 1;
    x.beginPath(); x.arc(48, 55, 37, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = '#120a06';
    x.lineWidth = 8;
    x.beginPath(); x.arc(48, 55, 22, 0, Math.PI * 2); x.stroke();
    x.strokeStyle = '#7a4a28';
    x.lineWidth = 2;
    x.beginPath(); x.arc(48, 55, 22, 0, Math.PI * 2); x.stroke();
    // sphere
    px(x, '#080503', [[30, 36, 36, 38], [26, 44, 44, 22]]);
    px(x, '#3a2416', [[32, 37, 32, 34], [28, 44, 40, 20]]);
    px(x, '#6d452a', [[35, 39, 26, 28], [31, 46, 34, 14]]);
    // central eye
    px(x, '#0b0302', [[38, 46, 20, 18]]);
    px(x, '#ff7a2f', [[40, 48, 16, 14], [42, 46, 12, 18]]);
    px(x, '#ffc069', [[43, 50, 10, 8]]);
    px(x, '#1a0602', [[46, 52, 4, 5]]);
    px(x, '#ffffff', [[44, 50, 2, 2]]);
    // plates
    px(x, '#2b190e', [[20, 34, 10, 6], [66, 34, 10, 6], [20, 70, 10, 6], [66, 70, 10, 6]]);
    px(x, '#ff9c3c', [[23, 36, 3, 1], [69, 36, 3, 1], [23, 72, 3, 1], [69, 72, 3, 1]]);
    for (let i = 0; i < 9; i++) {
      px(x, 'rgba(255,140,50,.5)', [[12 + i * 9, 100, 2, 1 + (i % 3)]]);
    }
    glowPixels(x, '#ff9c3c', [[8, 55, 1], [88, 50, 1], [48, 10, 1], [48, 102, 1]], 0.4);
  }

  function drawRoot(x) {
    // horns / crown
    px(x, '#120202', [[18, 22, 10, 20], [76, 22, 10, 20], [10, 10, 8, 22], [86, 10, 8, 22]]);
    px(x, '#3b0b0b', [[20, 24, 6, 16], [78, 24, 6, 16], [12, 12, 5, 18], [88, 12, 5, 18]]);
    px(x, '#ff5a42', [[22, 22, 2, 2], [80, 22, 2, 2]]);
    // body
    px(x, '#080101', [
      [28, 30, 48, 56], [18, 42, 68, 40], [12, 56, 80, 32],
      [22, 82, 60, 22], [30, 26, 44, 16],
    ]);
    px(x, '#2b0707', [[31, 32, 42, 50], [21, 44, 62, 34], [16, 58, 72, 26]]);
    px(x, '#4f0e0e', [[33, 35, 18, 40], [57, 36, 14, 36], [28, 48, 48, 12]]);
    // cables
    for (let i = 0; i < 12; i++) {
      const yy = 40 + i * 5;
      px(x, i % 3 ? '#0c0202' : '#5e1212', [[20 + (i % 4) * 3, yy, 64 - (i % 5) * 4, 1]]);
    }
    // central core / mouth
    px(x, '#080000', [[43, 48, 20, 24], [39, 54, 28, 12]]);
    px(x, '#ff3f3f', [[46, 50, 14, 18], [41, 55, 24, 8]]);
    px(x, '#ffb0a8', [[49, 52, 8, 10]]);
    px(x, '#140000', [[52, 55, 2, 6], [45, 56, 14, 1]]);
    // eyes
    for (const [ex, ey] of [[29, 41], [73, 42], [34, 74], [68, 72], [52, 30]]) {
      px(x, '#0d0101', [[ex - 2, ey - 2, 7, 5]]);
      px(x, '#ff5a42', [[ex - 1, ey - 1, 5, 3]]);
      px(x, '#fff1e8', [[ex, ey - 1, 1, 1]]);
    }
    // arms
    px(x, '#180303', [[6, 48, 12, 4], [0, 51, 8, 3], [86, 48, 12, 4], [96, 51, 8, 3]]);
    px(x, '#4b0c0c', [[2, 54, 8, 15], [94, 54, 8, 15]]);
    px(x, '#ff3f3f', [[2, 68, 1, 2], [101, 68, 1, 2]]);
    // ground tendrils
    for (let i = 0; i < 10; i++) {
      const tx = 8 + i * 10;
      px(x, '#1e0404', [[tx, 100, 2 + (i % 2), 20 - (i % 4) * 3]]);
      px(x, 'rgba(255,63,63,.35)', [[tx, 101, 1, 2]]);
    }
    glowPixels(x, '#ff3f3f', [[14, 40, 1], [90, 62, 1], [34, 104, 1], [78, 12, 1]], 0.45);
  }

  function drawOrb(x) {
    px(x, 'rgba(255,255,255,.18)', [[0, 3, 14, 8], [3, 0, 8, 14]]);
    px(x, 'rgba(255,255,255,.35)', [[2, 2, 10, 10], [4, 1, 6, 12], [1, 4, 12, 6]]);
    px(x, '#ffffff', [[5, 4, 4, 6], [4, 5, 6, 4]]);
    px(x, 'rgba(255,255,255,.25)', [[6, 2, 2, 10]]);
  }

  function drawOrbBig(x) {
    px(x, 'rgba(255,255,255,.14)', [[0, 4, 20, 12], [4, 0, 12, 20]]);
    px(x, 'rgba(255,255,255,.3)', [[2, 2, 16, 16], [6, 1, 8, 18], [1, 6, 18, 8]]);
    px(x, '#ffffff', [[7, 5, 6, 10], [5, 7, 10, 6], [8, 8, 4, 4]]);
    px(x, 'rgba(255,255,255,.3)', [[8, 2, 4, 16]]);
  }

  function drawPickup(x) {
    px(x, 'rgba(0,0,0,.5)', [[3, 5, 12, 16]]);
    px(x, '#ffffff', [[5, 4, 8, 3], [4, 7, 10, 10], [5, 17, 8, 3]]);
    px(x, 'rgba(255,255,255,.45)', [[5, 4, 3, 16], [10, 6, 2, 12]]);
    px(x, 'rgba(255,255,255,.9)', [[8, 7, 2, 8], [6, 9, 6, 2]]);
    px(x, 'rgba(255,255,255,.25)', [[0, 8, 18, 7], [8, 0, 2, 24]]);
  }

  function drawKeycard(x) {
    px(x, 'rgba(0,0,0,.5)', [[1, 4, 22, 11]]);
    px(x, '#1b2417', [[2, 3, 20, 10]]);
    px(x, '#d7c06a', [[3, 4, 18, 8]]);
    px(x, '#f6e6a6', [[4, 5, 16, 2]]);
    px(x, '#3b3a2a', [[5, 9, 11, 1], [5, 11, 8, 1]]);
    px(x, '#ffe08a', [[18, 5, 2, 2]]);
    px(x, 'rgba(255,240,180,.55)', [[3, 12, 18, 1]]);
  }

  function drawNote(x) {
    px(x, 'rgba(0,0,0,.55)', [[2, 3, 16, 19]]);
    px(x, '#c9d3b7', [[3, 2, 14, 19], [4, 1, 12, 1]]);
    px(x, '#e4ecd8', [[4, 3, 12, 17]]);
    px(x, 'rgba(70,80,58,.75)', [[6, 6, 8, 1], [6, 9, 6, 1], [6, 12, 9, 1], [6, 15, 5, 1]]);
    px(x, 'rgba(70,80,58,.45)', [[6, 7, 9, 1], [6, 10, 8, 1], [6, 13, 4, 1], [6, 16, 7, 1]]);
    px(x, '#ff5a3d', [[14, 17, 2, 2]]);
  }

  function drawGate(x) {
    // threshold
    px(x, '#050505', [[4, 64, 48, 8]]);
    px(x, 'rgba(255,255,255,.5)', [[8, 62, 40, 2]]);
    // arch
    px(x, '#0b0b0b', [[4, 10, 48, 56], [8, 4, 40, 10]]);
    px(x, '#232323', [[6, 12, 44, 52], [10, 6, 36, 8]]);
    px(x, 'rgba(255,255,255,.35)', [[7, 12, 2, 52], [10, 7, 36, 2]]);
    // energy interior
    px(x, 'rgba(255,255,255,.12)', [[11, 14, 34, 48]]);
    for (let i = 0; i < 8; i++) {
      const yy = 16 + i * 6;
      px(x, 'rgba(255,255,255,.5)', [[13 + (i % 3) * 3, yy, 30 - (i % 4) * 4, 1]]);
    }
    px(x, 'rgba(255,255,255,.14)', [[16, 14, 8, 48], [32, 14, 6, 48]]);
    // runes
    px(x, '#ffffff', [[8, 18, 2, 2], [48, 22, 1, 3], [8, 44, 1, 4], [47, 50, 2, 2]]);
    glowPixels(x, '#ffffff', [[5, 8, 1], [50, 10, 1], [25, 66, 1], [40, 4, 1]], 0.35);
  }

  function drawTerminal(x) {
    // pedestal
    px(x, 'rgba(2,5,3,.75)', [[9, 55, 30, 8]]);
    px(x, '#20281f', [[12, 50, 24, 8]]);
    px(x, '#0a0e0a', [[7, 12, 34, 41]]);
    px(x, '#39463a', [[9, 14, 30, 37]]);
    px(x, '#536656', [[10, 15, 28, 2], [10, 48, 28, 2], [10, 15, 2, 35]]);
    // screen
    px(x, '#04120b', [[12, 18, 24, 24]]);
    px(x, 'rgba(126,255,172,.16)', [[13, 19, 22, 22]]);
    for (let i = 0; i < 7; i++) {
      const w = 5 + ((i * 7) % 15);
      px(x, i === 0 ? 'rgba(190,255,210,.95)' : 'rgba(126,255,172,.65)', [[15, 21 + i * 3, w, 1]]);
    }
    px(x, 'rgba(126,255,172,.95)', [[32, 36, 2, 3]]);
    // keyboard deck
    px(x, '#0b100b', [[13, 44, 22, 5]]);
    for (let i = 0; i < 6; i++) px(x, 'rgba(158,196,150,.45)', [[15 + i * 3, 45, 2, 1]]);
    // indicator lamps
    px(x, '#b7ff7a', [[11, 16, 2, 1]]);
    px(x, '#ffb24a', [[34, 16, 2, 1]]);
    px(x, 'rgba(255,255,255,.12)', [[20, 8, 8, 2], [23, 4, 2, 4]]);
    glowPixels(x, '#b7ff7a', [[14, 20, 1], [30, 20, 1], [18, 30, 1], [12, 55, 1], [36, 55, 1]], 0.4);
  }

  function drawPlayerBody(x, frame) {
    const accent = theme && theme.accent ? theme.accent : '#b8ff5a';
    const accent2 = theme && theme.accent2 ? theme.accent2 : '#ff4b45';
    const sway = frame === 0 ? 0 : 1;
    // legs / boots
    px(x, '#070b08', [[12, 36, 5, 14], [20, 36, 5, 14]]);
    px(x, '#1c271e', [[12 + sway, 37, 4, 11], [20 - sway, 37, 4, 11]]);
    px(x, '#0b110c', [[9 + sway, 47, 8, 4], [19 - sway, 47, 8, 4]]);
    px(x, '#2b382c', [[9 + sway, 48, 7, 2], [20 - sway, 48, 7, 2]]);
    px(x, accent, [[14 + sway, 46, 1, 1], [21 - sway, 46, 1, 1]]);
    // torso / jacket
    px(x, '#070b08', [[8, 20, 20, 18], [10, 18, 16, 4]]);
    px(x, '#1d2a20', [[9, 21, 18, 16], [11, 19, 14, 3]]);
    px(x, '#2e3f31', [[10, 22, 6, 14], [20, 22, 6, 14]]);
    px(x, '#0a100b', [[17, 21, 2, 15]]);
    px(x, accent, [[17, 24, 1, 2], [17, 29, 1, 2], [17, 34, 1, 2]]);
    // shoulders and arms
    px(x, '#111a13', [[5, 21, 4, 6], [27, 21, 4, 6]]);
    px(x, '#0d140e', [[4, 26, 4, 12], [28, 26, 4, 12]]);
    px(x, '#263527', [[5, 27, 3, 9], [28, 27, 3, 9]]);
    px(x, '#3c503c', [[4, 37, 4, 3], [28, 37, 4, 3]]);
    // head from behind
    px(x, '#070b08', [[12, 7, 12, 12], [10, 10, 16, 8]]);
    px(x, '#26352a', [[13, 8, 10, 10]]);
    px(x, '#344737', [[14, 7, 8, 4]]);
    px(x, '#0b110c', [[15, 17, 6, 3]]);
    // headset band / antenna
    px(x, accent, [[11, 10, 1, 4], [24, 10, 1, 4], [12, 9, 12, 1]]);
    px(x, '#4a5f49', [[26, 5, 1, 4]]);
    px(x, accent2, [[27, 4, 1, 1], [26, 8, 1, 1]]);
    // blade on back
    px(x, '#050805', [[9, 17, 3, 17]]);
    px(x, '#73896c', [[10, 18, 1, 15]]);
    px(x, accent, [[10, 18, 1, 3], [10, 31, 1, 2]]);
    // backpack / core module
    px(x, '#0b110c', [[22, 24, 7, 10]]);
    px(x, '#334434', [[23, 25, 5, 8]]);
    px(x, accent, [[24, 26, 1, 1], [27, 26, 1, 1]]);
    px(x, accent2, [[24, 30, 3, 1]]);
    glowPixels(x, accent2, [[26, 4, 1], [17, 29, 1], [25, 31, 1]], 0.5);
  }

  function drawHurt(x) {
    x.strokeStyle = 'rgba(255,80,80,.7)';
    x.lineWidth = 2;
    x.beginPath();
    x.arc(12, 12, 9, 0, Math.PI * 2);
    x.stroke();
    x.fillStyle = 'rgba(255,80,80,.5)';
    x.fillRect(11, 2, 2, 6);
    x.fillRect(11, 16, 2, 6);
  }


  // ---------------------------------------------------------------- weapon viewmodel
  function renderWeapon(state) {
    if (!vmctx) return;
    vmctx.clearRect(0, 0, W, H);
    if (!state || state.hidden) return;
    const t = state.time || performance.now() / 1000;
    const w = state.weapon || 0;
    const accent = theme.accent;
    const accent2 = theme.accent2 || theme.accent;
    const metalDark = '#060907';
    const metal = '#1a211b';
    const metalMid = '#354136';
    const metalLight = '#667a63';
    const glove = '#0b100c';
    const gloveLight = '#2c3b2e';
    const swayX = (state.swayX || 0) * 7 + Math.sin(t * 1.1) * 1.6;
    const swayY = (state.swayY || 0) * 5 + Math.sin(t * 2.13) * 1.3;
    const recoil = state.fire || 0;
    const swing = state.swing || 0;
    const switchDrop = (state.switch || 0) * 190;
    const heat = clamp(state.heat || 0, 0, 1);

    vmctx.save();
    vmctx.translate(swayX + recoil * 4, swayY + recoil * 5 + switchDrop);

    if (w === 0) {
      // ---- DATA BLADE ----
      const pivotX = 406;
      const pivotY = 245;
      const angle = -0.17 - swing * 1.32 + Math.sin(t * 1.4) * 0.015;
      vmctx.save();
      vmctx.translate(pivotX, pivotY);
      vmctx.rotate(angle);
      // motion trail
      if (swing > 0.02) {
        vmctx.save();
        vmctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          vmctx.strokeStyle = rgba(accent, 0.10 + swing * (0.10 - i * 0.02));
          vmctx.lineWidth = 10 - i * 2;
          vmctx.beginPath();
          vmctx.arc(0, 20, 155 - i * 12, -0.55, 0.5);
          vmctx.stroke();
        }
        vmctx.restore();
      }
      // arm and glove
      const armRects = [
        [-2, 18, 52, 22], [20, 30, 66, 24], [50, 26, 38, 30],
      ];
      for (const r of armRects) { vmctx.fillStyle = glove; vmctx.fillRect(r[0], r[1], r[2], r[3]); }
      vmctx.fillStyle = gloveLight;
      vmctx.fillRect(18, 34, 44, 4);
      vmctx.fillRect(50, 30, 18, 3);
      vmctx.fillStyle = rgba(accent, 0.2);
      vmctx.fillRect(24, 40, 28, 1);
      // grip
      vmctx.fillStyle = metalDark;
      vmctx.fillRect(-10, -14, 18, 44);
      vmctx.fillStyle = metalMid;
      vmctx.fillRect(-7, -12, 10, 38);
      vmctx.fillStyle = accent;
      vmctx.fillRect(-5, -3, 5, 2);
      vmctx.fillRect(-5, 7, 5, 2);
      // garde
      vmctx.fillStyle = metalLight;
      vmctx.fillRect(-26, -25, 42, 9);
      vmctx.fillStyle = metalDark;
      vmctx.fillRect(-24, -23, 38, 3);
      // blade
      vmctx.save();
      vmctx.translate(-12, -22);
      vmctx.beginPath();
      vmctx.moveTo(0, 0);
      vmctx.lineTo(-138, -77);
      vmctx.lineTo(-154, -74);
      vmctx.lineTo(-140, -64);
      vmctx.lineTo(0, 10);
      vmctx.closePath();
      vmctx.fillStyle = metalDark;
      vmctx.fill();
      vmctx.beginPath();
      vmctx.moveTo(-2, -2);
      vmctx.lineTo(-134, -73);
      vmctx.lineTo(-146, -72);
      vmctx.lineTo(-137, -63);
      vmctx.lineTo(-2, 6);
      vmctx.closePath();
      vmctx.fillStyle = shade(accent, 0.58);
      vmctx.fill();
      vmctx.strokeStyle = rgba(accent, 0.85);
      vmctx.lineWidth = 2;
      vmctx.beginPath();
      vmctx.moveTo(-4, -4);
      vmctx.lineTo(-141, -74);
      vmctx.stroke();
      vmctx.strokeStyle = 'rgba(255,255,255,.7)';
      vmctx.lineWidth = 1;
      vmctx.beginPath();
      vmctx.moveTo(-8, -6);
      vmctx.lineTo(-137, -72);
      vmctx.stroke();
      vmctx.fillStyle = rgba(accent, 0.6);
      vmctx.fillRect(-44, -20, 26, 2);
      vmctx.fillRect(-81, -42, 18, 2);
      vmctx.restore();
      // charge light on grip
      vmctx.fillStyle = rgba(accent, 0.35 + Math.sin(t * 5) * 0.1);
      vmctx.fillRect(-20, -21, 6, 2);
      vmctx.restore();
    } else if (w === 1) {
      // ---- SECTOR RIFLE ----
      const kick = recoil * 16;
      vmctx.save();
      vmctx.translate(-kick * 0.55, kick * 0.22);
      // stock / rear
      vmctx.fillStyle = metalDark;
      vmctx.fillRect(430, 201, 50, 30);
      vmctx.fillRect(445, 228, 34, 42);
      vmctx.fillStyle = metal;
      vmctx.fillRect(438, 205, 38, 20);
      vmctx.fillRect(452, 230, 22, 34);
      // hands
      vmctx.fillStyle = glove;
      vmctx.fillRect(424, 228, 30, 34);
      vmctx.fillStyle = gloveLight;
      vmctx.fillRect(430, 234, 18, 3);
      vmctx.fillRect(430, 245, 12, 2);
      // body
      vmctx.fillStyle = metalDark;
      vmctx.fillRect(318, 190, 126, 37);
      vmctx.fillRect(336, 177, 95, 17);
      vmctx.fillRect(300, 196, 26, 22);
      vmctx.fillStyle = metal;
      vmctx.fillRect(324, 194, 112, 26);
      vmctx.fillStyle = metalMid;
      vmctx.fillRect(336, 181, 84, 9);
      vmctx.fillRect(330, 199, 94, 5);
      vmctx.fillStyle = metalLight;
      vmctx.fillRect(338, 183, 56, 2);
      vmctx.fillRect(328, 198, 20, 1);
      // barrel
      vmctx.fillStyle = metalDark;
      vmctx.fillRect(254, 194, 54, 15);
      vmctx.fillRect(248, 197, 10, 10);
      vmctx.fillStyle = metalMid;
      vmctx.fillRect(260, 198, 48, 7);
      vmctx.fillStyle = metalLight;
      vmctx.fillRect(263, 199, 40, 2);
      vmctx.fillStyle = metalDark;
      vmctx.fillRect(246, 196, 4, 13);
      // top sight
      vmctx.fillStyle = metalDark;
      vmctx.fillRect(371, 172, 4, 7);
      vmctx.fillRect(367, 170, 12, 3);
      vmctx.fillStyle = rgba(accent, 0.8);
      vmctx.fillRect(372, 171, 2, 2);
      // vents
      vmctx.fillStyle = metalDark;
      for (let i = 0; i < 5; i++) vmctx.fillRect(345 + i * 10, 208, 6, 8);
      // energy coil
      const pulse = 0.45 + heat * 0.5 + Math.sin(t * 7) * 0.08;
      vmctx.fillStyle = rgba(accent, pulse);
      for (let i = 0; i < 6; i++) vmctx.fillRect(349 + i * 8, 205, 3, 2);
      vmctx.fillStyle = rgba(accent, 0.22 + heat * 0.4);
      vmctx.fillRect(346, 204, 56, 4);
      // heat glow near muzzle
      if (heat > 0.7) {
        vmctx.fillStyle = rgba(accent2, (heat - 0.7) * 1.4);
        vmctx.fillRect(266, 201, 30, 1);
      }
      // grip
      vmctx.fillStyle = metalDark;
      vmctx.fillRect(392, 220, 22, 46);
      vmctx.fillStyle = metalMid;
      vmctx.fillRect(395, 223, 12, 38);
      // left hand under barrel
      vmctx.fillStyle = glove;
      vmctx.fillRect(286, 207, 48, 28);
      vmctx.fillRect(300, 228, 26, 28);
      vmctx.fillStyle = gloveLight;
      vmctx.fillRect(294, 213, 30, 4);
      vmctx.fillRect(294, 223, 22, 3);
      vmctx.fillStyle = rgba(accent, 0.22);
      vmctx.fillRect(298, 234, 18, 1);
      // receiver detail
      vmctx.fillStyle = rgba(accent, 0.55);
      vmctx.fillRect(410, 201, 10, 2);
      vmctx.fillStyle = metalDark;
      vmctx.fillRect(408, 205, 14, 8);
      vmctx.fillStyle = rgba(accent2, 0.5 + Math.sin(t * 3) * 0.1);
      vmctx.fillRect(412, 207, 4, 4);
      vmctx.restore();
    } else {
      // ---- CORE MACHINE / SHOTGUN ----
      const kick = recoil * 22;
      vmctx.save();
      vmctx.translate(-kick * 0.45, kick * 0.55);
      // rear body
      vmctx.fillStyle = metalDark;
      vmctx.fillRect(350, 193, 122, 50);
      vmctx.fillRect(404, 226, 48, 44);
      vmctx.fillStyle = metal;
      vmctx.fillRect(358, 198, 104, 36);
      vmctx.fillStyle = metalMid;
      vmctx.fillRect(374, 204, 68, 21);
      // twin barrels
      vmctx.fillStyle = metalDark;
      vmctx.fillRect(250, 192, 116, 22);
      vmctx.fillRect(250, 218, 116, 20);
      vmctx.fillStyle = metalMid;
      vmctx.fillRect(258, 196, 100, 13);
      vmctx.fillRect(258, 221, 100, 13);
      vmctx.fillStyle = metalLight;
      vmctx.fillRect(262, 198, 80, 2);
      vmctx.fillRect(262, 223, 80, 2);
      vmctx.fillStyle = rgba(accent, 0.7);
      vmctx.fillRect(252, 200, 4, 4);
      vmctx.fillRect(252, 226, 4, 4);
      // muzzle ring
      vmctx.fillStyle = metalDark;
      vmctx.fillRect(240, 190, 12, 24);
      vmctx.fillRect(240, 218, 12, 22);
      vmctx.fillStyle = metalLight;
      vmctx.fillRect(243, 196, 4, 10);
      vmctx.fillRect(243, 223, 4, 10);
      // glowing core
      const pulse = 0.55 + Math.sin(t * 4.5) * 0.12 + heat * 0.25;
      const coreColor = heat > 0.5 ? accent2 : accent;
      vmctx.fillStyle = rgba(coreColor, 0.14 + pulse * 0.2);
      vmctx.fillRect(356, 211, 76, 20);
      vmctx.fillStyle = rgba(coreColor, pulse);
      vmctx.fillRect(378, 215, 32, 10);
      vmctx.fillStyle = '#ffffff';
      vmctx.fillRect(390, 217, 7, 5);
      vmctx.fillStyle = rgba(coreColor, 0.4);
      vmctx.fillRect(367, 217, 7, 6);
      vmctx.fillRect(414, 217, 7, 6);
      // ribs
      vmctx.fillStyle = metalDark;
      for (let i = 0; i < 4; i++) {
        vmctx.fillRect(366 + i * 22, 208, 4, 16);
      }
      // grip and hands
      vmctx.fillStyle = metalDark;
      vmctx.fillRect(414, 224, 26, 48);
      vmctx.fillStyle = metalMid;
      vmctx.fillRect(418, 228, 14, 38);
      vmctx.fillStyle = glove;
      vmctx.fillRect(282, 206, 54, 30);
      vmctx.fillRect(296, 230, 32, 30);
      vmctx.fillStyle = gloveLight;
      vmctx.fillRect(290, 212, 34, 4);
      vmctx.fillRect(292, 223, 24, 3);
      vmctx.fillStyle = glove;
      vmctx.fillRect(420, 230, 30, 38);
      vmctx.fillStyle = gloveLight;
      vmctx.fillRect(426, 236, 18, 3);
      // pump
      vmctx.fillStyle = metalDark;
      vmctx.fillRect(300, 236, 72, 14);
      vmctx.fillStyle = metalMid;
      vmctx.fillRect(306, 239, 58, 7);
      vmctx.fillStyle = rgba(accent, 0.3);
      vmctx.fillRect(310, 241, 8, 1);
      vmctx.restore();
    }
    vmctx.restore();

    // muzzle flash
    const flash = state.flash || 0;
    if (flash > 0.01 && w > 0) {
      const mx = (w === 1 ? 248 : 242) + swayX + recoil * 4;
      const my = (w === 1 ? 200 : 213) + swayY + recoil * 5;
      const rnd = mulberry32(Math.floor(t * 60));
      vmctx.save();
      vmctx.globalCompositeOperation = 'lighter';
      const grad = vmctx.createRadialGradient(mx, my, 0, mx, my, w === 2 ? 80 : 56);
      const c = hexRgb(accent);
      grad.addColorStop(0, `rgba(255,255,235,${0.8 * flash})`);
      grad.addColorStop(0.18, `rgba(${c[0]},${c[1]},${c[2]},${0.55 * flash})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      vmctx.fillStyle = grad;
      vmctx.beginPath();
      vmctx.arc(mx, my, w === 2 ? 80 : 56, 0, Math.PI * 2);
      vmctx.fill();
      vmctx.fillStyle = `rgba(255,246,208,${0.9 * flash})`;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + rnd() * 0.5;
        const len = (w === 2 ? 38 : 24) * (0.5 + rnd());
        const width = 2 + rnd() * 3;
        vmctx.save();
        vmctx.translate(mx, my);
        vmctx.rotate(a);
        vmctx.fillRect(6, -width / 2, len, width);
        vmctx.restore();
      }
      vmctx.fillStyle = `rgba(255,255,255,${0.85 * flash})`;
      vmctx.fillRect(mx - 8, my - 3, 16, 6);
      vmctx.fillRect(mx - 4, my - 7, 8, 14);
      vmctx.restore();
    }

    // low ammo / overheat warning flicker on gun
    if (heat > 0.88) {
      vmctx.save();
      vmctx.globalCompositeOperation = 'lighter';
      vmctx.fillStyle = `rgba(255,60,40,${0.08 + Math.sin(t * 20) * 0.05})`;
      vmctx.fillRect(0, 0, W, H);
      vmctx.restore();
    }
  }

  // ---------------------------------------------------------------- rendering
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function shadeAt(distance, cellLight, ceiling) {
    const baseLight = theme.light;
    const falloff = ceiling ? 1.45 : 1.15;
    let s = 1.32 - distance * theme.fog * 0.75 * falloff;
    s = clamp(s, 0.15, 1.45) * baseLight * flicker;
    s *= 0.52 + (cellLight == null ? 1 : cellLight) * 0.55;
    s += clamp(1 - distance / 7, 0, 1) * 0.16;
    return flyShade(clamp(s, 0.08, 1.55));
  }

  function flashAt(camera, distance) {
    if (!flashEnabled || flashStrength <= 0) return 0;
    const cone = Math.max(0, 1 - Math.abs(camera) * 1.22);
    const reach = Math.max(0, 1 - distance / 10.5);
    return (0.08 + cone * cone * 1.05) * reach * flashStrength;
  }

  function flyShade(s) {
    return s;
  }

  function writePixel(idx, tex, tx, ty, s, tint, flash) {
    const c = tex[ty * 64 + tx];
    const a = c >>> 24;
    if (a < 4) return;
    let r = c & 255;
    let g = (c >>> 8) & 255;
    let b = (c >>> 16) & 255;
    r *= s; g *= s; b *= s;
    if (tint) {
      r *= tint[0]; g *= tint[1]; b *= tint[2];
    }
    if (flash > 0) {
      r += (255 - r) * flash;
      g += (235 - g) * flash;
      b += (225 - b) * flash;
    }
    r = r > 255 ? 255 : r | 0;
    g = g > 255 ? 255 : g | 0;
    b = b > 255 ? 255 : b | 0;
    data[idx] = 0xff000000 | (b << 16) | (g << 8) | r;
  }

  function render(state) {
    if (!map || !theme) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    frameNo++;
    const p = state.player || { x: 1.5, y: 1.5, angle: 0, pitch: 0, z: 0, bob: 0 };

    // atmospheric light flicker
    const noise = Math.sin(now * 0.011) * Math.sin(now * 0.0047 + 1.2);
    flicker = 0.94 + noise * 0.035 + (Math.random() - 0.5) * 0.018;
    if (Math.random() < 0.0035) flicker *= 0.55;
    if (state.power) flicker *= 0.55;

    // Flashlight: a narrow forward cone that brightens nearby geometry.  The
    // raycaster works per screen column, so the cone is derived from the
    // camera-space x coordinate of each column.
    flashEnabled = Boolean(state.flashlight);
    flashStrength = clamp(state.flashlightLevel == null ? 1 : state.flashlightLevel, 0, 1);

    updateParticles(dt);

    const dirX = Math.cos(p.angle);
    const dirY = Math.sin(p.angle);
    const planeX = -dirY * FOV;
    const planeY = dirX * FOV;
    const jump = p.z || 0;
    const bob = p.bob || 0;
    const pitch = p.pitch || 0;
    const horizon = H / 2 + pitch + bob + jump * H * 0.72;

    const posX = p.x;
    const posY = p.y;
    const rayDirX0 = dirX - planeX;
    const rayDirY0 = dirY - planeY;
    const rayDirX1 = dirX + planeX;
    const rayDirY1 = dirY + planeY;

    const useSky = Boolean(skyTex && theme && theme.sky);
    if (useSky) {
      for (let x = 0; x < W; x++) {
        const cameraX = (2 * x) / W - 1;
        const a = Math.atan2(dirY + planeY * cameraX, dirX + planeX * cameraX);
        const u = ((a / (Math.PI * 2)) + 1) % 1;
        skyCols[x] = Math.min(skyTex.w - 1, Math.floor(u * skyTex.w));
      }
    }
    const skyLight = (0.82 + flicker * 0.18) * (theme && theme.light > 1 ? 1.04 : 0.94);

    // ---------- ceiling and floor (2x2 blocks for chunky pixels) ----------
    for (let y = 0; y < H; y += 2) {
      const isFloor = y > horizon;
      if (!isFloor && useSky) {
        const t = clamp((horizon - y) / Math.max(1, horizon), 0, 1);
        const sy = Math.min(skyTex.h - 1, Math.max(0, Math.floor((1 - t) * skyTex.h)));
        const off = sy * skyTex.w;
        for (let x = 0; x < W; x += 2) {
          const c = skyTex.data[off + skyCols[x]];
          let r = (c & 255) * skyLight;
          let g = ((c >>> 8) & 255) * skyLight;
          let b = ((c >>> 16) & 255) * skyLight;
          if (r > 255) r = 255;
          if (g > 255) g = 255;
          if (b > 255) b = 255;
          const col = 0xff000000 | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0);
          const idx0 = y * W + x;
          data[idx0] = col;
          if (x + 1 < W) data[idx0 + 1] = col;
          if (y + 1 < H) {
            data[idx0 + W] = col;
            if (x + 1 < W) data[idx0 + W + 1] = col;
          }
        }
        continue;
      }
      const rowDist = isFloor
        ? (0.5 * H) / Math.max(0.5, y - horizon)
        : (0.5 * H) / Math.max(0.5, horizon - y);
      if (rowDist > 34) {
        // far away: clear to fog
        fillRow(y, y + 1, 0xff000000);
        continue;
      }
      const stepX = rowDist * (rayDirX1 - rayDirX0) * 2 / W;
      const stepY = rowDist * (rayDirY1 - rayDirY0) * 2 / W;
      let fx = posX + rowDist * rayDirX0;
      let fy = posY + rowDist * rayDirY0;
      for (let x = 0; x < W; x += 2) {
        const cameraCol = (2 * x) / W - 1;
        const flashLight = flashAt(cameraCol, rowDist);
        const cx = Math.floor(fx);
        const cy = Math.floor(fy);
        let tex = isFloor ? floorTex : ceilTex;
        let extraLight = 1;
        if (cx >= 0 && cy >= 0 && cx < mapW && cy < mapH) {
          const ch = map[cy][cx];
          if (isFloor && ch === '~') {
            tex = hazardTex;
            extraLight = 1.35 + Math.sin(now * 0.004 + (cx + cy) * 0.8) * 0.38;
          }
        }
        const cellLight = (cx >= 0 && cy >= 0 && cx < mapW && cy < mapH)
          ? lightGrid[cy * mapW + cx]
          : 0.65;
        const s = shadeAt(rowDist, cellLight * extraLight, !isFloor) * (isFloor ? 1.04 : 0.72) * (1 + flashLight * 1.55);
        const tx = ((fx * 64) | 0) & 63;
        const ty = ((fy * 64) | 0) & 63;
        const c = tex[ty * 64 + tx];
        let r = (c & 255) * s;
        let g = ((c >>> 8) & 255) * s;
        let b = ((c >>> 16) & 255) * s;
        if (r > 255) r = 255;
        if (g > 255) g = 255;
        if (b > 255) b = 255;
        const col = 0xff000000 | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0);
        const idx0 = y * W + x;
        data[idx0] = col;
        if (x + 1 < W) data[idx0 + 1] = col;
        if (y + 1 < H) {
          data[idx0 + W] = col;
          if (x + 1 < W) data[idx0 + W + 1] = col;
        }
        fx += stepX;
        fy += stepY;
      }
    }

    // ---------- walls ----------
    for (let x = 0; x < W; x++) {
      const cameraX = (2 * x) / W - 1;
      const rayDirX = dirX + planeX * cameraX;
      const rayDirY = dirY + planeY * cameraX;
      let mapX = Math.floor(posX);
      let mapY = Math.floor(posY);
      const deltaDistX = Math.abs(1 / (rayDirX || 0.00001));
      const deltaDistY = Math.abs(1 / (rayDirY || 0.00001));
      let stepX;
      let stepY;
      let sideDistX;
      let sideDistY;
      if (rayDirX < 0) { stepX = -1; sideDistX = (posX - mapX) * deltaDistX; }
      else { stepX = 1; sideDistX = (mapX + 1 - posX) * deltaDistX; }
      if (rayDirY < 0) { stepY = -1; sideDistY = (posY - mapY) * deltaDistY; }
      else { stepY = 1; sideDistY = (mapY + 1 - posY) * deltaDistY; }

      let hit = 0;
      let side = 0;
      let ch = '#';
      for (let i = 0; i < 80; i++) {
        if (sideDistX < sideDistY) {
          sideDistX += deltaDistX;
          mapX += stepX;
          side = 0;
        } else {
          sideDistY += deltaDistY;
          mapY += stepY;
          side = 1;
        }
        if (mapX < 0 || mapY < 0 || mapX >= mapW || mapY >= mapH) { hit = 2; break; }
        ch = map[mapY][mapX];
        if (isWallCell(ch)) { hit = 1; break; }
      }
      if (!hit) { zbuf[x] = 40; continue; }
      const perp = side === 0
        ? (mapX - posX + (1 - stepX) / 2) / (rayDirX || 0.00001)
        : (mapY - posY + (1 - stepY) / 2) / (rayDirY || 0.00001);
      const depth = Math.max(0.05, perp);
      zbuf[x] = depth;
      let lineH = H / depth;
      const drawStart = -lineH / 2 + horizon;
      const drawEnd = lineH / 2 + horizon;
      let texIndex = (mapX * 11 + mapY * 7) % 3;
      if (ch === '%') texIndex = 1;
      if (ch === '+') texIndex = 2;
      if (ch === 'D') texIndex = 1;
      if (ch === 'L') texIndex = 2;
      const tex = wallTex[texIndex] || wallTex[0];
      let wallX = side === 0 ? posY + perp * rayDirY : posX + perp * rayDirX;
      wallX -= Math.floor(wallX);
      let texX = Math.floor(wallX * 64);
      if ((side === 0 && rayDirX > 0) || (side === 1 && rayDirY < 0)) texX = 63 - texX;
      const cellLight = (mapX >= 0 && mapY >= 0 && mapX < mapW && mapY < mapH)
        ? lightGrid[mapY * mapW + mapX]
        : 0.75;
      const flashLight = flashAt(cameraX, depth);
      let s = shadeAt(depth, cellLight, false) * (1 + flashLight * 1.9);
      if (side === 1) s *= 0.82;
      if (ch === 'L') s *= 0.82;
      if (state.muzzle > 0 && depth < 7) s += state.muzzle * (1 - depth / 7) * 0.5;
      const step = 64 / lineH;
      let texPos = (drawStart < 0 ? -drawStart : 0) * step;
      const y0 = Math.max(0, Math.floor(drawStart));
      const y1 = Math.min(H - 1, Math.ceil(drawEnd));
      for (let y = y0; y <= y1; y++) {
        const ty = Math.min(63, Math.max(0, Math.floor(texPos)));
        texPos += step;
        const c = tex[ty * 64 + texX];
        let r = (c & 255) * s;
        let g = ((c >>> 8) & 255) * s;
        let b = ((c >>> 16) & 255) * s;
        if (r > 255) r = 255;
        if (g > 255) g = 255;
        if (b > 255) b = 255;
        data[y * W + x] = 0xff000000 | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0);
      }
    }

    // ---------- sprites and objects ----------
    const items = state.sprites || [];
    const list = [];
    for (const it of items) {
      if (!it || it.alpha === 0) continue;
      const dx = it.x - posX;
      const dy = it.y - posY;
      const dist = dx * dx + dy * dy;
      list.push({ it, dist });
    }
    list.sort((a, b) => b.dist - a.dist);
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    for (const { it } of list) {
      drawSprite(it, posX, posY, dirX, dirY, planeX, planeY, invDet, horizon, state, dt);
    }

    // ---------- particles ----------
    for (const part of particles) {
      const dx = part.x - posX;
      const dy = part.y - posY;
      const tx = invDet * (dirY * dx - dirX * dy);
      const ty = invDet * (-planeY * dx + planeX * dy);
      if (ty <= 0.12) continue;
      const sx = (W / 2) * (1 + tx / ty);
      if (sx < 0 || sx >= W) continue;
      const sy = horizon + (0.5 - part.z) * H / ty;
      if (sy < 0 || sy >= H) continue;
      const size = Math.max(1, Math.floor(part.size * H / ty));
      const alpha = clamp(part.life / (part.maxLife || 1), 0, 1);
      const col = hexRgb(part.color);
      const shade = clamp(1.2 - ty * theme.fog, 0.25, 1.1) * (0.6 + alpha * 0.7);
      for (let yy = 0; yy < size; yy++) {
        for (let xx = 0; xx < size; xx++) {
          const px2 = Math.floor(sx) + xx - (size >> 1);
          const py2 = Math.floor(sy) + yy;
          if (px2 < 0 || px2 >= W || py2 < 0 || py2 >= H) continue;
          if (ty > zbuf[px2]) continue;
          const idx = py2 * W + px2;
          const dest = data[idx];
          let dr = (dest & 255) + col[0] * alpha * shade;
          let dg = ((dest >>> 8) & 255) + col[1] * alpha * shade;
          let db = ((dest >>> 16) & 255) + col[2] * alpha * shade;
          if (dr > 255) dr = 255;
          if (dg > 255) dg = 255;
          if (db > 255) db = 255;
          data[idx] = 0xff000000 | ((db | 0) << 16) | ((dg | 0) << 8) | (dr | 0);
        }
      }
    }

    applyGlitchPass();
    vctx.putImageData(image, 0, 0);

    // muzzle light wash
    if (state.muzzle > 0.01) {
      const mx = W * 0.68;
      const my = H * 0.62;
      const grad = vctx.createRadialGradient(mx, my, 4, mx, my, 170);
      const ac = hexRgb(theme.accent2 || theme.accent);
      grad.addColorStop(0, `rgba(255,240,210,${state.muzzle * 0.55})`);
      grad.addColorStop(0.25, `rgba(${ac[0]},${ac[1]},${ac[2]},${state.muzzle * 0.2})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      vctx.save();
      vctx.globalCompositeOperation = 'lighter';
      vctx.fillStyle = grad;
      vctx.fillRect(0, 0, W, H);
      vctx.restore();
    }

    // low resolution bloom
    if (frameNo % 2 === 0) {
      bctx.imageSmoothingEnabled = true;
      bctx.globalCompositeOperation = 'source-over';
      bctx.clearRect(0, 0, 240, 135);
      bctx.drawImage(view, 0, 0, 240, 135);
    }

    // debug hitboxes are drawn after bloom so they stay crisp
    if (Array.isArray(state.hitboxes)) {
      drawDebugOverlay(state, posX, posY, dirX, dirY, planeX, planeY, invDet, horizon);
    }
  }

  function projectDebugPoint(wx, wy, wz, posX, posY, dirX, dirY, planeX, planeY, invDet, horizon) {
    const dx = wx - posX;
    const dy = wy - posY;
    const tx = invDet * (dirY * dx - dirX * dy);
    const ty = invDet * (-planeY * dx + planeX * dy);
    if (ty <= 0.08) return null;
    return {
      x: (W / 2) * (1 + tx / ty),
      y: horizon + (0.5 - wz) * H / ty,
      d: ty,
    };
  }

  function drawWallDebugBoxes(ctx, posX, posY, dirX, dirY, planeX, planeY, invDet, horizon) {
    const radius = 7.5;
    const cells = [];
    const x0 = Math.max(0, Math.floor(posX - radius));
    const x1 = Math.min(mapW - 1, Math.ceil(posX + radius));
    const y0 = Math.max(0, Math.floor(posY - radius));
    const y1 = Math.min(mapH - 1, Math.ceil(posY + radius));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!isWallCell(map[y][x])) continue;
        const d = Math.hypot(x + 0.5 - posX, y + 0.5 - posY);
        if (d < radius) cells.push({ x: x + 0.5, y: y + 0.5, d });
      }
    }
    cells.sort((a, b) => a.d - b.d);
    const corners = [
      [-0.5, -0.5, 0], [0.5, -0.5, 0], [0.5, 0.5, 0], [-0.5, 0.5, 0],
      [-0.5, -0.5, 1], [0.5, -0.5, 1], [0.5, 0.5, 1], [-0.5, 0.5, 1],
    ];
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7],
    ];
    for (const cell of cells.slice(0, 56)) {
      const pts = [];
      let visible = false;
      for (const [ox, oy, oz] of corners) {
        const p = projectDebugPoint(cell.x + ox, cell.y + oy, oz, posX, posY, dirX, dirY, planeX, planeY, invDet, horizon);
        if (!p) { pts.length = 0; break; }
        pts.push(p);
        if (p.x > -24 && p.x < W + 24 && p.y > -24 && p.y < H + 24) visible = true;
      }
      if (!pts.length || !visible) continue;
      const alpha = clamp(1 - cell.d / radius, 0.1, 0.46);
      ctx.strokeStyle = rgba('#ff7b64', alpha);
      ctx.beginPath();
      for (const [a, b] of edges) {
        ctx.moveTo(pts[a].x, pts[a].y);
        ctx.lineTo(pts[b].x, pts[b].y);
      }
      ctx.stroke();
    }
  }

  function drawDebugBox(ctx, box, posX, posY, dirX, dirY, planeX, planeY, invDet, horizon) {
    const dx = box.x - posX;
    const dy = box.y - posY;
    const tx = invDet * (dirY * dx - dirX * dy);
    const ty = invDet * (-planeY * dx + planeX * dy);
    if (ty <= 0.12) return;
    const sx = (W / 2) * (1 + tx / ty);
    const bottom = horizon + (0.5 - (box.z || 0)) * H / ty;
    const top = bottom - (box.height || 1) * H / ty;
    const halfW = Math.max(2, (box.radius || 0.25) * H / ty);
    const left = sx - halfW;
    const right = sx + halfW;
    if (right < 0 || left > W || bottom < 0 || top > H) return;
    const color = box.color || '#b8ff5a';
    ctx.strokeStyle = rgba(color, 0.92);
    ctx.strokeRect(Math.round(left) + 0.5, Math.round(top) + 0.5, Math.max(1, Math.round(right - left)), Math.max(1, Math.round(bottom - top)));
    const midY = (top + bottom) * 0.5;
    ctx.beginPath();
    ctx.moveTo(sx - 3, midY);
    ctx.lineTo(sx + 3, midY);
    ctx.moveTo(sx, midY - 3);
    ctx.lineTo(sx, midY + 3);
    ctx.stroke();
    if (box.label && right - left >= 14 && top > 10) {
      ctx.font = '6px monospace';
      ctx.textAlign = 'center';
      const label = String(box.label);
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(0,0,0,.68)';
      ctx.fillRect(sx - tw / 2 - 2, top - 9, tw + 4, 8);
      ctx.fillStyle = '#f4ffe6';
      ctx.fillText(label, sx, top - 8);
    }
    if (box.maxHp && box.hp != null && right - left > 12) {
      const bw = Math.max(12, Math.min(52, right - left));
      const bx = sx - bw / 2;
      const by = top - 2;
      ctx.fillStyle = 'rgba(0,0,0,.72)';
      ctx.fillRect(bx, by, bw, 2);
      ctx.fillStyle = box.kind === 'boss' ? '#ff6a6a' : '#b8ff5a';
      ctx.fillRect(bx, by, bw * clamp(box.hp / box.maxHp, 0, 1), 2);
    }
  }

  function drawPlayerDebugPanel(ctx, state, posX, posY) {
    const p = state.player || {};
    const lines = [
      'HITBOX // F3',
      `POS ${posX.toFixed(2)}, ${posY.toFixed(2)}`,
      `HUCRE ${Math.floor(posX)}, ${Math.floor(posY)}`,
      `ACI ${(p.angle || 0).toFixed(2)}`,
      `HP ${Math.ceil(p.hp || 0)}`,
      `Z ${(p.z || 0).toFixed(2)}`,
    ];
    ctx.font = '6px monospace';
    ctx.textAlign = 'left';
    let tw = 0;
    for (const line of lines) tw = Math.max(tw, ctx.measureText(line).width);
    const pad = 4;
    const w = Math.max(76, Math.ceil(tw) + pad * 2);
    const h = lines.length * 7 + pad * 2;
    const x0 = 4;
    const y0 = H - h - 4;
    ctx.fillStyle = 'rgba(0,0,0,.62)';
    ctx.fillRect(x0, y0, w, h);
    ctx.strokeStyle = 'rgba(184,255,90,.45)';
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
    ctx.fillStyle = '#b8ff5a';
    ctx.fillText(lines[0], x0 + pad, y0 + pad);
    ctx.fillStyle = '#d7e8c9';
    for (let i = 1; i < lines.length; i++) {
      ctx.fillText(lines[i], x0 + pad, y0 + pad + i * 7);
    }
  }

  function drawDebugOverlay(state, posX, posY, dirX, dirY, planeX, planeY, invDet, horizon) {
    const ctx = vctx;
    ctx.save();
    ctx.lineWidth = 1;
    drawWallDebugBoxes(ctx, posX, posY, dirX, dirY, planeX, planeY, invDet, horizon);
    for (const box of state.hitboxes) {
      if (!box) continue;
      drawDebugBox(ctx, box, posX, posY, dirX, dirY, planeX, planeY, invDet, horizon);
    }
    drawPlayerDebugPanel(ctx, state, posX, posY);
    ctx.restore();
  }

  function fillRow(y0, y1, color) {
    for (let y = y0; y <= y1 && y < H; y++) {
      const off = y * W;
      for (let x = 0; x < W; x++) data[off + x] = color;
    }
  }

  function drawSprite(it, posX, posY, dirX, dirY, planeX, planeY, invDet, horizon, state, dt) {
    const dx = it.x - posX;
    const dy = it.y - posY;
    const tx = invDet * (dirY * dx - dirX * dy);
    const ty = invDet * (-planeY * dx + planeX * dy);
    if (ty <= 0.12) return;
    const key = `${it.name || 'orb'}_${it.frame || 0}`;
    const spr = spriteCache.get(key) || spriteCache.get(`${it.name || 'orb'}_0`) || spriteCache.get('orb_0');
    if (!spr) return;

    const height = (it.height != null ? it.height : 1) * (it.scale || 1);
    const screenH = height * H / ty;
    const screenW = screenH * (spr.w / spr.h) * (it.widthScale || 1);
    const center = (W / 2) * (1 + tx / ty);
    const bottom = horizon + (0.5 - (it.z || 0)) * H / ty;
    const top = bottom - screenH;
    const left = center - screenW / 2;
    if (left > W || left + screenW < 0 || top > H || bottom < 0) return;

    const tint = it.tint ? hexRgb(it.tint) : null;
    const tintMul = tint ? [tint[0] / 255, tint[1] / 255, tint[2] / 255] : [1, 1, 1];
    const flash = clamp(it.flash || 0, 0, 1);
    const alphaMul = it.alpha == null ? 1 : it.alpha;
    const additive = Boolean(it.additive);
    const distShade = clamp(1.18 - ty * theme.fog * 1.4, 0.14, 1.16) * (theme.light * 0.9 + 0.22) * (0.85 + flicker * 0.18);
    const spriteFlash = flashAt(clamp(tx / Math.max(0.2, ty), -1.4, 1.4), ty);
    const shadeMul = 1 + spriteFlash * 1.5;
    const x0 = Math.max(0, Math.floor(left));
    const x1 = Math.min(W - 1, Math.ceil(left + screenW));
    const y0 = Math.max(0, Math.floor(top));
    const y1 = Math.min(H - 1, Math.ceil(bottom));
    const spriteData = spr.data;
    const sw = spr.w;
    const sh = spr.h;
    for (let x = x0; x <= x1; x++) {
      if (ty > zbuf[x]) continue;
      const u = (x - left) / screenW;
      if (u < 0 || u >= 1) continue;
      const sx = Math.min(sw - 1, Math.floor(u * sw));
      for (let y = y0; y <= y1; y++) {
        const v = (y - top) / screenH;
        if (v < 0 || v >= 1) continue;
        const sy = Math.min(sh - 1, Math.floor(v * sh));
        const c = spriteData[sy * sw + sx];
        const a = c >>> 24;
        if (a < 6) continue;
        let r = (c & 255) * distShade * tintMul[0] * shadeMul;
        let g = ((c >>> 8) & 255) * distShade * tintMul[1] * shadeMul;
        let b = ((c >>> 16) & 255) * distShade * tintMul[2] * shadeMul;
        if (flash > 0.01) {
          r += (255 - r) * flash;
          g += (245 - g) * flash;
          b += (230 - b) * flash;
        }
        const alpha = (a / 255) * alphaMul;
        const idx = y * W + x;
        if (additive) {
          const dest = data[idx];
          let dr = (dest & 255) + r * alpha;
          let dg = ((dest >>> 8) & 255) + g * alpha;
          let db = ((dest >>> 16) & 255) + b * alpha;
          if (dr > 255) dr = 255;
          if (dg > 255) dg = 255;
          if (db > 255) db = 255;
          data[idx] = 0xff000000 | ((db | 0) << 16) | ((dg | 0) << 8) | (dr | 0);
        } else {
          const dest = data[idx];
          const dr = (dest & 255) * (1 - alpha) + r * alpha;
          const dg = ((dest >>> 8) & 255) * (1 - alpha) + g * alpha;
          const db = ((dest >>> 16) & 255) * (1 - alpha) + b * alpha;
          data[idx] = 0xff000000 | ((db | 0) << 16) | ((dg | 0) << 8) | (dr | 0);
        }
      }
    }
    if (it.shield) {
      drawShieldRing(center, ty, screenH, horizon, it);
    }
  }

  function drawShieldRing(center, ty, screenH, horizon, it) {
    const radius = screenH * 0.62;
    const cy = horizon + (0.5 - (it.z || 0)) * H / ty - screenH * 0.5;
    const color = it.shieldColor ? hexRgb(it.shieldColor) : hexRgb(theme.accent2);
    const pulse = 0.35 + Math.sin(performance.now() * 0.004) * 0.18 + (it.flash || 0) * 0.4;
    const step = radius > 26 ? 1 : 0.7;
    for (let a = 0; a < Math.PI * 2; a += 1 / Math.max(8, radius * 0.9)) {
      const sx = Math.round(center + Math.cos(a) * radius);
      const sy = Math.round(cy + Math.sin(a) * radius * 0.72);
      if (sx < 0 || sx >= W || sy < 0 || sy >= H) continue;
      if (ty > zbuf[sx] + 0.25) continue;
      const idx = sy * W + sx;
      const dest = data[idx];
      const alpha = pulse * 0.65;
      let dr = (dest & 255) + color[0] * alpha;
      let dg = ((dest >>> 8) & 255) + color[1] * alpha;
      let db = ((dest >>> 16) & 255) + color[2] * alpha;
      if (dr > 255) dr = 255;
      if (dg > 255) dg = 255;
      if (db > 255) db = 255;
      data[idx] = 0xff000000 | ((db | 0) << 16) | ((dg | 0) << 8) | (dr | 0);
    }
  }


  function burst(x, y, z, color, count, opts) {
    const o = opts || {};
    for (let i = 0; i < count; i++) {
      const a = o.angle != null ? o.angle + (Math.random() - 0.5) * (o.spread || 1.6) : Math.random() * Math.PI * 2;
      const speed = (o.speed || 1.6) * (0.35 + Math.random() * 0.9);
      particles.push({
        x, y, z: z + (Math.random() - 0.5) * 0.1,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        vz: (o.vz != null ? o.vz : 1.5) * (0.3 + Math.random() * 0.9),
        life: (o.life || 0.7) * (0.55 + Math.random() * 0.8),
        maxLife: o.life || 0.7,
        size: (o.size || 0.035) * (0.6 + Math.random() * 1.1),
        color: color || theme.accent,
        additive: o.additive !== false,
        gravity: o.gravity != null ? o.gravity : 2.6,
      });
    }
    if (particles.length > 500) particles.splice(0, particles.length - 500);
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vz -= p.gravity * dt;
      p.vx *= (1 - 1.8 * dt);
      p.vy *= (1 - 1.8 * dt);
      if (p.z < 0) { p.z = 0; p.vz *= -0.28; }
    }
  }

  return {
    init,
    setLevel,
    setCell,
    getCell,
    render: (state) => render(state),
    renderWeapon: (state) => renderWeapon(state),
    burst,
    getWidth: () => W,
    getHeight: () => H,
    theme: () => theme,
    debugInfo: () => {
      const wall = wallTex[0] && (wallTex[0].data || wallTex[0]);
      let wallAvg = 0;
      let wallMax = 0;
      if (wall) {
        let n = 0;
        for (let i = 0; i < wall.length; i += 13) {
          const v = wall[i] & 255;
          wallAvg += v;
          if (v > wallMax) wallMax = v;
          n++;
        }
        wallAvg /= Math.max(1, n);
      }
      let lightMin = 9;
      let lightMax = 0;
      let lightAvg = 0;
      if (lightGrid) {
        for (let i = 0; i < lightGrid.length; i++) {
          lightMin = Math.min(lightMin, lightGrid[i]);
          lightMax = Math.max(lightMax, lightGrid[i]);
          lightAvg += lightGrid[i];
        }
        lightAvg /= Math.max(1, lightGrid.length);
      }
      return {
        theme: theme && theme.name,
        mapW, mapH,
        wallAvg, wallMax,
        lightMin, lightMax, lightAvg,
      };
    },
  };
})();
