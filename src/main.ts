// MOSSYMESH: NUT JOB EDITION
// Three.js globe, audio-reactive drone, terminal games, matrix mode, physics marquee.
// Three.js loaded from CDN via importmap (see index.html).

// ============ UTILITIES ============
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile = window.matchMedia('(hover: none) and (pointer: coarse)').matches || window.innerWidth < 768;
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// ============ CINEMATIC BOOT ============
const BOOT_LINES = [
  'MOSSYMESH SECURE BOOT v3.7.1',
  '━━━━━━━━━━━━━━━━━━━━━━━━━━',
  '  __  __                   __  __          _     ',
  ' |  \\/  | ___  ___ ___ _  _|  \\/  | ___ ___| |__  ',
  ' | |\\/| |/ _ \\/ __/ __| | | | |\\/| |/ _ / __| \'_ \\ ',
  ' | |  | | (_) \\__ \\__ \\ |_| | |  | |  __\\__ \\ | | |',
  ' |_|  |_|\\___/|___/___/\\__, |_|  |_|\\___|___/_| |_|',
  '                        |___/                     ',
  'checking page assets .................. OK',
  'loading demo modules ................. OK',
  'rendering mesh visualization ......... DONE',
  '',
  '> WELCOME TO THE NETWORK THAT REFUSES TO DIE',
];

function runBoot(): Promise<void> {
  return new Promise((resolve) => {
    const boot = document.getElementById('boot')!;
    const text = document.getElementById('boot-text')!;
    const bar = document.getElementById('boot-bar')!;
    const pct = document.getElementById('boot-pct')!;
    if (reducedMotion) { boot.remove(); resolve(); return; }
    // Mobile: tap anywhere to skip boot
    const skip = () => { boot.classList.add('done'); setTimeout(() => { boot.remove(); resolve(); }, 300); };
    if (isMobile) boot.addEventListener('pointerdown', skip, { once: true });
    // Mobile gets a shorter boot sequence
    const lines = isMobile ? BOOT_LINES.filter((_, i) => i < 8 || i >= BOOT_LINES.length - 3) : BOOT_LINES;
    let i = 0;
    const total = lines.length;
    const tick = () => {
      if (i < total) {
        const div = document.createElement('div');
        div.textContent = lines[i];
        if (i === total - 1) div.className = 'boot-final';
        text.appendChild(div);
        i++;
        const p = Math.round((i / total) * 100);
        bar.style.width = p + '%';
        pct.textContent = p + '%';
        // Faster on mobile
        const delay = isMobile ? rand(40, 120) : (i > total - 4 ? 350 : rand(60, 200));
        setTimeout(tick, delay);
      } else {
        setTimeout(() => {
          boot.classList.add('done');
          setTimeout(() => { boot.remove(); resolve(); }, 700);
        }, isMobile ? 250 : 500);
      }
    };
    setTimeout(tick, isMobile ? 200 : 400);
  });
}

// ============ THREE.JS GLOBE ============
// Three.js loaded dynamically from CDN (importmap in index.html)
let THREE_NS: any = null;
async function loadThree() {
  if (!THREE_NS) {
    THREE_NS = await import('three');
  }
  return THREE_NS;
}
let globeScene: any, globeCamera: any, globeRenderer: any;
let globeGroup: any, arcGroup: any;
let mouseX = 0, mouseY = 0;

async function initGlobe() {
  const canvas = document.getElementById('globe-canvas') as HTMLCanvasElement;
  if (!canvas) return;
  
  const THREE = await loadThree();
  
  globeRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !isMobile });
  globeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  
  globeScene = new THREE.Scene();
  globeCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  globeCamera.position.z = 4.2;
  
  globeGroup = new THREE.Group();
  arcGroup = new THREE.Group();
  globeScene.add(globeGroup, arcGroup);
  
  const R = 1.6;
  const NODES = isMobile ? 500 : 900;
  
  // Node points via fibonacci sphere
  const positions = new Float32Array(NODES * 3);
  const nodePts: any[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < NODES; i++) {
    const y = 1 - (i / (NODES - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;
    const v = new THREE.Vector3(
      Math.cos(theta) * radius * R,
      y * R,
      Math.sin(theta) * radius * R
    );
    nodePts.push(v);
    positions.set([v.x, v.y, v.z], i * 3);
  }
  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const nodeMat = new THREE.PointsMaterial({
    color: 0x00ff9d, size: 0.025, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
  });
  globeGroup.add(new THREE.Points(nodeGeo, nodeMat));
  
  // Inner wireframe sphere for structure
  const wireGeo = new THREE.IcosahedronGeometry(R * 0.98, 2);
  const wireMat = new THREE.MeshBasicMaterial({
    color: 0x00ff9d, wireframe: true, transparent: true, opacity: 0.07,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  globeGroup.add(new THREE.Mesh(wireGeo, wireMat));
  
  // Arcs between random node pairs
  const ARCS = 60;
  const arcMat = new THREE.LineBasicMaterial({
    color: 0x7df9ff, transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  for (let i = 0; i < ARCS; i++) {
    const a = nodePts[Math.floor(Math.random() * NODES)];
    const b = nodePts[Math.floor(Math.random() * NODES)];
    const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R * rand(1.15, 1.5));
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(24));
    arcGroup.add(new THREE.Line(geo, arcMat));
  }
  
  // Pulse rings
  for (let i = 0; i < 3; i++) {
    const ringGeo = new THREE.TorusGeometry(R * (1.1 + i * 0.15), 0.004, 8, 100);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ff9d, transparent: true, opacity: 0.25 - i * 0.07,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2 + rand(-0.3, 0.3);
    arcGroup.add(ring);
  }
  
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    globeRenderer.setSize(w, h, false);
    globeCamera.aspect = w / h;
    globeCamera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);
  
  window.addEventListener('pointermove', (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  // Touch-drag globe rotation with inertia (mobile wow)
  let dragVelX = 0, dragVelY = 0;
  let lastTouchX = 0, lastTouchY = 0;
  let isDragging = false;
  let dragOffsetX = 0, dragOffsetY = 0;
  if (isTouch) {
    canvas.style.touchAction = 'pan-y'; // allow vertical scroll, capture horizontal
    canvas.addEventListener('pointerdown', (e) => {
      isDragging = true;
      lastTouchX = e.clientX; lastTouchY = e.clientY;
      dragVelX = 0; dragVelY = 0;
    });
    window.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - lastTouchX, dy = e.clientY - lastTouchY;
      dragVelX = dx * 0.005; dragVelY = dy * 0.003;
      dragOffsetX += dragVelX; dragOffsetY += dragVelY;
      lastTouchX = e.clientX; lastTouchY = e.clientY;
    }, { passive: true });
    const endDrag = () => { isDragging = false; };
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  }

  let t = 0;
  const animate = () => {
    requestAnimationFrame(animate);
    t += 0.002;
    if (!reducedMotion) {
      // Inertia: velocity decays when not dragging
      if (!isDragging) {
        dragOffsetX += dragVelX; dragOffsetY += dragVelY;
        dragVelX *= 0.95; dragVelY *= 0.95;
      }
      globeGroup.rotation.y += 0.0018 + dragVelX;
      arcGroup.rotation.y += 0.0018 + dragVelX;
      globeGroup.rotation.x = mouseY * 0.25 + dragOffsetY;
      globeGroup.rotation.z = mouseX * 0.1 + dragOffsetX * 0.3;
      arcGroup.rotation.x = mouseY * 0.25 + dragOffsetY;
      const sy = window.scrollY / (document.body.scrollHeight || 1);
      globeCamera.position.z = 4.2 - sy * 1.2;
      globeGroup.scale.setScalar(1 + Math.sin(t * 2) * 0.015);
      // Clamp drag offsets to prevent extreme tilt
      dragOffsetY = clamp(dragOffsetY, -0.8, 0.8);
    }
    globeRenderer.render(globeScene, globeCamera);
  };
  animate();
}

// ============ WEB AUDIO DRONE ============
let audioCtx: AudioContext | null = null;
let audioOn = false;
let filterNode: BiquadFilterNode | null = null;

function toggleAudio() {
  const btn = document.getElementById('audio-toggle')!;
  if (audioOn && audioCtx) {
    audioCtx.suspend();
    audioOn = false;
    btn.textContent = 'SOUND OFF';
    btn.classList.remove('on');
    return;
  }
  if (!audioCtx) {
    audioCtx = new AudioContext();
    const master = audioCtx.createGain();
    master.gain.value = 0.08;
    filterNode = audioCtx.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.value = 400;
    filterNode.Q.value = 8;
    
    [55, 55.5, 110.3].forEach((f, i) => {
      const osc = audioCtx!.createOscillator();
      osc.type = i === 2 ? 'triangle' : 'sawtooth';
      osc.frequency.value = f;
      const g = audioCtx!.createGain();
      g.gain.value = i === 2 ? 0.3 : 0.5;
      osc.connect(g).connect(filterNode!);
      osc.start();
    });
    
    const lfo = audioCtx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 250;
    lfo.connect(lfoGain).connect(filterNode.frequency);
    lfo.start();
    
    const noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.1;
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 800;
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.value = 0.15;
    noise.connect(noiseFilter).connect(noiseGain).connect(filterNode);
    noise.start();
    
    filterNode.connect(master).connect(audioCtx.destination);
    
    window.addEventListener('pointermove', (e) => {
      if (filterNode && audioOn) {
        const target = 200 + (1 - e.clientY / window.innerHeight) * 1800;
        filterNode.frequency.setTargetAtTime(target, audioCtx!.currentTime, 0.1);
      }
    }, { passive: true });
  }
  audioCtx.resume();
  audioOn = true;
  btn.textContent = 'SOUND ON';
  btn.classList.add('on');
}

// ============ PARTICLE CURSOR ============
function initCursorParticles() {
  if (reducedMotion) return;
  const canvas = document.getElementById('cursor-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });
  
  interface P { x: number; y: number; vx: number; vy: number; life: number; size: number; }
  const particles: P[] = [];
  let lastX = -1, lastY = -1;
  
  window.addEventListener('pointermove', (e) => {
    if (lastX >= 0) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      const speed = Math.hypot(dx, dy);
      const maxParticles = isMobile ? 60 : 150;
      if (speed > 3 && particles.length < maxParticles) {
        particles.push({
          x: e.clientX, y: e.clientY,
          vx: rand(-1, 1) - dx * 0.02, vy: rand(-1, 1) - dy * 0.02,
          life: 1, size: rand(1, 3.5)
        });
      }
    }
    lastX = e.clientX; lastY = e.clientY;
  }, { passive: true });
  
  const loop = () => {
    requestAnimationFrame(loop);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.96; p.vy *= 0.96;
      p.life -= 0.025;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.fillStyle = `rgba(0, 255, 157, ${p.life * 0.7})`;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
  };
  loop();
}

// ============ MOBILE WOW: TOUCH RIPPLES ============
function initTouchRipples() {
  if (!isTouch || reducedMotion) return;
  const container = document.createElement('div');
  container.id = 'touch-ripples';
  container.setAttribute('aria-hidden', 'true');
  document.body.appendChild(container);
  let lastRipple = 0;
  window.addEventListener('pointerdown', (e) => {
    // Don't ripple on inputs or when typing
    if ((e.target as HTMLElement).matches('input, textarea, button, a')) return;
    const now = performance.now();
    if (now - lastRipple < 80) return; // throttle
    lastRipple = now;
    const r = document.createElement('div');
    r.className = 'touch-ripple';
    r.style.left = e.clientX + 'px';
    r.style.top = e.clientY + 'px';
    container.appendChild(r);
    setTimeout(() => r.remove(), 700);
  }, { passive: true });
}

// ============ MOBILE WOW: HERO TAP PULSE ============
// Tapping the hero globe triggers a shockwave pulse through the mesh
function initHeroTapPulse() {
  if (!isTouch || reducedMotion) return;
  const hero = document.querySelector('.hero');
  if (!hero) return;
  hero.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('a, button, input')) return;
    hero.classList.remove('hero-pulse');
    void (hero as HTMLElement).offsetWidth; // restart animation
    hero.classList.add('hero-pulse');
  }, { passive: true });
}

// ============ MATRIX RAIN MODE ============
let matrixActive = false;
function triggerMatrix(duration = 12000) {
  if (matrixActive) return;
  matrixActive = true;
  const overlay = document.createElement('div');
  overlay.id = 'matrix-overlay';
  const canvas = document.createElement('canvas');
  overlay.appendChild(canvas);
  const label = document.createElement('div');
  label.className = 'matrix-label';
  label.textContent = '// MESH OVERRIDE ENGAGED //';
  overlay.appendChild(label);
  document.body.appendChild(overlay);
  
  const ctx = canvas.getContext('2d')!;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const chars = '01アイカサタナハマヤラワ0123456789ABCDEF$#@%&';
  const fontSize = 16;
  const cols = Math.floor(canvas.width / fontSize);
  const drops: number[] = Array(cols).fill(0).map(() => Math.random() * -50);
  
  const draw = () => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#00ff9d';
    ctx.font = fontSize + 'px monospace';
    for (let i = 0; i < cols; i++) {
      const ch = chars[Math.floor(Math.random() * chars.length)];
      ctx.fillText(ch, i * fontSize, drops[i] * fontSize);
      if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    }
  };
  const interval = setInterval(draw, 50);
  
  setTimeout(() => {
    clearInterval(interval);
    overlay.classList.add('matrix-fade');
    setTimeout(() => { overlay.remove(); matrixActive = false; }, 800);
  }, duration);
}

function initKonami() {
  const seq = ['up','up','down','down','left','right','left','right','b','a'];
  let pos = 0;
  const keyMap: Record<string, string> = {
    'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right', 'b': 'b', 'a': 'a'
  };
  window.addEventListener('keydown', (e) => {
    const k = keyMap[e.key.toLowerCase()] || keyMap[e.key];
    if (!k) { pos = 0; return; }
    pos = (k === seq[pos]) ? pos + 1 : (k === seq[0] ? 1 : 0);
    if (pos === seq.length) {
      pos = 0;
      triggerMatrix(15000);
      termPrint('> KONAMI ACCEPTED. MESH OVERRIDE ENGAGED.', 'term-green');
    }
  });
}

// ============ TERMINAL ============
const termOutput = () => document.getElementById('term-output')!;
function termPrint(text: string, cls = '') {
  const out = termOutput();
  const div = document.createElement('div');
  div.className = 'term-line ' + cls;
  div.textContent = text;
  out.appendChild(div);
  out.scrollTop = out.scrollHeight;
}

let snakeGame: { interval: number; active: boolean } | null = null;

const COMMANDS: Record<string, (args: string[]) => void> = {
  help: () => {
    termPrint('  help ......... this list', 'term-dim');
    termPrint('  status ....... mesh health report', 'term-dim');
    termPrint('  peers ........ list neighbor nodes', 'term-dim');
    termPrint('  ledger ....... inspect the edge ledger', 'term-dim');
    termPrint('  join ......... join the mesh', 'term-dim');
    termPrint('  chess ........ deterministic chess demo', 'term-dim');
    termPrint('  snake ........ play snake (arrows/WASD, Q quits)', 'term-dim');
    termPrint('  matrix ....... digital rain takeover', 'term-dim');
    termPrint('  hack ......... breach a corporate node', 'term-dim');
    termPrint('  sudo ......... nice try', 'term-dim');
    termPrint('  vdf .......... mint a Job DID (illustrative)', 'term-dim');
    termPrint('  clear ........ wipe the terminal', 'term-dim');
  },
  status: () => {
    termPrint('MESH STATUS: [SIMULATED DEMO OUTPUT]', 'term-amber');
    termPrint('  This terminal is a fiction. No public mesh runs yet.', 'term-dim');
    termPrint('  In the lab: two live daemons already peer over TCP.', 'term-dim');
    termPrint('  What ships next:', 'term-dim');
    termPrint('    ledger cap ... under 10 MB on device', 'term-dim');
    termPrint('    sync ......... CRDT merge, no central server', 'term-dim');
    termPrint('    transport .... Kademlia DHT, BLE, LoRa', 'term-dim');
  },
  peers: () => {
    termPrint('[SIMULATED] No real peers. This is a demo terminal.', 'term-amber');
    termPrint('  When the mesh ships, nearby nodes will appear here.', 'term-dim');
  },
  ledger: () => {
    termPrint('[SIMULATED] Ledger entries below are illustrative.', 'term-amber');
    termPrint('  #0001 mesh.genesis ...... PLACEHOLDER', 'term-dim');
    termPrint('  (real entries appear once nodes start syncing)', 'term-dim');
  },
  join: () => {
    termPrint('> generating node identity...', 'term-dim');
    setTimeout(() => termPrint('> identity: node-' + Math.random().toString(36).slice(2, 8), 'term-green'), 400);
    setTimeout(() => termPrint('> scanning for neighbors...', 'term-dim'), 800);
    setTimeout(() => termPrint('> CONNECTED. Welcome to the mesh, node.', 'term-green'), 1400);
  },
  chess: () => {
    termPrint('> deterministic chess demo loaded below', 'term-dim');
    document.getElementById('chess')?.scrollIntoView({ behavior: 'smooth' });
  },
  matrix: () => { triggerMatrix(); termPrint('> MESH OVERRIDE ENGAGED', 'term-green'); },
  snake: () => startSnake(),
  hack: () => {
    termPrint('> targeting corp-node-447...', 'term-amber');
    const steps = ['bypassing firewall', 'spoofing credentials', 'escalating privileges', 'exfiltrating secrets'];
    steps.forEach((s, i) => {
      setTimeout(() => termPrint(`  [${i + 1}/4] ${s}... OK`, 'term-dim'), 600 * (i + 1));
    });
    setTimeout(() => {
      termPrint('> ACCESS GRANTED. Just kidding. This is a demo.', 'term-green');
      termPrint('> But the mesh this runs on? That part is real.', 'term-dim');
    }, 600 * 5);
  },
  sudo: () => termPrint('> nice try. there are no masters here.', 'term-amber'),
  vdf: () => {
    termPrint('> minting ephemeral Job DID (Wesolowski, RSA-2048)...', 'term-dim');
    termPrint('> 50,000,000 sequential steps. real burn: ~10 min. this terminal: 3s (illustrative).', 'term-amber');
    let p = 0;
    const iv = setInterval(() => {
      p += 25;
      if (p >= 100) {
        clearInterval(iv);
        termPrint('> DONE. job DID 9f3a...c41d verified in 3 ms.', 'term-green');
        termPrint('> faking 10,000 identities just got ~70 days more expensive.', 'term-dim');
      } else {
        termPrint(`> grinding... ${p}%`, 'term-dim');
      }
    }, 750);
  },
  clear: () => { termOutput().innerHTML = ''; },
};

function initTerminal() {
  const input = document.getElementById('term-input') as HTMLInputElement;
  termPrint('MOSSYMESH TERMINAL v3.7.1: type "help"', 'term-green');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const raw = input.value.trim().toLowerCase();
      if (raw) {
        termPrint('$ ' + raw, 'term-prompt');
        const [cmd, ...args] = raw.split(/\s+/);
        if (COMMANDS[cmd]) COMMANDS[cmd](args);
        else termPrint(`> unknown command: ${cmd}. type "help".`, 'term-red');
      }
      input.value = '';
    }
  });
  document.getElementById('terminal')?.addEventListener('click', () => input.focus());
}

function startSnake() {
  if (snakeGame?.active) { termPrint('> snake already running', 'term-amber'); return; }
  termPrint('> SNAKE: arrows/WASD to move, Q to quit', 'term-green');
  const W = 24, H = 12;
  let snake = [{ x: 12, y: 6 }];
  let dir = { x: 1, y: 0 };
  let food = { x: 18, y: 6 };
  let score = 0;
  
  const render = () => {
    let grid = '';
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (snake[0].x === x && snake[0].y === y) grid += '█';
        else if (snake.some(s => s.x === x && s.y === y)) grid += '▓';
        else if (food.x === x && food.y === y) grid += '●';
        else grid += '·';
      }
      grid += '\n';
    }
    return grid + `score: ${score}`;
  };
  
  const pre = document.createElement('pre');
  pre.className = 'term-line term-green snake-board';
  termOutput().appendChild(pre);
  
  const keyHandler = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (k === 'q') { end(); return; }
    if ((k === 'arrowup' || k === 'w') && dir.y !== 1) dir = { x: 0, y: -1 };
    else if ((k === 'arrowdown' || k === 's') && dir.y !== -1) dir = { x: 0, y: 1 };
    else if ((k === 'arrowleft' || k === 'a') && dir.x !== 1) dir = { x: -1, y: 0 };
    else if ((k === 'arrowright' || k === 'd') && dir.x !== -1) dir = { x: 1, y: 0 };
    e.preventDefault();
  };
  window.addEventListener('keydown', keyHandler);
  
  const end = () => {
    if (snakeGame) clearInterval(snakeGame.interval);
    window.removeEventListener('keydown', keyHandler);
    snakeGame = null;
    termPrint(`> game over. score: ${score}`, 'term-amber');
  };
  
  const step = () => {
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    if (head.x < 0 || head.x >= W || head.y < 0 || head.y >= H || snake.some(s => s.x === head.x && s.y === head.y)) {
      end(); return;
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      food = { x: Math.floor(Math.random() * W), y: Math.floor(Math.random() * H) };
    } else snake.pop();
    pre.textContent = render();
    termOutput().scrollTop = termOutput().scrollHeight;
  };
  
  pre.textContent = render();
  snakeGame = { interval: window.setInterval(step, 140), active: true };
}

// ============ DRAGGABLE PHYSICS MARQUEE ============
function initDragMarquee() {
  const el = document.getElementById('marquee-inner');
  if (!el || reducedMotion) return;
  let x = 0, vx = -1.2, dragging = false, lastPX = 0, lastT = 0;
  
  const frame = () => {
    requestAnimationFrame(frame);
    if (!dragging) {
      x += vx;
      vx *= 0.995;
      if (Math.abs(vx) < 0.4) vx = -1.2;
      const w = el.scrollWidth / 2;
      if (x < -w) x += w;
      if (x > 0) x -= w;
      el.style.transform = `translateX(${x}px)`;
    }
  };
  frame();
  
  el.style.cursor = 'grab';
  el.addEventListener('pointerdown', (e) => {
    dragging = true; lastPX = e.clientX; lastT = performance.now();
    el.style.cursor = 'grabbing';
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastPX;
    x += dx;
    const now = performance.now();
    vx = dx / Math.max(1, now - lastT) * 16;
    lastPX = e.clientX; lastT = now;
    el.style.transform = `translateX(${x}px)`;
  });
  const release = () => { dragging = false; el.style.cursor = 'grab'; vx = clamp(vx, -25, 25); };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
}

// ============ GLITCH BURSTS ============
function initGlitchBursts() {
  if (reducedMotion) return;
  const heroTitle = document.getElementById('hero-title');
  if (!heroTitle) return;
  const burst = () => {
    if (!document.hidden) {
      heroTitle.classList.add('glitching');
      setTimeout(() => heroTitle.classList.remove('glitching'), rand(150, 400));
    }
    setTimeout(burst, rand(4000, 8000));
  };
  setTimeout(burst, 3000);
}

// ============ SCROLL REVEALS ============
function initReveals() {
  const els = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(el => io.observe(el));
}

// ============ COUNTERS ============
function initCounters() {
  const els = document.querySelectorAll('[data-count]');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target as HTMLElement;
      io.unobserve(el);
      const target = parseFloat(el.dataset.count!);
      const dur = 1600, t0 = performance.now();
      const step = (t: number) => {
        const p = clamp((t - t0) / dur, 0, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (target * eased).toFixed(target % 1 ? 1 : 0);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  });
  els.forEach(el => io.observe(el));
}

// ============ CHESS (simplified demo) ============
function initChess() {
  const board = document.getElementById('chess-board');
  if (!board) return;
  const PIECES: Record<string, string> = {
    r: '♜', n: '♞', b: '♝', q: '♛', k: '♚', p: '♟',
    R: '♖', N: '♘', B: '♗', Q: '♕', K: '♔', P: '♙'
  };
  const state: string[][] = [
    ['r','n','b','q','k','b','n','r'],
    ['p','p','p','p','p','p','p','p'],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['','','','','','','',''],
    ['P','P','P','P','P','P','P','P'],
    ['R','N','B','Q','K','B','N','R'],
  ];
  let selected: [number, number] | null = null;
  let turn: 'w' | 'b' = 'w';
  
  const render = () => {
    board.innerHTML = '';
    state.forEach((row, r) => {
      row.forEach((cell, c) => {
        const sq = document.createElement('button');
        sq.className = 'chess-sq' + ((r + c) % 2 ? ' dark' : '');
        if (selected && selected[0] === r && selected[1] === c) sq.classList.add('sel');
        sq.textContent = PIECES[cell] || '';
        sq.setAttribute('aria-label', `square ${r},${c} ${cell || 'empty'}`);
        sq.addEventListener('click', () => onClick(r, c));
        board.appendChild(sq);
      });
    });
    const status = document.getElementById('chess-status');
    if (status) status.textContent = turn === 'w' ? 'WHITE TO MOVE: click a piece, then a target' : 'MESH ENGINE THINKING…';
  };
  
  const isWhite = (p: string) => p === p.toUpperCase() && p !== '';
  
  const onClick = (r: number, c: number) => {
    const piece = state[r][c];
    if (selected) {
      const [sr, sc] = selected;
      if (sr === r && sc === c) { selected = null; render(); return; }
      state[r][c] = state[sr][sc];
      state[sr][sc] = '';
      selected = null;
      turn = 'b';
      render();
      setTimeout(engineMove, 700);
    } else if (piece && isWhite(piece) && turn === 'w') {
      selected = [r, c];
      render();
    }
  };
  
  const engineMove = () => {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = state[r][c];
        if (p && !isWhite(p) && r + 1 < 8 && !state[r + 1][c]) {
          state[r + 1][c] = p;
          state[r][c] = '';
          turn = 'w';
          render();
          return;
        }
      }
    }
    turn = 'w';
    render();
  };
  
  render();
}

// ============ NAV / MISC ============
function initNav() {
  const burger = document.getElementById('nav-burger')!;
  const nav = document.querySelector('.nav-links')!;
  burger.addEventListener('click', () => {
    nav.classList.toggle('open');
    burger.classList.toggle('x');
  });
  document.getElementById('audio-toggle')?.addEventListener('click', toggleAudio);
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'm' && !(e.target as HTMLElement).matches('input')) toggleAudio();
  });
}

// ============ BOOT ============
document.addEventListener('DOMContentLoaded', async () => {
  initNav();
  initGlobe();
  initCursorParticles();
  initKonami();
  initTerminal();
  initDragMarquee();
  initGlitchBursts();
  initReveals();
  initCounters();
  initChess();
  initTouchRipples();
  initHeroTapPulse();
  initTopo();
  initSandboxDemo();
  initFoldDemo();
  initVdfDemo();
  await runBoot();
});

/* ============================================================
   TRANSFORM: interactive diagrams (topology, sandbox, ledger, VDF)
   ============================================================ */

function setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/* (reducedMotion boolean is declared at the top of this file; reused below) */

/* --- 03: TWO INTERNETS --- */
function initTopo(): void {
  const oldC = document.getElementById('topo-old') as HTMLCanvasElement | null;
  const meshC = document.getElementById('topo-mesh') as HTMLCanvasElement | null;
  if (!oldC && !meshC) return;

  if (oldC) {
    const ctx = setupCanvas(oldC);
    if (ctx) {
      const W = oldC.getBoundingClientRect().width, H = 260;
      const stops = [
        { x: W * 0.08, label: 'YOU' },
        { x: W * 0.38, label: 'DNS', throat: true },
        { x: W * 0.64, label: 'CLOUD', throat: true },
        { x: W * 0.92, label: 'PEER' },
      ];
      let t = 0;
      const draw = () => {
        ctx.clearRect(0, 0, W, H);
        const y = H / 2;
        ctx.strokeStyle = 'rgba(0,229,255,0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(stops[0].x, y); ctx.lineTo(stops[stops.length - 1].x, y); ctx.stroke();
        for (const s of stops) {
          ctx.fillStyle = s.throat ? 'rgba(255,51,85,0.12)' : 'rgba(125,255,106,0.08)';
          ctx.strokeStyle = s.throat ? '#ff3355' : '#7dff6a';
          ctx.beginPath(); ctx.arc(s.x, y, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          if (s.throat) {
            ctx.strokeStyle = '#ff3355'; ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(s.x - 8, y - 28); ctx.lineTo(s.x + 8, y - 12);
            ctx.moveTo(s.x + 8, y - 28); ctx.lineTo(s.x - 8, y - 12);
            ctx.stroke(); ctx.lineWidth = 2;
          }
          ctx.fillStyle = '#c8d4c0';
          ctx.font = '10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(s.label, s.x, y + 44);
        }
        // packet
        const seg = Math.floor(t) % 3;
        const f = t % 1;
        const px = stops[seg].x + (stops[seg + 1].x - stops[seg].x) * f;
        ctx.fillStyle = '#00e5ff';
        ctx.beginPath(); ctx.arc(px, y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(0,229,255,0.25)';
        ctx.beginPath(); ctx.arc(px, y, 11, 0, Math.PI * 2); ctx.fill();
      };
      draw();
      if (!reducedMotion) {
        setInterval(() => { t += 0.012; draw(); }, 50);
      }
    }
  }

  if (meshC) {
    const ctx = setupCanvas(meshC);
    if (ctx) {
      const W = meshC.getBoundingClientRect().width, H = 260;
      interface N { x: number; y: number; dead: boolean; deathT: number }
      const nodes: N[] = [];
      let seed = 42;
      const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      for (let i = 0; i < 14; i++) {
        nodes.push({ x: 20 + rnd() * (W - 40), y: 20 + rnd() * (H - 40), dead: false, deathT: 0 });
      }
      const src = nodes[0];
      const dst = nodes[nodes.length - 1];
      let path: N[] = [];
      const dist = (a: N, b: N) => Math.hypot(a.x - b.x, a.y - b.y);
      const route = (from: N): N[] => {
        const p: N[] = [from];
        const seen = new Set<N>([from]);
        let cur = from;
        let guard = 0;
        while (cur !== dst && guard++ < 30) {
          let best: N | null = null; let bd = Infinity;
          for (const n of nodes) {
            if (n.dead || seen.has(n)) continue;
            const d = dist(n, dst);
            if (d < bd) { bd = d; best = n; }
          }
          if (!best || bd >= dist(cur, dst) - 1) {
            // greedy stuck: pick nearest alive unvisited
            let nb: N | null = null; let nd = Infinity;
            for (const n of nodes) {
              if (n.dead || seen.has(n)) continue;
              const d = dist(cur, n);
              if (d < nd) { nd = d; nb = n; }
            }
            if (!nb) break;
            best = nb;
          }
          p.push(best); seen.add(best); cur = best;
        }
        return p;
      };
      path = route(src);
      let hopF = 0; let killT = 0;
      const draw = () => {
        ctx.clearRect(0, 0, W, H);
        // links between near nodes
        ctx.strokeStyle = 'rgba(125,255,106,0.14)';
        ctx.lineWidth = 1;
        for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
          if (nodes[i].dead || nodes[j].dead) continue;
          if (dist(nodes[i], nodes[j]) < 110) {
            ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke();
          }
        }
        // path
        if (path.length > 1) {
          ctx.strokeStyle = 'rgba(0,229,255,0.5)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(path[0].x, path[0].y);
          for (const n of path) ctx.lineTo(n.x, n.y);
          ctx.stroke(); ctx.lineWidth = 1;
          const hi = Math.min(Math.floor(hopF), path.length - 2);
          const f = hopF - Math.floor(hopF);
          const a = path[Math.max(0, hi)], b = path[Math.min(path.length - 1, hi + 1)];
          const px = a.x + (b.x - a.x) * f, py = a.y + (b.y - a.y) * f;
          ctx.fillStyle = '#00e5ff';
          ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
        }
        for (const n of nodes) {
          const isDst = n === dst, isSrc = n === src;
          if (n.dead) {
            ctx.strokeStyle = 'rgba(255,51,85,0.7)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(n.x - 7, n.y - 7); ctx.lineTo(n.x + 7, n.y + 7);
            ctx.moveTo(n.x + 7, n.y - 7); ctx.lineTo(n.x - 7, n.y + 7);
            ctx.stroke(); ctx.lineWidth = 1;
            continue;
          }
          ctx.fillStyle = isDst ? 'rgba(125,255,106,0.25)' : isSrc ? 'rgba(0,229,255,0.2)' : 'rgba(125,255,106,0.08)';
          ctx.strokeStyle = isDst ? '#7dff6a' : isSrc ? '#00e5ff' : 'rgba(125,255,106,0.5)';
          ctx.beginPath(); ctx.arc(n.x, n.y, isDst || isSrc ? 9 : 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        ctx.fillStyle = '#c8d4c0';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PUBLIC KEY 7f3a...', dst.x, Math.min(H - 8, dst.y + 24));
      };
      draw();
      if (!reducedMotion) {
        setInterval(() => {
          hopF += 0.03;
          if (hopF >= path.length - 1) { hopF = 0; }
          killT++;
          if (killT > 120) {
            killT = 0;
            const alive = nodes.filter(n => n !== src && n !== dst && !n.dead);
            // revive all dead first so the mesh heals, then kill one
            for (const n of nodes) n.dead = false;
            if (alive.length > 2) {
              const victim = alive[Math.floor(Math.random() * alive.length)];
              victim.dead = true;
            }
            path = route(src);
            hopF = 0;
          }
          draw();
        }, 50);
      }
    }
  }
}

/* --- 05: SANDBOX memory cage --- */
function initSandboxDemo(): void {
  const fill = document.getElementById('mem-fill');
  const label = document.getElementById('mem-label');
  const status = document.getElementById('mem-status');
  const log = document.getElementById('mem-log');
  const safeBtn = document.getElementById('mem-safe');
  const killBtn = document.getElementById('mem-kill');
  if (!fill || !label || !status || !log || !safeBtn || !killBtn) return;

  const say = (html: string, danger = false) => {
    log.innerHTML = html;
    log.classList.toggle('danger', danger);
  };
  safeBtn.addEventListener('click', () => {
    fill.classList.remove('over');
    status.classList.remove('tripped');
    status.textContent = 'CAGE ARMED';
    fill.style.width = '0%';
    label.textContent = '0.0 / 10.0 MiB allocated';
    say('> allocating 9.4 MiB...<br><span class="dim">> trace emitted. outputs bit-identical. cage held.</span>');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fill.style.width = '94%';
      label.textContent = '9.4 / 10.0 MiB allocated';
    }));
  });
  killBtn.addEventListener('click', () => {
    fill.classList.remove('over');
    status.classList.remove('tripped');
    status.textContent = 'CAGE ARMED';
    fill.style.width = '0%';
    say('> allocating 10,485,761 bytes...<br><span class="dim">> limit is 10,485,760 (MEM_LIMIT).</span>');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fill.style.width = '100%';
      label.textContent = '10.0 / 10.0 MiB allocated';
      setTimeout(() => {
        fill.classList.add('over');
        status.classList.add('tripped');
        status.textContent = 'JOB KILLED';
        say('> FATAL TRAP: guest asked for 1 byte over the limit.<br>> no negotiation. no swap. job terminated.', true);
      }, 950);
    }));
  });
}

/* --- 06: LEDGER folding --- */
function initFoldDemo(): void {
  const stage = document.getElementById('fold-stage');
  const label = document.getElementById('fold-label');
  const log = document.getElementById('fold-log');
  const btn = document.getElementById('fold-btn');
  const reset = document.getElementById('fold-reset');
  if (!stage || !label || !log || !btn || !reset) return;

  let level = 0; // 0: 8 tx, 1: 4 proofs, 2: 2 proofs, 3: 1 proof
  const states = [
    { n: 8, cls: '', tag: (i: number) => `T${i + 1}`, label: '8 transactions · ledger 8.2 MB', log: '> 8 proofs sitting in RAM. fold them.' },
    { n: 4, cls: 'proof', tag: (i: number) => `π${i + 1}`, label: '4 proofs · ledger 3.1 MB', log: '> 4 proofs. each one certifies two transactions. fold again.' },
    { n: 2, cls: 'proof', tag: (i: number) => `π${i + 1}`, label: '2 proofs · ledger 0.9 MB', log: '> 2 proofs. the history is getting thin. once more.' },
    { n: 1, cls: 'proof', tag: () => 'π 98KB', label: '1 proof · ledger 98 KB', log: '> one constant-size proof. a million transactions would look exactly like this.' },
  ];
  const render = () => {
    stage.innerHTML = '';
    const s = states[level];
    for (let i = 0; i < s.n; i++) {
      const d = document.createElement('div');
      d.className = `fold-block ${s.cls}`.trim();
      d.textContent = s.tag(i);
      stage.appendChild(d);
    }
    label.textContent = s.label;
    log.innerHTML = s.log;
    (btn as HTMLButtonElement).disabled = level >= 3;
    btn.querySelector('span')!.textContent = level >= 3 ? 'LEDGER FOLDED' : 'FOLD HISTORY';
  };
  btn.addEventListener('click', () => {
    if (level >= 3) return;
    const blocks = Array.from(stage.children) as HTMLElement[];
    blocks.forEach(b => b.classList.add('vanish'));
    setTimeout(() => { level++; render(); }, 550);
  });
  reset.addEventListener('click', () => { level = 0; render(); });
  render();
}

/* --- 07: VDF sybil tax --- */
function initVdfDemo(): void {
  const fill = document.getElementById('vdf-fill') as HTMLElement | null;
  const steps = document.getElementById('vdf-steps');
  const status = document.getElementById('vdf-status');
  const log = document.getElementById('vdf-log');
  const btn = document.getElementById('vdf-btn') as HTMLButtonElement | null;
  if (!fill || !steps || !status || !log || !btn) return;

  const TOTAL = 50_000_000;
  let running = false;
  btn.addEventListener('click', () => {
    if (running) return;
    running = true;
    btn.disabled = true;
    status.textContent = 'BURNING';
    const t0 = performance.now();
    const DUR = 8000; // illustrative fast-forward of the ~10 min real burn
    log.innerHTML = '> grinding sequential squares mod RSA-2048...<br><span class="dim">> no parallelism. no shortcuts. this is the tax.</span>';
    const tick = (now: number) => {
      const f = Math.min(1, (now - t0) / DUR);
      const eased = 1 - Math.pow(1 - f, 2);
      const done = Math.floor(TOTAL * eased);
      fill.style.width = `${eased * 100}%`;
      steps.textContent = `${done.toLocaleString('en-US')} / 50,000,000 steps`;
      if (f < 1) { requestAnimationFrame(tick); return; }
      running = false;
      status.textContent = 'MINTED';
      log.innerHTML = '> JOB DID minted: sha256 9f3a...c41d.<br>> verified in 3 ms. faking 10,000 identities just got ~70 days more expensive.';
      btn.disabled = false;
      btn.querySelector('span')!.textContent = 'BURN AGAIN';
    };
    requestAnimationFrame(tick);
  });
}
