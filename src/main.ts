// MOSSYMESH — NUT JOB EDITION
// Three.js globe, audio-reactive drone, terminal games, matrix mode, physics marquee.
// Three.js loaded from CDN via importmap (see index.html).

// ============ UTILITIES ============
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  'checking hardware entropy ............ OK',
  'seeding node identity ................ OK',
  'scanning radio spectrum .............. 4 BANDS FOUND',
  'pinging neighbors .................... 1,247 RESPONDED',
  'verifying ledger integrity ........... 8.2 MB OK',
  'establishing mesh routes ............. DONE',
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
    let i = 0;
    const total = BOOT_LINES.length;
    const tick = () => {
      if (i < total) {
        const div = document.createElement('div');
        div.textContent = BOOT_LINES[i];
        if (i === total - 1) div.className = 'boot-final';
        text.appendChild(div);
        i++;
        const p = Math.round((i / total) * 100);
        bar.style.width = p + '%';
        pct.textContent = p + '%';
        setTimeout(tick, i > total - 4 ? 350 : rand(60, 200));
      } else {
        setTimeout(() => {
          boot.classList.add('boot-done');
          setTimeout(() => { boot.remove(); resolve(); }, 700);
        }, 500);
      }
    };
    setTimeout(tick, 400);
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
  
  globeRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  globeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  
  globeScene = new THREE.Scene();
  globeCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  globeCamera.position.z = 4.2;
  
  globeGroup = new THREE.Group();
  arcGroup = new THREE.Group();
  globeScene.add(globeGroup, arcGroup);
  
  const R = 1.6;
  const NODES = 900;
  
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
  
  let t = 0;
  const animate = () => {
    requestAnimationFrame(animate);
    t += 0.002;
    if (!reducedMotion) {
      globeGroup.rotation.y += 0.0018;
      arcGroup.rotation.y += 0.0018;
      globeGroup.rotation.x = mouseY * 0.25;
      globeGroup.rotation.z = mouseX * 0.1;
      arcGroup.rotation.x = mouseY * 0.25;
      const sy = window.scrollY / (document.body.scrollHeight || 1);
      globeCamera.position.z = 4.2 - sy * 1.2;
      globeGroup.scale.setScalar(1 + Math.sin(t * 2) * 0.015);
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
      if (speed > 3 && particles.length < 150) {
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
    termPrint('  clear ........ wipe the terminal', 'term-dim');
  },
  status: () => {
    termPrint('MESH STATUS: OPERATIONAL', 'term-green');
    termPrint('  uptime ......... 99.98% (this node)', 'term-dim');
    termPrint('  latency ........ 12ms median', 'term-dim');
    termPrint('  ledger ......... 8.2 MB / 10 MB cap', 'term-dim');
    termPrint('  consensus ...... 2,847 rounds, 0 forks', 'term-dim');
    termPrint('  threat level ... CORPORATIONS ANGRY', 'term-amber');
  },
  peers: () => {
    const peers = ['phone-7f3a (android, 4km)', 'pi-zero-2w (lorawan, 12km)', 'thinkpad-x230 (wifi, 0.3km)', 'esp32-relay-9 (ble, 800m)', 'old-dell-closet (ethernet, local)'];
    termPrint('NEIGHBOR NODES:', 'term-green');
    peers.forEach(p => termPrint('  [+] ' + p, 'term-dim'));
  },
  ledger: () => {
    termPrint('EDGE LEDGER (last 4 entries):', 'term-green');
    termPrint('  #2847 chess.e2e4 ......... VERIFIED', 'term-dim');
    termPrint('  #2846 job.render.44 ...... VERIFIED', 'term-dim');
    termPrint('  #2845 route.update ....... VERIFIED', 'term-dim');
    termPrint('  #2844 sensor.temp ........ VERIFIED', 'term-dim');
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
  clear: () => { termOutput().innerHTML = ''; },
};

function initTerminal() {
  const input = document.getElementById('term-input') as HTMLInputElement;
  termPrint('MOSSYMESH TERMINAL v3.7.1 — type "help"', 'term-green');
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
        e.target.classList.add('revealed');
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
    if (status) status.textContent = turn === 'w' ? 'WHITE TO MOVE — click a piece, then a target' : 'MESH ENGINE THINKING…';
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
  await runBoot();
});
