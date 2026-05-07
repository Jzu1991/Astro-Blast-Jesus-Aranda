// AstroBlast: Cosmic Rebound - script.js
// Alumno: Jesús Aranda

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = 360, H = 640;

// ── Estado global ──────────────────────────────────────────
let state = 'menu';          // 'menu' | 'playing' | 'win' | 'lose'
let musicOn = true, sfxOn = true;
let score = 0, comets = 10, multiplier = 1;
let asteroids = [], walls = [], particles = [];
let comet = null;
let aiming = false, aimX = W / 2, aimY = H / 2;
let paused = false, inFlight = false;
let portalX = 0, portalW = 60, portalAnim = 0;
let frameId;

const SAT_X = W / 2, SAT_Y = 55;
const PORTAL_Y = H - 22;

// ── Tipos de asteroides ────────────────────────────────────
const ASTEROID_TYPES = {
  rocky:  { color: '#5bf', hitColor: '#aef', pts: 100,  critical: false },
  orange: { color: '#fa5', hitColor: '#fdb', pts: 500,  critical: true  },
  crystal:{ color: '#5f9', hitColor: '#afd', pts: 200,  critical: false }
};

// ── Fondo de estrellas (se dibuja una sola vez en el canvas decorativo) ──
function initStarsBg() {
  const sc = document.getElementById('starsBg');
  const sctx = sc.getContext('2d');
  sctx.fillStyle = '#000820';
  sctx.fillRect(0, 0, 360, 640);
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * 360;
    const y = Math.random() * 640;
    const r = Math.random() * 1.5 + 0.3;
    const a = Math.random() * 0.8 + 0.2;
    sctx.beginPath();
    sctx.arc(x, y, r, 0, Math.PI * 2);
    sctx.fillStyle = `rgba(255,255,255,${a})`;
    sctx.fill();
  }
  // Nebulosa rosada
  const g1 = sctx.createRadialGradient(80, 200, 10, 80, 200, 120);
  g1.addColorStop(0, 'rgba(200,100,255,0.15)');
  g1.addColorStop(1, 'rgba(0,0,0,0)');
  sctx.fillStyle = g1;
  sctx.fillRect(0, 80, 360, 280);
  const g2 = sctx.createRadialGradient(300, 350, 10, 300, 350, 100);
  g2.addColorStop(0, 'rgba(100,150,255,0.12)');
  g2.addColorStop(1, 'rgba(0,0,0,0)');
  sctx.fillStyle = g2;
  sctx.fillRect(180, 250, 180, 200);
}

// ── Construcción del nivel ─────────────────────────────────
function buildLevel() {
  const layout = [
    {x:80,  y:130, type:'rocky'},  {x:140, y:130, type:'orange'}, {x:200, y:130, type:'rocky'},
    {x:260, y:130, type:'rocky'},  {x:110, y:175, type:'orange'}, {x:180, y:175, type:'rocky'},
    {x:250, y:175, type:'crystal'},{x:80,  y:220, type:'rocky'},  {x:145, y:220, type:'rocky'},
    {x:210, y:220, type:'orange'}, {x:270, y:220, type:'rocky'},  {x:90,  y:265, type:'crystal'},
    {x:160, y:265, type:'rocky'},  {x:230, y:265, type:'orange'}, {x:120, y:310, type:'rocky'},
    {x:180, y:310, type:'rocky'},  {x:245, y:310, type:'rocky'},  {x:85,  y:355, type:'orange'},
    {x:155, y:355, type:'rocky'},  {x:215, y:355, type:'crystal'},{x:275, y:355, type:'rocky'}
  ];
  asteroids = layout.map(a => ({ ...a, r: 14, hit: false, dead: false, flash: 0 }));

  // Paredes anguladas diagonales (variante de mecánica)
  walls = [
    { x1: 70,  y1: 170, x2: 130, y2: 240, hit: 0 },
    { x1: 230, y1: 160, x2: 290, y2: 230, hit: 0 },
    { x1: 60,  y1: 310, x2: 130, y2: 380, hit: 0 },
    { x1: 240, y1: 300, x2: 300, y2: 370, hit: 0 }
  ];

  portalX = W / 2 - portalW / 2;
  comets = 10; score = 0; multiplier = 1;
  comet = null; inFlight = false; aiming = false;
  particles = [];
  updateHUD();
}

// ── HUD ───────────────────────────────────────────────────
function updateHUD() {
  document.getElementById('hudScore').textContent  = score.toLocaleString();
  document.getElementById('hudComets').textContent = comets;
  document.getElementById('hudMult').textContent   = '×' + multiplier;
}

// ── Navegación de pantallas ────────────────────────────────
function startGame() {
  state = 'playing';
  document.getElementById('startScreen').classList.remove('active');
  document.getElementById('hud').style.display = 'flex';
  document.getElementById('pauseBtn').classList.add('active');
  document.getElementById('fireBtn').classList.add('active');
  buildLevel();
  loop();
}

function goMenu() {
  state = 'menu';
  hideAllScreens();
  document.getElementById('startScreen').classList.add('active');
  document.getElementById('hud').style.display = 'none';
  document.getElementById('pauseBtn').classList.remove('active');
  document.getElementById('fireBtn').classList.remove('active');
  paused = false;
  cancelAnimationFrame(frameId);
}

function restartLevel() {
  hideAllScreens();
  buildLevel();
  state = 'playing';
  paused = false;
  document.getElementById('hud').style.display = 'flex';
  document.getElementById('pauseBtn').classList.add('active');
  document.getElementById('fireBtn').classList.add('active');
  loop();
}

function hideAllScreens() {
  ['pauseScreen', 'winScreen', 'loseScreen'].forEach(id => {
    document.getElementById(id).classList.remove('active');
  });
}

function togglePause() {
  paused = !paused;
  document.getElementById('pauseBtn').textContent = paused ? '▶' : '⏸';
  if (paused) {
    document.getElementById('pauseScreen').classList.add('active');
  } else {
    document.getElementById('pauseScreen').classList.remove('active');
    loop();
  }
}

function openCfg() {
  document.getElementById('cfgPanel').classList.add('active');
}

function closeCfg() {
  document.getElementById('cfgPanel').classList.remove('active');
}

function toggleMusic() {
  musicOn = !musicOn;
  document.getElementById('tMusic').classList.toggle('on', musicOn);
}

function toggleSfx() {
  sfxOn = !sfxOn;
  document.getElementById('tSfx').classList.toggle('on', sfxOn);
}

// ── Audio (Web Audio API) ──────────────────────────────────
function beep(freq = 440, dur = 0.1, type = 'sine') {
  if (!sfxOn) return;
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.connect(g);
    g.connect(ac.destination);
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.15, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    o.start();
    o.stop(ac.currentTime + dur);
  } catch (e) {}
}

// ── Disparo ───────────────────────────────────────────────
function getAimAngle() {
  return Math.atan2(aimY - SAT_Y, aimX - SAT_X);
}

function fireComet() {
  if (inFlight || state !== 'playing' || paused) return;
  if (comets <= 0) return;
  const angle = getAimAngle();
  const spd = 9;
  comet = {
    x: SAT_X, y: SAT_Y + 20,
    vx: Math.cos(angle) * spd,
    vy: Math.sin(angle) * spd,
    r: 8, trail: []
  };
  inFlight = true;
  comets--;
  updateHUD();
  beep(880, 0.08, 'sawtooth');
}

// ── Partículas ────────────────────────────────────────────
function shootParticles(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const a  = Math.random() * Math.PI * 2;
    const sp = Math.random() * 3 + 1;
    particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 1,
      color,
      r: Math.random() * 3 + 1
    });
  }
}

// ── Física: reflexión en pared diagonal ───────────────────
function reflectOnWall(cvx, cvy, w) {
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = -dy / len, ny = dx / len;
  const dot = cvx * nx + cvy * ny;
  return { vx: cvx - 2 * dot * nx, vy: cvy - 2 * dot * ny };
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t  = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.sqrt((px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2);
}

// ── Actualización del cometa ──────────────────────────────
function updateComet() {
  if (!comet) return;

  comet.trail.push({ x: comet.x, y: comet.y });
  if (comet.trail.length > 18) comet.trail.shift();

  comet.vy += 0.18; // gravedad
  comet.x  += comet.vx;
  comet.y  += comet.vy;

  // Rebotes en paredes del campo
  if (comet.x - comet.r < 0)  { comet.x = comet.r;     comet.vx =  Math.abs(comet.vx); beep(300, 0.05); }
  if (comet.x + comet.r > W)  { comet.x = W - comet.r; comet.vx = -Math.abs(comet.vx); beep(300, 0.05); }
  if (comet.y - comet.r < 0)  { comet.y = comet.r;     comet.vy =  Math.abs(comet.vy); beep(300, 0.05); }

  // Paredes anguladas (variante de mecánica)
  walls.forEach(w => {
    if (distToSegment(comet.x, comet.y, w.x1, w.y1, w.x2, w.y2) < comet.r + 4) {
      const ref = reflectOnWall(comet.vx, comet.vy, w);
      comet.vx = ref.vx;
      comet.vy = ref.vy;
      w.hit = 8;
      shootParticles(comet.x, comet.y, '#4af', 5);
      beep(500, 0.06, 'square');
    }
  });

  // Colisión con asteroides
  asteroids.forEach(a => {
    if (a.dead) return;
    const dist = Math.sqrt((comet.x - a.x) ** 2 + (comet.y - a.y) ** 2);
    if (dist < comet.r + a.r) {
      if (!a.hit) {
        a.hit = true;
        a.flash = 12;
        const t   = ASTEROID_TYPES[a.type];
        const pts = t.pts * multiplier;
        score += pts;
        if (a.type === 'crystal') multiplier = Math.min(multiplier + 1, 10);
        updateHUD();
        shootParticles(a.x, a.y, t.hitColor, 12);
        beep(a.type === 'orange' ? 660 : a.type === 'crystal' ? 880 : 440, 0.12);
      }
      // Rebote físico contra el asteroide
      const nx = (comet.x - a.x) / dist;
      const ny = (comet.y - a.y) / dist;
      const dot = comet.vx * nx + comet.vy * ny;
      comet.vx -= 2 * dot * nx;
      comet.vy -= 2 * dot * ny;
    }
  });

  // Portal de Recuperación
  if (comet.y + comet.r > PORTAL_Y &&
      comet.x > portalX &&
      comet.x < portalX + portalW) {
    comets++;
    updateHUD();
    beep(1200, 0.15, 'sine');
    shootParticles(comet.x, PORTAL_Y, '#d4f', 15);
    endTurn();
    return;
  }

  // Salida por la parte inferior
  if (comet.y > H + 20) {
    endTurn();
  }
}

// ── Fin de turno ──────────────────────────────────────────
function endTurn() {
  asteroids.forEach(a => { if (a.hit) a.dead = true; });
  multiplier = 1;
  comet = null;
  inFlight = false;
  updateHUD();
  checkWinLose();
}

function criticalLeft() {
  return asteroids.filter(a => a.type === 'orange' && !a.dead).length;
}

function checkWinLose() {
  if (criticalLeft() === 0) {
    // Victoria — Supernova Fever
    const bonus = comets * 10000;
    score += bonus;
    state = 'win';
    document.getElementById('winScore').textContent  = 'Puntaje final: ' + score.toLocaleString();
    document.getElementById('winBonus').textContent  = 'Bonus cometas sobrantes: +' + bonus.toLocaleString();
    document.getElementById('winScreen').classList.add('active');
    document.getElementById('hud').style.display = 'none';
    beep(1047, 0.3, 'sine');
    setTimeout(() => beep(1319, 0.3, 'sine'), 200);
    setTimeout(() => beep(1568, 0.5, 'sine'), 400);
  } else if (comets <= 0) {
    // Derrota
    state = 'lose';
    document.getElementById('loseScore').textContent = 'Puntaje: ' + score.toLocaleString();
    document.getElementById('loseScreen').classList.add('active');
    document.getElementById('hud').style.display = 'none';
    beep(220, 0.4, 'sawtooth');
    setTimeout(() => beep(180, 0.5, 'sawtooth'), 300);
  }
}

// ── Dibujo: fondo ─────────────────────────────────────────
function drawBG() {
  ctx.fillStyle = '#000820';
  ctx.fillRect(0, 0, W, H);
  // Estrellas estáticas (semilla determinista)
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  for (let i = 0; i < 60; i++) {
    ctx.fillRect((i * 137 + 23) % 360, (i * 97 + 57) % 580 + 30, 1, 1);
  }
  // Nebulosa sutil
  const g = ctx.createRadialGradient(90, 260, 0, 90, 260, 100);
  g.addColorStop(0, 'rgba(160,80,255,0.08)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 160, 200, 220);
}

// ── Dibujo: satélite ──────────────────────────────────────
function drawSatellite() {
  ctx.save();
  ctx.translate(SAT_X, SAT_Y);
  ctx.rotate(getAimAngle() - Math.PI / 2);
  ctx.fillStyle = '#889';
  ctx.fillRect(-10, -14, 20, 28);
  ctx.fillStyle = '#aab';
  ctx.fillRect(-6, -10, 12, 20);
  // Paneles solares
  ctx.fillStyle = '#24a';
  ctx.fillRect(-26, -6, 14, 12);
  ctx.fillRect(12, -6, 14, 12);
  ctx.strokeStyle = '#4af';
  ctx.lineWidth = 1;
  ctx.strokeRect(-26, -6, 14, 12);
  ctx.strokeRect(12, -6, 14, 12);
  // Tobera
  ctx.fillStyle = '#f84';
  ctx.fillRect(-4, 14, 8, 6);
  ctx.restore();
}

// ── Dibujo: línea guía ────────────────────────────────────
function drawAimLine() {
  if (!aiming || inFlight) return;
  const angle = getAimAngle();
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = 'rgba(100,200,255,0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let px = SAT_X, py = SAT_Y + 20;
  let vx = Math.cos(angle) * 9, vy = Math.sin(angle) * 9;
  ctx.moveTo(px, py);
  for (let i = 0; i < 35; i++) {
    vy += 0.18;
    px += vx; py += vy;
    if (px < 8)     { px = 8;     vx =  Math.abs(vx); }
    if (px > W - 8) { px = W - 8; vx = -Math.abs(vx); }
    if (py < 8)     { py = 8;     vy =  Math.abs(vy); }
    if (py > H) break;
    ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

// ── Dibujo: asteroides ────────────────────────────────────
function drawAsteroids() {
  asteroids.forEach(a => {
    if (a.dead) return;
    const t = ASTEROID_TYPES[a.type];
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
    ctx.fillStyle = a.flash > 0 ? t.hitColor : t.color;
    if (a.flash > 0) a.flash--;
    ctx.fill();
    if (a.type === 'orange') {
      ctx.strokeStyle = 'rgba(255,200,50,0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (a.type === 'crystal') {
      ctx.strokeStyle = 'rgba(100,255,150,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Brillo interior
    ctx.beginPath();
    ctx.arc(a.x - 4, a.y - 4, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fill();
  });
}

// ── Dibujo: paredes anguladas ─────────────────────────────
function drawWalls() {
  walls.forEach(w => {
    ctx.beginPath();
    ctx.moveTo(w.x1, w.y1);
    ctx.lineTo(w.x2, w.y2);
    ctx.strokeStyle = w.hit > 0 ? '#fff' : '#4af';
    ctx.lineWidth   = w.hit > 0 ? 4 : 3;
    ctx.shadowColor = '#4af';
    ctx.shadowBlur  = w.hit > 0 ? 12 : 4;
    ctx.stroke();
    ctx.shadowBlur  = 0;
    if (w.hit > 0) w.hit--;
  });
}

// ── Dibujo: portal ────────────────────────────────────────
function drawPortal() {
  portalAnim += 0.08;
  const px = portalX, py = PORTAL_Y - 8, pw = portalW, ph = 16;
  ctx.shadowColor = '#d0f';
  ctx.shadowBlur  = 12;
  ctx.strokeStyle = '#c5f';
  ctx.lineWidth   = 2;
  ctx.strokeRect(px, py, pw, ph);
  ctx.shadowBlur  = 0;
  ctx.save();
  ctx.translate(px + pw / 2, py + ph / 2);
  ctx.rotate(portalAnim);
  ctx.strokeStyle = 'rgba(220,100,255,0.6)';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 1.5);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle   = '#c5f';
  ctx.font        = '8px Courier New';
  ctx.textAlign   = 'center';
  ctx.fillText('PORTAL', px + pw / 2, py - 2);
}

// ── Dibujo: cometa ────────────────────────────────────────
function drawComet() {
  if (!comet) return;
  // Estela
  comet.trail.forEach((p, i) => {
    const alpha = (i / comet.trail.length) * 0.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, comet.r * (i / comet.trail.length) * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,220,80,${alpha})`;
    ctx.fill();
  });
  // Cuerpo
  ctx.beginPath();
  ctx.arc(comet.x, comet.y, comet.r, 0, Math.PI * 2);
  ctx.fillStyle   = '#ffe';
  ctx.fill();
  ctx.strokeStyle = '#fa8';
  ctx.lineWidth   = 2;
  ctx.stroke();
  // Núcleo
  ctx.beginPath();
  ctx.arc(comet.x, comet.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
}

// ── Dibujo: partículas ────────────────────────────────────
function drawParticles() {
  particles = particles.filter(p => p.life > 0.01);
  particles.forEach(p => {
    p.x  += p.vx;
    p.y  += p.vy;
    p.vy += 0.1;
    p.life *= 0.88;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fillStyle   = p.color;
    ctx.globalAlpha = p.life;
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

// ── Dibujo: indicador de críticos ────────────────────────
function drawHints() {
  const left = criticalLeft();
  ctx.fillStyle  = 'rgba(255,160,0,0.7)';
  ctx.font       = '10px Courier New';
  ctx.textAlign  = 'right';
  ctx.fillText('◉ ' + left + ' críticos', W - 8, H - 8);
  ctx.textAlign  = 'left';
}

// ── Loop principal ────────────────────────────────────────
function loop() {
  if (paused || state !== 'playing') return;
  ctx.clearRect(0, 0, W, H);
  drawBG();
  drawWalls();
  drawPortal();
  drawAsteroids();
  drawAimLine();
  drawSatellite();
  drawComet();
  drawParticles();
  drawHints();
  if (inFlight) updateComet();
  frameId = requestAnimationFrame(loop);
}

// ── Controles táctiles y de mouse ─────────────────────────
const gc = document.getElementById('gameContainer');

function getPos(e) {
  const rect  = gc.getBoundingClientRect();
  const touch = e.touches ? e.touches[0] : e;
  return {
    x: (touch.clientX - rect.left) * (W / rect.width),
    y: (touch.clientY - rect.top)  * (H / rect.height)
  };
}

gc.addEventListener('mousedown', e => {
  if (e.target.tagName === 'BUTTON') return;
  if (state !== 'playing' || paused || inFlight) return;
  const p = getPos(e); aiming = true; aimX = p.x; aimY = p.y;
});
gc.addEventListener('mousemove', e => {
  if (!aiming) return;
  const p = getPos(e); aimX = p.x; aimY = p.y;
});
gc.addEventListener('mouseup', () => {
  if (!aiming) return; aiming = false; fireComet();
});

gc.addEventListener('touchstart', e => {
  if (e.target.tagName === 'BUTTON') return;
  e.preventDefault();
  if (state !== 'playing' || paused || inFlight) return;
  const p = getPos(e); aiming = true; aimX = p.x; aimY = p.y;
}, { passive: false });
gc.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!aiming) return;
  const p = getPos(e); aimX = p.x; aimY = p.y;
}, { passive: false });
gc.addEventListener('touchend', e => {
  if (e.target.tagName === 'BUTTON') return;
  e.preventDefault();
  if (!aiming) return; aiming = false; fireComet();
}, { passive: false });

// ── Init ──────────────────────────────────────────────────
initStarsBg();