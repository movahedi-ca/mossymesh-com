/* ============================================================
   MOSSYMESH — interactive engine
   boot sequence · mesh canvas · cursor · terminal · chess · reveals
   ============================================================ */

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------- BOOT SEQUENCE ---------------- */

const BOOT_LINES: Array<[string, string]> = [
  ["$ mossymesh --boot --node=node-7f3a", "t-dim"],
  ["[ok] identity ............ ed25519 keypair loaded", "t-green"],
  ["[ok] transport ........... QUIC + LoRa radio online", "t-green"],
  ["[ok] consensus ........... merkle-patricia trie mounted", "t-green"],
  ["[ok] sandbox ............. WASM runtime (WAMR) ready", "t-green"],
  ["[ok] ledger .............. 8.2 MB / 10 MB cap", "t-green"],
  ["[..] mesh ................ scanning for peers", "t-dim"],
  ["[ok] mesh ................ 1,247 peers discovered", "t-green"],
  ["[ok] interop ............. gateway bridge active", "t-green"],
  ["", "t-dim"],
  ["WELCOME TO THE MESH. NO MASTERS HERE.", "t-green"],
];

function runBoot(): void {
  const boot = document.getElementById("boot");
  const log = document.getElementById("boot-log");
  const fill = document.getElementById("boot-fill");
  if (!boot || !log || !fill) return;

  if (reducedMotion) {
    boot.classList.add("done");
    document.body.classList.add("booted");
    return;
  }

  let i = 0;
  const total = BOOT_LINES.length;
  const tick = () => {
    if (i < total) {
      const [text, cls] = BOOT_LINES[i];
      const div = document.createElement("div");
      div.className = cls;
      div.textContent = text || "\u00a0";
      log.appendChild(div);
      i++;
      fill.style.width = `${Math.round((i / total) * 100)}%`;
      setTimeout(tick, 90 + Math.random() * 160);
    } else {
      setTimeout(() => {
        boot.classList.add("done");
        document.body.classList.add("booted");
        startReveals();
      }, 420);
    }
  };
  setTimeout(tick, 350);
}

/* ---------------- MESH CANVAS ---------------- */

interface Node {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  hue: number;
  pulse: number;
  pulseSpeed: number;
}

function initMeshCanvas(): void {
  const canvas = document.getElementById("mesh-canvas") as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let W = 0, H = 0, nodes: Node[] = [];
  let mouseX = -9999, mouseY = -9999;
  const LINK_DIST = 150;

  const resize = () => {
    const rect = canvas.parentElement!.getBoundingClientRect();
    W = canvas.width = rect.width;
    H = canvas.height = rect.height;
    seed();
  };

  const seed = () => {
    const count = Math.min(130, Math.floor((W * H) / 14000));
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: 1.2 + Math.random() * 2.2,
      hue: 100 + Math.random() * 40,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.008 + Math.random() * 0.02,
    }));
  };

  // mouse repel + click burst
  canvas.parentElement!.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  });
  canvas.parentElement!.addEventListener("mouseleave", () => {
    mouseX = -9999; mouseY = -9999;
  });
  canvas.parentElement!.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    for (const n of nodes) {
      const dx = n.x - cx, dy = n.y - cy;
      const d = Math.hypot(dx, dy) || 1;
      const force = Math.max(0, 220 - d) / 220;
      n.vx += (dx / d) * force * 4;
      n.vy += (dy / d) * force * 4;
    }
  });

  let frames = 0;
  const draw = () => {
    ctx.clearRect(0, 0, W, H);

    // links
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d < LINK_DIST) {
          const alpha = (1 - d / LINK_DIST) * 0.28;
          ctx.strokeStyle = `rgba(125, 255, 106, ${alpha.toFixed(3)})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // nodes
    for (const n of nodes) {
      // physics
      n.x += n.vx; n.y += n.vy;
      n.vx *= 0.995; n.vy *= 0.995;
      // gentle drift restore
      if (Math.abs(n.vx) < 0.08) n.vx += (Math.random() - 0.5) * 0.02;
      if (Math.abs(n.vy) < 0.08) n.vy += (Math.random() - 0.5) * 0.02;
      // mouse repel
      const mdx = n.x - mouseX, mdy = n.y - mouseY;
      const md = Math.hypot(mdx, mdy);
      if (md < 130 && md > 0.1) {
        n.vx += (mdx / md) * 0.6;
        n.vy += (mdy / md) * 0.6;
      }
      // wrap
      if (n.x < -20) n.x = W + 20; if (n.x > W + 20) n.x = -20;
      if (n.y < -20) n.y = H + 20; if (n.y > H + 20) n.y = -20;

      n.pulse += n.pulseSpeed;
      const glow = 0.5 + 0.5 * Math.sin(n.pulse);
      const rad = n.r * (1 + glow * 0.6);

      const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, rad * 4);
      grad.addColorStop(0, `hsla(${n.hue}, 100%, 65%, ${0.5 + glow * 0.4})`);
      grad.addColorStop(1, "hsla(120, 100%, 50%, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(n.x, n.y, rad * 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `hsl(${n.hue}, 100%, 72%)`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // data packets traveling along random links
    if (frames % 40 === 0 && nodes.length > 1) {
      const a = nodes[(Math.random() * nodes.length) | 0];
      let best: Node | null = null; let bestD = LINK_DIST;
      for (const b of nodes) {
        if (b === a) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < bestD) { bestD = d; best = b; }
      }
      if (best) packets.push({ ax: a.x, ay: a.y, bx: best.x, by: best.y, t: 0 });
    }
    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i];
      p.t += 0.03;
      if (p.t >= 1) { packets.splice(i, 1); continue; }
      const x = p.ax + (p.bx - p.ax) * p.t;
      const y = p.ay + (p.by - p.ay) * p.t;
      ctx.fillStyle = "#c8ff00";
      ctx.shadowColor = "#c8ff00";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    frames++;
    if (!reducedMotion) requestAnimationFrame(draw);
  };

  interface Packet { ax: number; ay: number; bx: number; by: number; t: number }
  const packets: Packet[] = [];

  resize();
  window.addEventListener("resize", resize);
  draw();

  // node count ticker
  const nodeCount = document.getElementById("node-count");
  let count = 0;
  const target = 1200 + Math.floor(Math.random() * 200);
  const countTick = () => {
    if (count < target) {
      count += Math.ceil((target - count) / 24) || 1;
      if (nodeCount) nodeCount.textContent = count.toLocaleString();
      setTimeout(countTick, 50);
    } else if (nodeCount) {
      nodeCount.textContent = target.toLocaleString();
    }
  };
  setTimeout(countTick, 1800);
}

/* ---------------- CUSTOM CURSOR ---------------- */

function initCursor(): void {
  if (window.matchMedia("(hover: none)").matches) return;
  const dot = document.getElementById("cursor");
  const ring = document.getElementById("cursor-ring");
  if (!dot || !ring) return;

  let rx = -100, ry = -100, tx = -100, ty = -100;
  window.addEventListener("mousemove", (e) => {
    tx = e.clientX; ty = e.clientY;
    dot.style.left = `${tx}px`;
    dot.style.top = `${ty}px`;
  });
  const follow = () => {
    rx += (tx - rx) * 0.16;
    ry += (ty - ry) * 0.16;
    ring.style.left = `${rx}px`;
    ring.style.top = `${ry}px`;
    requestAnimationFrame(follow);
  };
  follow();

  document.querySelectorAll("a, button, .crate, .doc-card, .sq").forEach((el) => {
    el.addEventListener("mouseenter", () => ring.classList.add("hovering"));
    el.addEventListener("mouseleave", () => ring.classList.remove("hovering"));
  });
}

/* ---------------- SCROLL REVEALS + HEADER ---------------- */

let revealsStarted = false;

function startReveals(): void {
  if (revealsStarted) return;
  revealsStarted = true;
  const els = document.querySelectorAll<HTMLElement>(".reveal");
  els.forEach((el) => {
    const d = el.dataset.delay;
    if (d) el.style.transitionDelay = `${parseInt(d, 10) * 90}ms`;
  });
  if (reducedMotion || !("IntersectionObserver" in window)) {
    els.forEach((el) => el.classList.add("visible"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        io.unobserve(e.target);
      }
    }
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  els.forEach((el) => io.observe(el));
}

function initHeader(): void {
  const header = document.getElementById("site-header");
  if (!header) return;
  let lastY = 0;
  window.addEventListener("scroll", () => {
    const y = window.scrollY;
    if (y > 400 && y > lastY) header.classList.add("hidden");
    else header.classList.remove("hidden");
    lastY = y;
  }, { passive: true });

  const burger = document.getElementById("nav-burger");
  const links = document.querySelector(".nav-links");
  burger?.addEventListener("click", () => {
    const open = burger.getAttribute("aria-expanded") === "true";
    burger.setAttribute("aria-expanded", String(!open));
    if (links) (links as HTMLElement).style.display = open ? "" : "flex";
  });
}

/* ---------------- COUNTERS ---------------- */

function initCounters(): void {
  const nums = document.querySelectorAll<HTMLElement>(".stat-num[data-count]");
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target as HTMLElement;
      const target = parseInt(el.dataset.count || "0", 10);
      let cur = 0;
      const step = () => {
        cur += Math.max(1, Math.ceil((target - cur) / 12));
        if (cur >= target) { el.textContent = String(target); return; }
        el.textContent = String(cur);
        requestAnimationFrame(step);
      };
      if (reducedMotion) el.textContent = String(target);
      else step();
      io.unobserve(el);
    }
  }, { threshold: 0.5 });
  nums.forEach((n) => io.observe(n));
}

/* ---------------- TELEMETRY ---------------- */

function initTelemetry(): void {
  const lat = document.getElementById("tele-lat");
  const peers = document.getElementById("tele-peers");
  const uptime = document.getElementById("tele-uptime");
  const start = Date.now();
  setInterval(() => {
    if (lat) lat.textContent = String(8 + Math.floor(Math.random() * 42));
    if (peers) peers.textContent = String(1180 + Math.floor(Math.random() * 90));
    if (uptime) {
      const s = Math.floor((Date.now() - start) / 1000);
      const h = String(Math.floor(s / 3600)).padStart(2, "0");
      const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      uptime.textContent = `${h}:${m}:${ss}`;
    }
  }, 2000);
}

/* ---------------- TERMINAL ---------------- */

const TERM_COMMANDS: Record<string, (args: string[]) => string> = {
  help: () => [
    "Available commands:",
    "  help ............ this list",
    "  status .......... mesh health snapshot",
    "  join ............ register this browser as a node",
    "  peers ........... list nearby peers",
    "  ledger .......... show ledger stats",
    "  chess ........... the determinism proof",
    "  hack ............ try it and find out",
    "  sudo ............ nice try",
    "  clear ........... wipe the terminal",
  ].join("\n"),
  status: () => [
    "MESH STATUS ......................... <span class='t-green'>OPERATIONAL</span>",
    "peers online ........................ 1,247",
    "ledger size ....................... 8.2 MB / 10 MB",
    "unverifiable outputs .............. 0.3%",
    "job timeout (unstable RF) ......... 2.1%",
    "central servers ................... 0",
    "masters ........................... 0",
  ].join("\n"),
  join: () => [
    "Generating ed25519 identity ......... <span class='t-green'>done</span>",
    "Node ID: <span class='t-cyan'>7f3a:9c2e:41bd:08f1:77aa:33c9:de50:12bc</span>",
    "Announcing to 1,247 peers ........... <span class='t-green'>done</span>",
    "",
    "<span class='t-green'>Welcome to the mesh, node-7f3a.</span>",
    "No masters here. Pull your weight.",
  ].join("\n"),
  peers: () => [
    "NEARBY PEERS (kademlia, 8 closest):",
    "  <span class='t-cyan'>a1f0:...</span>  phone · QUIC · 12ms",
    "  <span class='t-cyan'>b822:...</span>  rpi-4 · LoRa · 340ms",
    "  <span class='t-cyan'>c3d9:...</span>  laptop · QUIC · 28ms",
    "  <span class='t-cyan'>d4e1:...</span>  rpi-zero · LoRa · 510ms",
    "  <span class='t-cyan'>e5f2:...</span>  phone · QUIC · 19ms",
    "  <span class='t-cyan'>f6a3:...</span>  server · QUIC · 8ms",
    "  <span class='t-cyan'>07b4:...</span>  radio · LoRa · 890ms",
    "  <span class='t-cyan'>18c5:...</span>  laptop · QUIC · 33ms",
  ].join("\n"),
  ledger: () => [
    "LEDGER ............................ merkle-patricia trie",
    "active size ....................... 8.2 MB",
    "cap ............................... 10 MB",
    "root .............................. <span class='t-cyan'>9f2c:41aa:...</span>",
    "entries ........................... 48,211",
    "proofs verified ................... 48,211 <span class='t-green'>(100%)</span>",
  ].join("\n"),
  chess: () => [
    "The Chess PoC: two devices, zero trust, one board.",
    "Every move is a CRDT op. Every position is a trie root.",
    "Engine eval runs identically on-device and in the WASM sandbox.",
    "Target throughput: ~836 Mnps. Scroll up and play the demo.",
  ].join("\n"),
  hack: () => [
    "<span class='t-amber'>INTRUSION DETECTED</span> ... just kidding.",
    "This is a static site. There's nothing to hack.",
    "The mesh, on the other hand — <span class='t-green'>good luck.</span>",
    "Every job is sandboxed WASM. Every state change is a signed CRDT op.",
    "Bring a quantum computer and we'll talk.",
  ].join("\n"),
  sudo: () => "Nice try. There is no root on the mesh. There is no root <span class='t-green'>anywhere.</span>",
  matrix: () => "Wake up, Neo... the mesh has you. Follow the white rabbit. 🐇",
  hello: () => "Hello, node. The mesh sees you.",
};

function initTerminal(): void {
  const body = document.getElementById("term-body");
  const input = document.getElementById("term-input") as HTMLInputElement | null;
  const term = document.getElementById("terminal");
  if (!body || !input || !term) return;

  const print = (html: string, cls = "") => {
    const div = document.createElement("div");
    if (cls) div.className = cls;
    div.innerHTML = html;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  };

  print("MossyMesh node terminal — v1.0.0", "t-dim");
  print("Type <span class='t-green'>help</span> to begin. Type <span class='t-amber'>hack</span> if you're feeling lucky.", "t-dim");
  print("", "");

  term.addEventListener("click", () => input.focus());

  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const raw = input.value.trim();
    print(`<span class='t-green'>mesh@node-7f3a:~$</span> ${escapeHtml(raw)}`);
    input.value = "";
    if (!raw) return;
    const [cmd, ...args] = raw.toLowerCase().split(/\s+/);
    if (cmd === "clear") { body.innerHTML = ""; return; }
    const fn = TERM_COMMANDS[cmd];
    if (fn) print(fn(args));
    else print(`command not found: ${escapeHtml(cmd)} — try <span class='t-green'>help</span>`, "t-red");
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ---------------- CHESS DEMO ---------------- */

const GLYPHS: Record<string, string> = {
  K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

function initChessDemo(): void {
  const boardEl = document.getElementById("demo-board");
  if (!boardEl) return;

  // minimal chess: startpos, legal-ish moves for demo (pawns + knights + king safety ignored)
  let board: (string | null)[][] = startPos();
  let selected: [number, number] | null = null;
  let turn: "w" | "b" = "w";
  let lastMove: [[number, number], [number, number]] | null = null;

  const render = () => {
    boardEl.innerHTML = "";
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = document.createElement("div");
        sq.className = `sq ${((r + f) % 2 === 0) ? "light" : "dark"}`;
        const piece = board[r][f];
        if (piece) {
          sq.textContent = GLYPHS[piece] || piece;
          sq.style.color = piece === piece.toUpperCase() ? "#e8f0e6" : "#7dff6a";
          sq.style.textShadow = piece === piece.toUpperCase()
            ? "0 2px 6px rgba(0,0,0,.7)"
            : "0 0 12px rgba(125,255,106,.5)";
        }
        if (selected && selected[0] === r && selected[1] === f) sq.classList.add("selected");
        if (lastMove && ((lastMove[0][0] === r && lastMove[0][1] === f) || (lastMove[1][0] === r && lastMove[1][1] === f))) {
          sq.classList.add("last-move");
        }
        if (selected && !piece && isLegalDemoMove(selected, [r, f])) sq.classList.add("legal");
        if (selected && piece && isLegalDemoMove(selected, [r, f])) sq.classList.add("legal");
        sq.addEventListener("click", () => onClick(r, f));
        boardEl.appendChild(sq);
      }
    }
  };

  const onClick = (r: number, f: number) => {
    const piece = board[r][f];
    const isOwn = piece && ((turn === "w") === (piece === piece.toUpperCase()));
    if (selected && isLegalDemoMove(selected, [r, f])) {
      const [sr, sf] = selected;
      board[r][f] = board[sr][sf];
      board[sr][sf] = null;
      lastMove = [[sr, sf], [r, f]];
      selected = null;
      turn = turn === "w" ? "b" : "w";
      // fake "publish to mesh" flash
      boardEl.style.boxShadow = "0 0 90px rgba(125,255,106,.35), inset 0 0 40px rgba(0,0,0,.5)";
      setTimeout(() => { boardEl.style.boxShadow = ""; }, 350);
    } else if (isOwn) {
      selected = (selected && selected[0] === r && selected[1] === f) ? null : [r, f];
    } else {
      selected = null;
    }
    render();
  };

  // demo-legal: any piece moves like a queen one step, pawns move forward 1 (or 2 from start), knights jump
  const isLegalDemoMove = (from: [number, number], to: [number, number]): boolean => {
    const [sr, sf] = from; const [r, f] = to;
    if (sr === r && sf === f) return false;
    const piece = board[sr][sf];
    if (!piece) return false;
    const target = board[r][f];
    if (target && ((turn === "w") === (target === target.toUpperCase()))) return false;
    const dr = r - sr, df = f - sf;
    const p = piece.toLowerCase();
    const dir = piece === piece.toUpperCase() ? -1 : 1; // white moves up (decreasing row)
    if (p === "p") {
      if (df === 0 && !target) {
        if (dr === dir) return true;
        const startRow = piece === piece.toUpperCase() ? 6 : 1;
        if (sr === startRow && dr === 2 * dir && !board[sr + dir][sf]) return true;
      }
      if (Math.abs(df) === 1 && dr === dir && target) return true;
      return false;
    }
    if (p === "n") {
      return (Math.abs(dr) === 2 && Math.abs(df) === 1) || (Math.abs(dr) === 1 && Math.abs(df) === 2);
    }
    // king/queen/rook/bishop: one step any direction (demo simplification)
    return Math.abs(dr) <= 1 && Math.abs(df) <= 1;
  };

  render();
}

function startPos(): (string | null)[][] {
  const back: string[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
  const b: (string | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let f = 0; f < 8; f++) {
    b[0][f] = back[f];
    b[1][f] = "p";
    b[6][f] = "P";
    b[7][f] = back[f].toUpperCase();
  }
  return b;
}

/* ---------------- MARQUEE: duplicate for seamless loop ---------------- */

function initMarquee(): void {
  const track = document.getElementById("marquee-track");
  if (!track) return;
  track.innerHTML += track.innerHTML;
}

/* ---------------- CRATE hover glow follows mouse ---------------- */

function initCrateGlow(): void {
  document.querySelectorAll<HTMLElement>(".crate").forEach((c) => {
    c.addEventListener("mousemove", (e) => {
      const rect = c.getBoundingClientRect();
      c.style.setProperty("--mx", `${e.clientX - rect.left}px`);
      c.style.setProperty("--my", `${e.clientY - rect.top}px`);
    });
  });
}

/* ---------------- GLITCH auto-trigger on hero ---------------- */

function initGlitch(): void {
  const el = document.querySelector(".hero-title .glitch");
  if (!el || reducedMotion) return;
  setInterval(() => {
    el.classList.add("auto");
    setTimeout(() => el.classList.remove("auto"), 420);
  }, 4200);
}

/* ---------------- BOOT ---------------- */

document.addEventListener("DOMContentLoaded", () => {
  runBoot();
  initMeshCanvas();
  initCursor();
  initHeader();
  initCounters();
  initTelemetry();
  initTerminal();
  initChessDemo();
  initMarquee();
  initCrateGlow();
  initGlitch();
  // if boot already done (reduced motion), start reveals now
  if (reducedMotion) startReveals();
});
