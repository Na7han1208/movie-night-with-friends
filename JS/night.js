// ─── MOVIE NIGHT GAME ENGINE ─────────────────────────────────────────────────
// Three selection modes: fishbowl, tournament, theme.
// Flow: waiting -> [submitting] -> voting -> reveal -> rating

const ROOM_ID = "room_" + getOrMakeRoom();
function getOrMakeRoom() {
  const p = new URLSearchParams(location.search);
  if (p.get("room")) return p.get("room");
  const id = uid(6);
  const u = new URL(location.href);
  u.searchParams.set("room", id);
  history.replaceState({}, "", u);
  return id;
}
sessionStorage.setItem("mn_room", ROOM_ID.replace("room_", ""));

const IS_MOBILE = new URLSearchParams(location.search).has("vote");
const PRESET_THEME = new URLSearchParams(location.search).get("theme");
const P1 = 59,
  P2 = 29,
  CIRC_V = 175.93;
const BASE_PATH = `/${ROOM_ID}`;
function gp(p = "") {
  return dbGet(`${BASE_PATH}${p}`);
}
function sp(p, d) {
  return dbSet(`${BASE_PATH}${p}`, d);
}
function pp(p, d) {
  return dbPatch(`${BASE_PATH}${p}`, d);
}
function dp(p = "") {
  return dbDelete(`${BASE_PATH}${p}`);
}

let G = {},
  ivs = [];
function clearAll() {
  ivs.forEach(clearInterval);
  ivs = [];
}
function tick(fn, ms) {
  const id = setInterval(fn, ms);
  ivs.push(id);
  return id;
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let MOVIE_LIST = [];
async function loadMovieList() {
  try {
    const r = await fetch("./movies.json");
    if (r.ok) MOVIE_LIST = await r.json();
  } catch (e) {
    console.warn("Could not load movies.json", e);
  }
}

const PALETTE = CONFIG.accents; // shared with homepage for visual cohesion

let activeScr = null;
function show(id) {
  if (activeScr && activeScr !== id) {
    const old = document.getElementById(activeScr);
    old.classList.add("out");
    setTimeout(() => old.classList.remove("on", "out"), 520);
  }
  setTimeout(
    () => {
      document.getElementById(id).classList.add("on");
      activeScr = id;
    },
    activeScr ? 260 : 0,
  );
}

/* ══ FISHBOWL ══ */
let balls = [],
  raf = null,
  cvs = null,
  ctx = null,
  CW = 0,
  CH = 0;
const GRAV = 0.38,
  DAMP = 0.48,
  FRIC = 0.978,
  BALL_R_MIN = 50,
  BALL_R_MAX = 70,
  BOWL_MAX_W = 780;
let uBowl = { x: 0, y: 0, w: 0, h: 0, rx: 0 };

function getUBowl() {
  const pad = Math.min(36, CW * 0.04),
    rawW = CW - pad * 2,
    w = Math.min(rawW, BOWL_MAX_W);
  const x = Math.round((CW - w) / 2),
    y = Math.round(CH * 0.06),
    h = CH - y - pad;
  return { x, y, w, h, rx: Math.min(w * 0.18, h * 0.28) };
}
function initFish() {
  cvs = document.getElementById("fishCanvas");
  if (!cvs) return;
  const stage = cvs.parentElement;
  CW = stage.clientWidth;
  CH = stage.clientHeight;
  cvs.width = CW;
  cvs.height = CH;
  ctx = cvs.getContext("2d");
  uBowl = getUBowl();
  balls = [];
  if (raf) cancelAnimationFrame(raf);
  fishLoop();
}
function resolveUBowl(b) {
  const { x, y, w, h, rx } = uBowl,
    right = x + w,
    bottom = y + h;
  const blcx = x + rx,
    blcy = bottom - rx,
    brcx = right - rx,
    brcy = bottom - rx;
  const inLeft = b.x < blcx && b.y > blcy,
    inRight = b.x > brcx && b.y > brcy;
  if (inLeft || inRight) {
    const cx = inLeft ? blcx : brcx,
      cy = inLeft ? blcy : brcy;
    const dx = b.x - cx,
      dy = b.y - cy,
      dist = Math.hypot(dx, dy);
    const maxDist = Math.max(rx - b.r, b.r * 0.1);
    if (dist > maxDist && dist > 0.001) {
      const nx = dx / dist,
        ny = dy / dist;
      b.x = cx + nx * maxDist;
      b.y = cy + ny * maxDist;
      const dot = b.vx * nx + b.vy * ny;
      if (dot > 0) {
        b.vx = (b.vx - 2 * dot * nx) * DAMP;
        b.vy = (b.vy - 2 * dot * ny) * DAMP;
        b.vx *= 0.92;
      }
    }
  } else {
    if (b.x - b.r < x) {
      b.x = x + b.r;
      b.vx = Math.abs(b.vx) * DAMP;
    }
    if (b.x + b.r > right) {
      b.x = right - b.r;
      b.vx = -Math.abs(b.vx) * DAMP;
    }
    if (b.y + b.r > bottom) {
      b.y = bottom - b.r;
      b.vy = -Math.abs(b.vy) * DAMP;
      b.vx *= 0.92;
    }
  }
  if (b.y - b.r < y) {
    b.y = y + b.r;
    b.vy = Math.abs(b.vy) * 0.2;
  }
}
function dropBall(text) {
  if (!cvs || !ctx) return;
  const r = BALL_R_MIN + Math.random() * (BALL_R_MAX - BALL_R_MIN);
  const col = PALETTE[Math.floor(Math.random() * PALETTE.length)];
  const { x, w } = uBowl;
  balls.push({
    x: x + w * 0.2 + Math.random() * w * 0.6,
    y: -r * 2 - 10,
    vx: (Math.random() - 0.5) * 4,
    vy: 0,
    text,
    r,
    col,
    highlight: false,
    selected: false,
  });
}
function removeBall(text) {
  const idx = balls.findIndex((b) => b.text === text);
  if (idx !== -1) balls.splice(idx, 1);
}
function drawUBowlOutline() {
  const { x, y, w, h, rx } = uBowl,
    right = x + w,
    bottom = y + h;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, bottom - rx);
  ctx.arcTo(x, bottom, x + rx, bottom, rx);
  ctx.lineTo(right - rx, bottom);
  ctx.arcTo(right, bottom, right, bottom - rx, rx);
  ctx.lineTo(right, y);
  ctx.strokeStyle = "rgba(255,255,255,.22)";
  ctx.lineWidth = 2.5;
  ctx.stroke();
}
function fishLoop() {
  if (!ctx) return;
  ctx.clearRect(0, 0, CW, CH);
  drawUBowlOutline();
  const { x, y, w, h, rx } = uBowl,
    right = x + w,
    bottom = y + h;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, bottom - rx);
  ctx.arcTo(x, bottom, x + rx, bottom, rx);
  ctx.lineTo(right - rx, bottom);
  ctx.arcTo(right, bottom, right, bottom - rx, rx);
  ctx.lineTo(right, y);
  ctx.lineTo(x, y);
  ctx.clip();
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    b.vy += GRAV;
    b.vx *= FRIC;
    b.vy *= FRIC;
    b.x += b.vx;
    b.y += b.vy;
    if (b.x < -500 || b.x > CW + 500 || b.y > CH + 500 || b.y < -500) {
      balls.splice(i, 1);
      i--;
      continue;
    }
    resolveUBowl(b);
    for (let j = i + 1; j < balls.length; j++) {
      const o = balls[j],
        ddx = o.x - b.x,
        ddy = o.y - b.y,
        dd = Math.hypot(ddx, ddy),
        md = b.r + o.r + 1;
      if (dd < md && dd > 0.01) {
        const nx = ddx / dd,
          ny = ddy / dd,
          ov = (md - dd) * 0.5;
        b.x -= nx * ov;
        b.y -= ny * ov;
        o.x += nx * ov;
        o.y += ny * ov;
        const dv = (b.vx - o.vx) * nx + (b.vy - o.vy) * ny,
          imp = dv * 0.5;
        b.vx -= imp * nx;
        b.vy -= imp * ny;
        o.vx += imp * nx;
        o.vy += imp * ny;
      }
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    if (b.selected) {
      ctx.fillStyle = ctx.fillStyle = "#1e1e22";
      ctx.fill();
      ctx.strokeStyle = b.col;
      ctx.lineWidth = 4;
      ctx.stroke();
    } else if (b.highlight) {
      ctx.fillStyle = b.col;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      ctx.fillStyle = b.col;
      ctx.fill();
    }
    const maxW = b.r * 2 - 22;
    ctx.fillStyle = b.selected ? b.col : "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const words = b.text.split(" ");
    let lines =
      words.length === 1
        ? [b.text]
        : [
            words.slice(0, Math.ceil(words.length / 2)).join(" "),
            words.slice(Math.ceil(words.length / 2)).join(" "),
          ];
    let fs = 17;
    ctx.font = `600 ${fs}px Inter, sans-serif`;
    while (fs > 11 && lines.some((l) => ctx.measureText(l).width > maxW)) {
      fs--;
      ctx.font = `600 ${fs}px Inter, sans-serif`;
    }
    const lineH = fs * 1.25,
      totalH = (lines.length - 1) * lineH;
    lines.forEach((line, li) =>
      ctx.fillText(line, b.x, b.y - totalH / 2 + li * lineH),
    );
    ctx.restore();
  }
  ctx.restore();
  raf = requestAnimationFrame(fishLoop);
}
let animating = false;
async function runSelectionAnimation(picked) {
  animating = true;
  return new Promise((resolve) => {
    balls.forEach((b) => {
      b.highlight = false;
      b.selected = picked.includes(b.text);
    });
    setTimeout(() => {
      animating = false;
      resolve();
    }, 1700);
  });
}

/* ══ TOURNAMENT MODE ══ */
// Knockout bracket: pair movies up, vote each pair, winners advance.
// Odd one out gets a bye (auto-advances) to keep every round balanced.
function pairUpRound(pool) {
  const shuffled = shuffle(pool);
  const matchups = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    if (i + 1 < shuffled.length) matchups.push([shuffled[i], shuffled[i + 1]]);
    else matchups.push([shuffled[i], null]); // bye
  }
  return matchups;
}
function totalRoundsNeeded(n) {
  return Math.max(1, Math.ceil(Math.log2(Math.max(n, 1))));
}
async function hostStartTournament(allMovies) {
  let pool = shuffle([...new Set(allMovies)]);
  const defaults = ["The Dark Knight", "Inception", "Parasite", "Pulp Fiction"];
  while (pool.length < 2)
    pool.push(defaults[Math.floor(Math.random() * defaults.length)]);
  const matchups = pairUpRound(pool);
  const votes = {};
  pool.forEach((m) => (votes[m] = 0));
  const ns = {
    ...G,
    phase: "voting",
    p2Start: Date.now(),
    movies: pool,
    votes,
    voters: {},
    bracket: {
      round: 1,
      totalRounds: totalRoundsNeeded(pool.length),
      matchups,
    },
  };
  await sp("/state", ns);
  G = ns;
  hostVote();
}
function runBracketCoinFlip(a, b) {
  return new Promise((resolve) => {
    document.getElementById("vBarsArea").innerHTML = `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.5rem;text-align:center;">
        <p class="caps">It's a tie — flipping a coin</p>
        <canvas id="bracketCoinCanvas" width="140" height="140"></canvas>
        <p id="bracketCoinStatus" style="font-size:.96rem;color:var(--w2);">deciding between <strong style="color:var(--w1)">${esc(a)}</strong> vs <strong style="color:var(--w1)">${esc(b)}</strong>...</p>
      </div>`;
    const c = document.getElementById("bracketCoinCanvas"),
      cx = c.getContext("2d");
    let frame = 0,
      totalFrames = 90,
      side = true;
    const winner = Math.random() < 0.5 ? a : b;
    function drawCoin(scaleX) {
      cx.clearRect(0, 0, 140, 140);
      cx.save();
      cx.translate(70, 70);
      cx.scale(scaleX, 1);
      cx.beginPath();
      cx.arc(0, 0, 54, 0, Math.PI * 2);
      cx.fillStyle = side ? "#e8453c" : "#f5b942";
      cx.fill();
      if (Math.abs(scaleX) > 0.15) {
        cx.fillStyle = "#fff";
        cx.font = `700 24px Inter`;
        cx.textAlign = "center";
        cx.textBaseline = "middle";
        cx.fillText(side ? "?" : "!", 0, 1);
      }
      cx.restore();
    }
    const anim = setInterval(() => {
      frame++;
      const progress = frame / totalFrames,
        speed = progress < 0.65 ? 1 : 1 - ((progress - 0.65) / 0.35) * 0.88;
      const angle = frame * speed * 0.28,
        scaleX = Math.cos(angle);
      if (Math.cos(angle - speed * 0.28) * scaleX < 0) side = !side;
      drawCoin(scaleX);
      if (frame >= totalFrames) {
        clearInterval(anim);
        drawCoin(1);
        const statusEl = document.getElementById("bracketCoinStatus");
        if (statusEl)
          statusEl.innerHTML = `<strong style="color:var(--w1)">${esc(winner)}</strong> wins the flip`;
        setTimeout(() => resolve(winner), 900);
      }
    }, 16);
  });
}
async function hostAdvanceRound() {
  clearAll();
  G = (await gp("/state")) || G;
  const matchups = (G.bracket && G.bracket.matchups) || [];
  const vt = G.votes || {};
  const winners = [];
  for (const [a, b] of matchups) {
    if (b === null) {
      winners.push(a); // bye — advances automatically
      continue;
    }
    const va = vt[a] || 0,
      vb = vt[b] || 0;
    if (va === vb) {
      const winner = await runBracketCoinFlip(a, b); // tie -> visible coin flip
      winners.push(winner);
    } else {
      winners.push(va > vb ? a : b);
    }
  }
  if (winners.length <= 1) {
    const champion = winners[0];
    const ns = {
      ...G,
      phase: "reveal",
      movies: [champion],
      votes: { [champion]: 1 },
    };
    await sp("/state", ns);
    G = ns;
    showReveal();
    return;
  }
  const nextMatchups = pairUpRound(winners);
  const newRound = (G.bracket.round || 1) + 1;
  const votes = {};
  winners.forEach((m) => (votes[m] = 0));
  const ns = {
    ...G,
    votes,
    voters: {},
    bracket: { ...G.bracket, round: newRound, matchups: nextMatchups },
    p2Start: Date.now(),
  };
  await sp("/state", ns);
  G = ns;
  hostVote();
}
function renderBracketView() {
  const b = G.bracket || { round: 1, totalRounds: 1, matchups: [] };
  const vt = G.votes || {};
  const vc = G.voters
    ? Object.keys(G.voters).filter((k) => G.voters[k]).length
    : 0;
  document.getElementById("vCount").textContent =
    `${vc} voter${vc === 1 ? "" : "s"}`;
  document.getElementById("vBarsArea").innerHTML = `
    <p class="caps" style="margin-bottom:.9rem;">Round ${b.round} of ${b.totalRounds}</p>
    <div class="bracket-grid">
      ${b.matchups
        .map(([a, bb]) => {
          if (bb === null) {
            return `<div class="matchup-card bye-card">
              <div class="matchup-side">${esc(a)}</div>
              <div class="matchup-vs">BYE</div>
            </div>`;
          }
          const va = vt[a] || 0,
            vb = vt[bb] || 0,
            total = va + vb || 1;
          const pa = Math.round((va / total) * 100),
            pb = 100 - pa;
          return `<div class="matchup-card">
            <div class="matchup-side ${va > vb ? "leading" : ""}">${esc(a)}<span class="matchup-pct">${pa}%</span></div>
            <div class="matchup-vs">VS</div>
            <div class="matchup-side ${vb > va ? "leading" : ""}">${esc(bb)}<span class="matchup-pct">${pb}%</span></div>
          </div>`;
        })
        .join("")}
    </div>`;
}

/* ══ THEME-FIRST MODE ══ */
function renderThemeGrid() {
  const grid = document.getElementById("themeGrid");
  if (!grid) return;
  grid.innerHTML = THEMES.map(
    (
      t,
    ) => `<button class="theme-card ${t.n === PRESET_THEME ? "suggested" : ""}" data-theme="${esc(t.n)}">
    <div class="te">${t.e}</div><div class="tn">${esc(t.n)}</div>
  </button>`,
  ).join("");
  grid
    .querySelectorAll(".theme-card")
    .forEach((btn) =>
      btn.addEventListener("click", () => hostPickTheme(btn.dataset.theme)),
    );
}
async function hostPickTheme(themeName) {
  clearAll();
  G = (await gp("/state")) || G;
  const theme = THEMES.find((t) => t.n === themeName);
  if (!theme) return;
  let pool = MOVIE_LIST.filter((title) => {
    const tagged = MOVIES.find((m) => m.t === title);
    return tagged && tagged.k.includes(theme.tag);
  });
  if (pool.length < 3)
    pool = MOVIES.filter((m) => m.k.includes(theme.tag)).map((m) => m.t);
  if (pool.length < 3) pool = shuffle(MOVIE_LIST).slice(0, 8);
  const picked = shuffle(pool).slice(0, 3);
  const votes = {};
  picked.forEach((m) => (votes[m] = 0));
  const ns = {
    ...G,
    phase: "voting",
    p2Start: Date.now(),
    movies: picked,
    votes,
    voters: {},
    theme: theme.n,
  };
  await sp("/state", ns);
  G = ns;
  if (raf) cancelAnimationFrame(raf);
  hostVote();
}

/* ══ HOST LOBBY ══ */
async function hostLobby() {
  show("sLobby");
  const vUrl = new URL(location.href);
  vUrl.searchParams.set("vote", "1");
  vUrl.searchParams.set("room", ROOM_ID.replace("room_", ""));
  vUrl.searchParams.delete("theme");
  const qrBox = document.getElementById("qrBox");
  qrBox.innerHTML = "";
  const sz = Math.min(
    Math.round(Math.min(window.innerWidth * 0.3, window.innerHeight * 0.38)),
    320,
  );
  try {
    new QRCode(qrBox, {
      text: vUrl.toString(),
      width: sz,
      height: sz,
      colorDark: "#000",
      colorLight: "#fff",
      correctLevel: QRCode.CorrectLevel.M,
    });
  } catch (e) {
    qrBox.textContent = "QR error";
  }
  document.getElementById("roomCodeLabel").textContent =
    `Room code: ${ROOM_ID.replace("room_", "").toUpperCase()}`;

  let state = await gp("/state");
  if (!state || state.phase === "reveal" || state.phase === "rating") {
    state = {
      phase: "waiting",
      waitStart: Date.now(),
      p1Start: null,
      submissions: {},
      movies: [],
      votes: {},
      voters: {},
      ratings: {},
      mode: PRESET_THEME ? "theme" : "fishbowl",
    };
    await sp("/state", state);
  }
  G = state;
  lobbyRenderedNames = new Set();
  updateLobbyUI(true);
  renderModeSelector();
  renderThemeGrid();

  tick(async () => {
    G = (await gp("/state")) || G;
    updateLobbyUI(false);
    if (G.phase === "submitting") {
      clearAll();
      hostSubmitScreen();
    }
    if (G.phase === "voting") {
      clearAll();
      if (raf) cancelAnimationFrame(raf);
      hostVote();
    }
    if (G.phase === "reveal") {
      clearAll();
      showReveal();
    }
    if (G.phase === "rating") {
      clearAll();
      hostRatingScreen();
    }
  }, 2000);
}
function renderModeSelector() {
  const row = document.getElementById("modeRow");
  if (!row) return;
  const modes = [
    { id: "fishbowl", ico: "🐠", label: "Fishbowl" },
    { id: "tournament", ico: "🏆", label: "Tournament" },
    { id: "theme", ico: "🎭", label: "Theme First" },
  ];
  row.innerHTML = modes
    .map(
      (m) =>
        `<div class="mode-pill ${G.mode === m.id ? "on" : ""}" data-mode="${m.id}"><span class="ico">${m.ico}</span>${m.label}</div>`,
    )
    .join("");
  row.querySelectorAll(".mode-pill").forEach((el) => {
    el.addEventListener("click", async () => {
      const mode = el.dataset.mode;
      await pp("/state", { mode });
      G.mode = mode;
      renderModeSelector();
      toggleLobbyModeUI();
    });
  });
  toggleLobbyModeUI();
}
function toggleLobbyModeUI() {
  const isTheme = G.mode === "theme";
  document.getElementById("themeGridWrap").style.display = isTheme
    ? "block"
    : "none";
  document.getElementById("startSubmitBtn").style.display = isTheme
    ? "none"
    : "inline-flex";
}
let lobbyRenderedNames = new Set();
function updateLobbyUI(initial) {
  const subs = G.submissions ? Object.values(G.submissions) : [];
  document.getElementById("pCount").textContent = subs.length;
  const chips = document.getElementById("playerChips");
  if (!subs.length) {
    chips.innerHTML =
      '<span id="lobbyEmpty" style="font-size:.88rem;color:var(--w3);font-style:italic;">waiting for players...</span>';
    lobbyRenderedNames = new Set();
    return;
  }
  const empty = document.getElementById("lobbyEmpty");
  if (empty) empty.remove();
  subs.forEach((s, i) => {
    if (lobbyRenderedNames.has(s.name)) return;
    lobbyRenderedNames.add(s.name);
    const col = PALETTE[i % PALETTE.length];
    const chip = document.createElement("div");
    chip.className = "player-chip";
    if (initial) chip.style.animation = "none";
    chip.innerHTML = `<div class="player-chip-dot" style="background:${col}"></div>${esc(s.name)}`;
    chips.appendChild(chip);
  });
}
async function hostStartSubmissions() {
  clearAll();
  G = (await gp("/state")) || G;
  if (G.phase !== "waiting") return;
  const ns = { ...G, phase: "submitting", p1Start: Date.now() };
  await sp("/state", ns);
  G = ns;
  hostSubmitScreen();
}

let seenMovies = new Set(),
  submitTimerIv = null;
function hostSubmitScreen() {
  show("sSubmit");
  seenMovies = new Set();
  document.getElementById("fishStageWrap").style.display = "flex";
  setTimeout(() => {
    initFish();
    if (G.submissions)
      Object.values(G.submissions).forEach((s) =>
        (s.movies || []).forEach((m) => {
          if (!seenMovies.has(m)) {
            seenMovies.add(m);
            setTimeout(() => dropBall(m), 100 + Math.random() * 400);
          }
        }),
      );
  }, 350);
  if (submitTimerIv) clearInterval(submitTimerIv);
  submitTimerIv = setInterval(() => {
    if (!G.p1Start) return;
    const el = Math.min((Date.now() - G.p1Start) / 1000, P1),
      rem = Math.max(0, P1 - el);
    const mm = Math.floor(rem / 60),
      ss = Math.floor(rem % 60);
    const timerEl = document.getElementById("fishTimer");
    if (timerEl) timerEl.textContent = `${mm}:${String(ss).padStart(2, "0")}`;
  }, 1000);
  ivs.push(submitTimerIv);
  tick(async () => {
    G = (await gp("/state")) || G;
    if (G.phase === "voting") {
      if (!animating) {
        clearAll();
        if (raf) cancelAnimationFrame(raf);
        hostVote();
      }
      return;
    }
    const subs = G.submissions ? Object.values(G.submissions) : [];
    const allM = [];
    subs.forEach((s) => (s.movies || []).forEach((m) => allM.push(m)));
    allM.forEach((m) => {
      if (!seenMovies.has(m)) {
        seenMovies.add(m);
        dropBall(m);
      }
    });
    seenMovies.forEach((m) => {
      if (!allM.includes(m)) {
        seenMovies.delete(m);
        removeBall(m);
      }
    });
    document.getElementById("fishMCount").textContent = allM.length;
    if (G.p1Start && (Date.now() - G.p1Start) / 1000 >= P1) {
      clearAll();
      await hostStartVoting();
    }
  }, 2000);
}

async function hostStartVoting() {
  clearAll();
  G = (await gp("/state")) || G;
  if (G.phase !== "submitting") return;
  let all = [];
  const subs = G.submissions ? Object.values(G.submissions) : [];
  subs.forEach((s) => (s.movies || []).forEach((m) => all.push(m)));

  if (G.mode === "tournament") {
    await hostStartTournament(all);
    return;
  }

  const defaults = [
    "The Dark Knight",
    "Inception",
    "Parasite",
    "Pulp Fiction",
    "Interstellar",
  ];
  while (all.length < 3)
    all.push(defaults[Math.floor(Math.random() * defaults.length)]);

  let picked = shuffle(all).slice(0, 3);

  const votes = {};
  picked.forEach((m) => (votes[m] = 0));
  const ns = {
    ...G,
    phase: "voting",
    p2Start: Date.now(),
    movies: picked,
    votes,
    voters: {},
  };
  await sp("/state", ns);
  G = ns;
  await runSelectionAnimation(picked);
  if (raf) cancelAnimationFrame(raf);
  hostVote();
}

/* ══ HOST VOTE ══ */
function hostVote() {
  show("sHostVote");
  renderVoteScreen();
  tick(() => {
    if (G.p2Start) updateVoteRing();
  }, 1000);
  tick(async () => {
    G = (await gp("/state")) || G;
    if (G.phase !== "voting") {
      clearAll();
      return;
    }
    renderVoteScreen();
    if (G.p2Start && (Date.now() - G.p2Start) / 1000 >= P2) {
      clearAll();
      if (G.mode === "tournament") await hostAdvanceRound();
      else await hostEndVoting();
    }
  }, 2000);
}
function renderVoteScreen() {
  if (G.mode === "tournament") renderBracketView();
  else renderVoteBars();
  updateVoteActionButton();
}
function updateVoteActionButton() {
  const btn = document.getElementById("voteActionBtn");
  if (!btn) return;
  if (G.mode === "tournament") {
    const isFinal = ((G.bracket && G.bracket.matchups) || []).length === 1;
    btn.textContent = isFinal ? "Finish Tournament" : "Next Round →";
    btn.onclick = () => hostAdvanceRound();
  } else {
    btn.textContent = "Reveal";
    btn.onclick = () => hostEndVoting();
  }
}
function renderVoteBars() {
  const mv = G.movies || [],
    vt = G.votes || {};
  const vc = G.voters
    ? Object.keys(G.voters).filter((k) => G.voters[k]).length
    : 0;
  document.getElementById("vCount").textContent =
    `${vc} voter${vc === 1 ? "" : "s"}`;
  const scores = mv.map((m) => vt[m] || 0);
  const minS = Math.min(...scores),
    maxS = Math.max(...scores),
    range = maxS - minS || 1;
  const winner = scores.indexOf(Math.max(...scores));
  document.getElementById("vBarsArea").innerHTML = mv
    .map((m, i) => {
      const pct = Math.round(((scores[i] - minS) / range) * 80 + 10),
        isLead = i === winner && vc > 0;
      return `<div class="vote-bar-row${isLead ? " leading" : ""}">
      <div class="vote-bar-movie">${esc(m)}</div>
      <div class="vote-bar-track-wrap"><div class="vote-bar-track"><div class="vote-bar-fill" style="width:${pct}%;background:${PALETTE[i % PALETTE.length]};"></div></div></div>
      <div class="vote-bar-dot" style="background:${isLead ? PALETTE[i % PALETTE.length] : "transparent"};border-color:${isLead ? PALETTE[i % PALETTE.length] : "var(--line2)"};"></div>
    </div>`;
    })
    .join("");
}
function updateVoteRing() {
  if (!G.p2Start) return;
  const el = (Date.now() - G.p2Start) / 1000,
    rem = Math.max(0, P2 - el);
  const mm = Math.floor(rem / 60),
    ss = Math.floor(rem % 60);
  const timeEl = document.getElementById("vRingTime"),
    arcEl = document.getElementById("vRingArc");
  if (timeEl) timeEl.textContent = `${mm}:${String(ss).padStart(2, "0")}`;
  if (arcEl) arcEl.style.strokeDashoffset = CIRC_V * (1 - rem / P2);
}
async function hostEndVoting() {
  G = (await gp("/state")) || G;
  await pp("/state", { phase: "reveal" });
  G.phase = "reveal";
  showReveal();
}

/* ══ REVEAL ══ */
function showReveal() {
  const mv = G.movies || [],
    vt = G.votes || {};
  const sorted = [...mv].sort((a, b) => (vt[b] || 0) - (vt[a] || 0));
  const topScore = vt[sorted[0]] || 0;
  const tied = sorted.filter((m) => (vt[m] || 0) === topScore);
  if (tied.length > 1) {
    runCoinFlip(tied, sorted);
  } else {
    renderReveal(sorted);
  }
}
function runCoinFlip(tied, sorted) {
  show("sReveal");
  const wrap = document.getElementById("revealWrap");
  wrap.innerHTML = `
    <div class="reveal-eyebrow">It's a tie — flipping a coin</div>
    <div style="display:flex;align-items:center;justify-content:center;margin:1.75rem 0;"><canvas id="coinCanvas" width="140" height="140"></canvas></div>
    <div id="coinStatus" style="font-size:.96rem;color:var(--w2);">deciding between ${tied.map((m) => `<strong style="color:var(--w1)">${esc(m)}</strong>`).join(" vs ")}...</div>`;
  const c = document.getElementById("coinCanvas"),
    cx = c.getContext("2d");
  let frame = 0,
    totalFrames = 90,
    side = true;
  const winner = tied[Math.floor(Math.random() * tied.length)];
  function drawCoin(scaleX) {
    cx.clearRect(0, 0, 140, 140);
    cx.save();
    cx.translate(70, 70);
    cx.scale(scaleX, 1);
    cx.beginPath();
    cx.arc(0, 0, 54, 0, Math.PI * 2);
    cx.fillStyle = side ? "#e8453c" : "#f5b942";
    cx.fill();
    if (Math.abs(scaleX) > 0.15) {
      cx.fillStyle = "#fff";
      cx.font = `700 24px Inter`;
      cx.textAlign = "center";
      cx.textBaseline = "middle";
      cx.fillText(side ? "?" : "!", 0, 1);
    }
    cx.restore();
  }
  const anim = setInterval(() => {
    frame++;
    const progress = frame / totalFrames,
      speed = progress < 0.65 ? 1 : 1 - ((progress - 0.65) / 0.35) * 0.88;
    const angle = frame * speed * 0.28,
      scaleX = Math.cos(angle);
    if (Math.cos(angle - speed * 0.28) * scaleX < 0) side = !side;
    drawCoin(scaleX);
    if (frame >= totalFrames) {
      clearInterval(anim);
      drawCoin(1);
      document.getElementById("coinStatus").innerHTML =
        `<span style="color:var(--w3);">the coin lands...</span>`;
      setTimeout(
        () => renderReveal([winner, ...sorted.filter((m) => m !== winner)]),
        900,
      );
    }
  }, 16);
}
function renderReveal(sorted) {
  show("sReveal");
  const mv = G.movies || [];
  const wrap = document.getElementById("revealWrap");
  wrap.innerHTML = `
    <div class="reveal-eyebrow">Tonight's pick</div>
    <div class="reveal-winner-text">${esc(sorted[0] || "...")}</div>
    <div class="reveal-list">
      ${sorted
        .map((m, i) => {
          const col = PALETTE[mv.indexOf(m) % PALETTE.length] || "var(--w1)";
          return `<div class="reveal-row ${i === 0 ? "r1" : ""}">
          <span class="reveal-rank">0${i + 1}</span>
          <div class="reveal-dot" style="background:${col};"></div>
          <span class="reveal-rname">${esc(m)}</span>
        </div>`;
        })
        .join("")}
    </div>
    <div class="reveal-actions">
      <button class="btn-p" onclick="hostStartRating()">✓ We Watched It — Rate Now</button>
      <button class="btn-s" onclick="hostReset()">New Night</button>
    </div>`;
}

/* ══ RATING ══ */
async function hostStartRating() {
  clearAll();
  G = (await gp("/state")) || G;
  const mv = G.movies || [],
    vt = G.votes || {};
  const winner = [...mv].sort((a, b) => (vt[b] || 0) - (vt[a] || 0))[0];
  const ns = { ...G, phase: "rating", winner, ratings: {} };
  await sp("/state", ns);
  G = ns;
  hostRatingScreen();
}
function avgRating(ratingsObj) {
  const vals = Object.values(ratingsObj || {}).map((r) => r.stars);
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
function hostRatingScreen() {
  show("sRating");
  renderRatingView();
  tick(async () => {
    G = (await gp("/state")) || G;
    if (G.phase !== "rating") {
      clearAll();
      return;
    }
    renderRatingView();
  }, 2000);
}
function renderRatingView() {
  const ratings = G.ratings || {};
  const entries = Object.values(ratings);
  const avg = avgRating(ratings);
  document.getElementById("ratingWrap").innerHTML = `
    <div class="reveal-eyebrow">Rate tonight's watch</div>
    <div class="rating-movie">${esc(G.winner || "...")}</div>
    <div class="rating-avg">${avg ? avg.toFixed(1) : "—"}<span style="font-size:1.6rem;color:var(--w3);">/5</span></div>
    <div class="rating-avg-sub">${entries.length} rating${entries.length === 1 ? "" : "s"} submitted</div>
    <div class="rating-list">${entries.length ? entries.map((r) => `<div class="rating-row"><span class="rating-row-name">${esc(r.name)}</span><span class="rating-row-stars">${"★".repeat(r.stars)}${"☆".repeat(5 - r.stars)}</span></div>`).join("") : '<p class="caps" style="text-align:center;">Waiting for ratings from your phones...</p>'}</div>
    <div class="rating-actions">
      <a href="#" id="ratingLbLink" target="_blank" rel="noopener" class="btn-p">Open Letterboxd ↗</a>
      <button class="btn-s" id="copyRatingBtn">Copy Summary</button>
      <button class="btn-s" onclick="hostReset()">New Night</button>
    </div>`;
  document.getElementById("ratingLbLink").href = letterboxdUrl();
  document.getElementById("copyRatingBtn").addEventListener("click", () => {
    const txt = `${G.winner} — ${avg.toFixed(1)}★ (${entries.length} rating${entries.length === 1 ? "" : "s"})`;
    navigator.clipboard?.writeText(txt);
    const btn = document.getElementById("copyRatingBtn");
    const old = btn.textContent;
    btn.textContent = "Copied ✓";
    setTimeout(() => (btn.textContent = old), 1500);
  });
}
async function hostReset() {
  clearAll();
  if (raf) cancelAnimationFrame(raf);
  await dp();
  location.href = location.pathname;
}

/* ══ MOBILE (voter) ══ */
let myName = "",
  myMovies = [],
  myVotes = {},
  joined = false,
  mPoll = null,
  lastSent = {};

async function mobileInit() {
  show("sMobile");
  G = (await gp("/state")) || {};
  const ph = G.phase || "waiting";
  if (ph === "waiting") {
    joined ? mWait() : mJoinScreen();
  } else if (ph === "submitting") {
    mSubmitScreen();
  } else if (ph === "voting") {
    mVoteScreen();
  } else if (ph === "reveal") {
    mRevealScreen();
  } else if (ph === "rating") {
    mRatingScreen();
  }
}
function mJoinScreen() {
  document.getElementById("mContent").innerHTML = `
    <div class="m-phase-badge"><div class="m-phase-dot" style="background:${PALETTE[0]}"></div><span class="m-phase-label">join the room</span></div>
    <label class="m-label">Your name</label>
    <input class="m-input" id="mName" placeholder="Enter your name..." maxlength="30"/>
    <button class="m-btn" onclick="mJoin()">Join</button>`;
  if (myName) document.getElementById("mName").value = myName;
  document.getElementById("mName").addEventListener("keydown", (e) => {
    if (e.key === "Enter") mJoin();
  });
  pollUntil(["submitting", "voting", "reveal", "rating"]);
}
async function mJoin() {
  const name = (document.getElementById("mName").value || "").trim();
  if (!name) {
    alert("Enter your name!");
    return;
  }
  myName = name;
  const key = name.replace(/[.#$/\[\]]/g, "_");
  await sp(`/state/submissions/${key}`, { name, movies: [] });
  joined = true;
  mWait();
}
function mWait() {
  document.getElementById("mContent").innerHTML = `
    <div class="m-state">
      <h3>You're in</h3>
      <p>Waiting for the host to get things moving...</p>
      <div style="margin-top:1.5rem;"><div class="m-label" style="margin-bottom:.5rem;">Joined as</div><div class="m-chip">${esc(myName)}</div></div>
    </div>`;
  pollUntil(["submitting", "voting", "reveal", "rating"]);
}
function getTakenMovies() {
  if (!G.submissions) return new Set();
  const taken = new Set();
  const myKey = myName.replace(/[.#$/\[\]]/g, "_");
  Object.entries(G.submissions).forEach(([k, s]) => {
    if (k !== myKey) (s.movies || []).forEach((m) => taken.add(m));
  });
  return taken;
}
function mSubmitScreen() {
  if (mPoll) clearInterval(mPoll);
  document.getElementById("mContent").innerHTML = `
    <div class="m-phase-badge"><div class="m-phase-dot" style="background:${PALETTE[2]}"></div><span class="m-phase-label">add your picks</span></div>
    <p style="font-size:.82rem;color:var(--w3);margin-bottom:1.4rem;">as ${esc(myName)}</p>
    <div class="m-picks-label"><span>your picks</span><span id="mPicksCount">${myMovies.length}/3</span></div>
    <div class="m-movie-list" id="mMovieList"></div>
    <div class="m-search-wrap" id="mSearchWrap">
      <input class="m-search-input" id="mSearchInput" placeholder="Search for a movie..." autocomplete="off" ${myMovies.length >= 3 ? "disabled" : ""}/>
      <div class="m-dropdown" id="mDropdown"></div>
    </div>
    <p style="font-size:.76rem;color:var(--w3);text-align:center;margin-top:.5rem;">pick up to 3 movies</p>`;
  renderMMovieList();
  setupSearch();
  pollUntil(["voting", "reveal", "rating"]);
}
function setupSearch() {
  const inp = document.getElementById("mSearchInput"),
    dd = document.getElementById("mDropdown");
  if (!inp || !dd) return;
  inp.addEventListener("input", () =>
    renderDropdown(inp.value.trim().toLowerCase()),
  );
  inp.addEventListener("focus", () =>
    renderDropdown(inp.value.trim().toLowerCase()),
  );
  document.addEventListener("click", function h(e) {
    if (!document.getElementById("mSearchWrap")?.contains(e.target)) {
      dd.classList.remove("open");
      document.removeEventListener("click", h);
    }
  });
}
function renderDropdown(q) {
  const dd = document.getElementById("mDropdown");
  if (!dd) return;
  if (myMovies.length >= 3) {
    dd.classList.remove("open");
    return;
  }
  const taken = getTakenMovies();
  const filtered = MOVIE_LIST.filter(
    (m) => !myMovies.includes(m) && (!q || m.toLowerCase().includes(q)),
  );
  if (!filtered.length && !q) {
    dd.classList.remove("open");
    return;
  }
  dd.innerHTML = filtered.length
    ? filtered
        .map((m) => {
          const isTaken = taken.has(m);
          return `<div class="m-dropdown-item${isTaken ? " taken" : ""}" data-movie="${esc(m)}" onclick="${isTaken ? "" : "mPickMovie(this)"}">${esc(m)}${isTaken ? ' <span style="font-size:11px;">(taken)</span>' : ""}</div>`;
        })
        .join("")
    : '<div class="m-dropdown-empty">No movies found</div>';
  dd.classList.add("open");
}
async function mPickMovie(el) {
  const movie = el.getAttribute("data-movie");
  if (!movie || myMovies.includes(movie) || myMovies.length >= 3) return;
  myMovies.push(movie);
  const inp = document.getElementById("mSearchInput"),
    dd = document.getElementById("mDropdown");
  if (inp) inp.value = "";
  if (dd) dd.classList.remove("open");
  renderMMovieList();
  document.getElementById("mPicksCount").textContent = `${myMovies.length}/3`;
  if (inp && myMovies.length >= 3) inp.disabled = true;
  await sp(`/state/submissions/${myName.replace(/[.#$/\[\]]/g, "_")}`, {
    name: myName,
    movies: [...myMovies],
  });
}
function renderMMovieList() {
  const el = document.getElementById("mMovieList");
  if (!el) return;
  if (!myMovies.length) {
    el.innerHTML = '<p class="m-movie-empty">No picks yet — search above</p>';
    return;
  }
  el.innerHTML = myMovies
    .map(
      (m, i) =>
        `<div class="m-movie-item"><span>${esc(m)}</span><button class="m-movie-rm" onclick="mRemove(${i})">×</button></div>`,
    )
    .join("");
}
async function mRemove(idx) {
  myMovies.splice(idx, 1);
  renderMMovieList();
  const cEl = document.getElementById("mPicksCount");
  if (cEl) cEl.textContent = `${myMovies.length}/3`;
  const inp = document.getElementById("mSearchInput");
  if (inp) inp.disabled = false;
  await sp(`/state/submissions/${myName.replace(/[.#$/\[\]]/g, "_")}`, {
    name: myName,
    movies: [...myMovies],
  });
}
let myPicks = {},
  myBracketRound = null;
function mVoteScreen() {
  if (mPoll) clearInterval(mPoll);
  if (G.mode === "tournament") {
    mBracketScreen();
    return;
  }
  const mv = G.movies || [];
  myVotes = {};
  lastSent = {};
  document.getElementById("mContent").innerHTML = `
    <div class="m-phase-badge"><div class="m-phase-dot" style="background:${PALETTE[3]}"></div><span class="m-phase-label">vote</span></div>
    <p style="font-size:.82rem;color:var(--w3);margin-bottom:1.4rem;">as ${esc(myName)}</p>
    <div class="mv-list">
      ${mv
        .map(
          (
            m,
            i,
          ) => `<div class="mv-card"><div class="mv-card-header"><div class="mv-card-dot" style="background:${PALETTE[i % PALETTE.length]}"></div><div class="mv-card-title">${esc(m)}</div></div>
        <div class="mv-btns"><button class="mv-btn" id="up${i}" onclick="mToggle(${i},1)">👍</button><button class="mv-btn" id="dn${i}" onclick="mToggle(${i},-1)">👎</button></div></div>`,
        )
        .join("")}
    </div>
    <div class="mv-status" id="mvStatus">Tap to vote</div>`;
  pollUntil(["reveal", "rating"]);
}
function mBracketScreen() {
  if (mPoll) clearInterval(mPoll);
  const b = G.bracket || { round: 1, totalRounds: 1, matchups: [] };
  if (myBracketRound !== b.round) {
    myPicks = {};
    myBracketRound = b.round;
  }
  document.getElementById("mContent").innerHTML = `
    <div class="m-phase-badge"><div class="m-phase-dot" style="background:${PALETTE[3]}"></div><span class="m-phase-label">vote</span></div>
    <p style="font-size:.82rem;color:var(--w3);margin-bottom:1rem;">as ${esc(myName)}</p>
    <p class="caps" style="margin-bottom:1rem;">Round ${b.round} of ${b.totalRounds}</p>
    <div class="m-bracket-list">
      ${b.matchups
        .map((m, i) => {
          const [a, bb] = m;
          if (bb === null)
            return `<div class="m-matchup-card"><div class="m-matchup-bye">${esc(a)} advances automatically</div></div>`;
          return `<div class="m-matchup-card" data-idx="${i}">
            <button type="button" class="m-matchup-side ${myPicks[i] === a ? "picked" : ""}" data-movie="${esc(a)}">${esc(a)}</button>
            <div class="m-matchup-vs">vs</div>
            <button type="button" class="m-matchup-side ${myPicks[i] === bb ? "picked" : ""}" data-movie="${esc(bb)}">${esc(bb)}</button>
          </div>`;
        })
        .join("")}
    </div>
    <div class="mv-status" id="mvStatus">Tap your pick in each matchup</div>`;
  document.querySelectorAll(".m-matchup-side").forEach((btn) => {
    btn.addEventListener("click", () =>
      mPickMatchup(
        +btn.closest(".m-matchup-card").dataset.idx,
        btn.dataset.movie,
      ),
    );
  });
  pollBracketRound();
}
function pollBracketRound() {
  if (mPoll) clearInterval(mPoll);
  mPoll = setInterval(async () => {
    const st = await gp("/state");
    if (!st) return;
    G = st;
    if (st.phase !== "voting") {
      clearInterval(mPoll);
      mobileInit();
      return;
    }
    const liveRound = (st.bracket && st.bracket.round) || 1;
    if (liveRound !== myBracketRound) {
      clearInterval(mPoll);
      mBracketScreen(); // a new round started — re-render with the new matchups
    }
  }, 2000);
}
async function mPickMatchup(idx, movie) {
  const prev = myPicks[idx];
  if (prev === movie) return;
  myPicks[idx] = movie;
  document
    .querySelectorAll(`.m-matchup-card[data-idx="${idx}"] .m-matchup-side`)
    .forEach((btn) =>
      btn.classList.toggle("picked", btn.dataset.movie === movie),
    );
  const key = myName.replace(/[.#$/\[\]]/g, "_");
  const cur = (await gp("/state/votes")) || {};
  const patch = {};
  if (prev) patch[prev] = (cur[prev] || 0) - 1;
  patch[movie] =
    (patch[movie] !== undefined ? patch[movie] : cur[movie] || 0) + 1;
  await pp("/state/voters", { [key]: true });
  await pp("/state/votes", patch);
  const st = document.getElementById("mvStatus");
  if (st) st.textContent = "Picks update live — change anytime";
}
async function mToggle(idx, dir) {
  const m = G.movies[idx];
  myVotes[m] === dir ? delete myVotes[m] : (myVotes[m] = dir);
  mUpdateVoteUI();
  await mPushVote();
}
function mUpdateVoteUI() {
  (G.movies || []).forEach((m, i) => {
    document
      .getElementById("up" + i)
      ?.classList.toggle("up-on", myVotes[m] === 1);
    document
      .getElementById("dn" + i)
      ?.classList.toggle("dn-on", myVotes[m] === -1);
  });
  const st = document.getElementById("mvStatus");
  if (!st) return;
  const total = Object.keys(myVotes).length;
  if (!total) {
    st.textContent = "Tap to vote";
    return;
  }
  const ups = Object.values(myVotes).filter((v) => v === 1).length,
    dns = Object.values(myVotes).filter((v) => v === -1).length;
  const parts = [];
  if (ups) parts.push(`${ups} 👍`);
  if (dns) parts.push(`${dns} 👎`);
  st.textContent = parts.join("  ·  ") + " — live";
}
async function mPushVote() {
  const key = myName.replace(/[.#$/\[\]]/g, "_");
  const cur = (await gp("/state/votes")) || {};
  const patch = {};
  for (const [m, v] of Object.entries(lastSent)) patch[m] = (cur[m] || 0) - v;
  for (const [m, v] of Object.entries(myVotes)) {
    const b = patch[m] !== undefined ? patch[m] : cur[m] || 0;
    patch[m] = b + v;
  }
  lastSent = { ...myVotes };
  await pp("/state/voters", { [key]: Object.keys(myVotes).length > 0 });
  if (Object.keys(patch).length) await pp("/state/votes", patch);
}
function mRevealScreen() {
  if (mPoll) clearInterval(mPoll);
  const sorted = [...(G.movies || [])].sort(
    (a, b) => (G.votes?.[b] || 0) - (G.votes?.[a] || 0),
  );
  document.getElementById("mContent").innerHTML = `
    <div class="m-state">
      <div class="m-label" style="margin-bottom:.75rem;">Tonight's pick</div>
      <h3>${esc(sorted[0] || "...")}</h3>
      <p style="margin-top:.75rem;">Hang tight — rating opens once the host marks it watched.</p>
    </div>`;
  pollUntil(["rating"]);
}
function mRatingScreen() {
  if (mPoll) clearInterval(mPoll);
  let picked = 0;
  document.getElementById("mContent").innerHTML = `
    <div class="m-state">
      <div class="m-label" style="margin-bottom:.6rem;">How was it?</div>
      <h3>${esc(G.winner || "...")}</h3>
      <div class="star-pick-row" id="starPickRow">${[1, 2, 3, 4, 5].map((n) => `<span class="star-pick" data-n="${n}">★</span>`).join("")}</div>
      <button class="m-btn" id="submitRatingBtn">Submit Rating</button>
    </div>`;
  const row = document.getElementById("starPickRow");
  row.addEventListener("click", (e) => {
    const star = e.target.closest(".star-pick");
    if (!star) return;
    picked = +star.dataset.n;
    row
      .querySelectorAll(".star-pick")
      .forEach((s) => s.classList.toggle("on", +s.dataset.n <= picked));
  });
  document
    .getElementById("submitRatingBtn")
    .addEventListener("click", async () => {
      if (!picked) {
        alert("Tap a star rating first!");
        return;
      }
      const key = myName.replace(/[.#$/\[\]]/g, "_");
      await sp(`/state/ratings/${key}`, { name: myName, stars: picked });
      document.getElementById("mContent").innerHTML =
        `<div class="m-state"><h3>Thanks! ✓</h3><p>Your rating's in.</p></div>`;
    });
}
function pollUntil(phases) {
  if (mPoll) clearInterval(mPoll);
  mPoll = setInterval(async () => {
    const st = await gp("/state");
    if (!st) return;
    G = st;
    if (phases.includes(st.phase)) {
      clearInterval(mPoll);
      mobileInit();
    }
  }, 2500);
}

/* ══ BOOT ══ */
(async function boot() {
  await loadMovieList();
  if (IS_MOBILE) {
    await mobileInit();
  } else {
    const st = await gp("/state");
    G = st || {};
    if (G.phase === "voting") hostVote();
    else if (G.phase === "submitting") hostSubmitScreen();
    else if (G.phase === "reveal") showReveal();
    else if (G.phase === "rating") hostRatingScreen();
    else hostLobby();
  }
})();
