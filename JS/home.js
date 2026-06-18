// ─── HOMEPAGE LOGIC ──────────────────────────────────────────────────────────

async function checkLiveNight() {
  const roomId = sessionStorage.getItem("mn_room");
  if (!roomId) return;
  const state = await dbGet(`/room_${roomId}/state`);
  if (!state || !state.phase || state.phase === "reveal") return;
  const labels = {
    waiting: "A lobby is open",
    submitting: "Picks are coming in",
    voting: "Voting is live",
    rating: "Rating is open",
  };
  document.getElementById("liveAlertText").textContent =
    labels[state.phase] || "A night is in progress";
  document.getElementById("liveAlertLink").href = `./night.html?room=${roomId}`;
  document.getElementById("liveAlert").classList.add("show");
}

function renderCarousel() {
  document.getElementById("themeCarousel").innerHTML = THEMES.map(
    (t) => `
    <a href="./night.html?theme=${encodeURIComponent(t.n)}" class="tc">
      <div class="tc-bg" style="background:${t.g}"></div>
      <span class="tc-emoji">${t.e}</span>
      <div class="tc-foot"><div class="tc-name">${esc(t.n)}</div><div class="tc-desc">${esc(t.d)}</div></div>
    </a>`,
  ).join("");
  document
    .getElementById("crslPrev")
    .addEventListener("click", () =>
      document
        .getElementById("themeCarousel")
        .scrollBy({ left: -530, behavior: "smooth" }),
    );
  document
    .getElementById("crslNext")
    .addEventListener("click", () =>
      document
        .getElementById("themeCarousel")
        .scrollBy({ left: 530, behavior: "smooth" }),
    );
}

let activeFilter = "all",
  vaultShown = 24;
function renderFilterPills() {
  document.getElementById("vaultFilters").innerHTML = FILTERS.map(
    (f) =>
      `<button class="fp ${f.id === activeFilter ? "on" : ""}" data-f="${f.id}">${esc(f.l)}</button>`,
  ).join("");
  document.querySelectorAll(".fp").forEach((btn) =>
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.f;
      vaultShown = 24;
      renderFilterPills();
      renderVault();
    }),
  );
}
function getFilteredMovies() {
  const q = document.getElementById("vaultSearch").value.trim().toLowerCase();
  return MOVIES.filter(
    (m) =>
      (activeFilter === "all" || m.k.includes(activeFilter)) &&
      (!q || m.t.toLowerCase().includes(q)),
  );
}
function renderVault() {
  const filtered = getFilteredMovies();
  const shown = filtered.slice(0, vaultShown);
  document.getElementById("vaultCount").textContent =
    `${filtered.length} movies`;
  document.getElementById("vaultGrid").innerHTML = shown
    .map((m) => {
      const color = CONFIG.accents[m.t.charCodeAt(0) % CONFIG.accents.length];
      return `<div class="mc"><div class="mc-stripe" style="background:${color}"></div>
      <div class="mc-title">${esc(m.t)}</div>
      <div class="mc-tags">${m.k
        .slice(0, 2)
        .map((tag) => `<span class="mc-tag">${esc(tag)}</span>`)
        .join("")}</div></div>`;
    })
    .join("");
  document.getElementById("vaultMoreBtn").style.display =
    filtered.length > vaultShown ? "flex" : "none";
}

(async function initHome() {
  initNav("home");
  injectFooter();
  renderCarousel();
  renderFilterPills();
  renderVault();
  await checkLiveNight();
  initScrollFade();

  document.getElementById("vaultSearch").addEventListener("input", () => {
    vaultShown = 24;
    renderVault();
  });
  document.getElementById("vaultMoreBtn").addEventListener("click", () => {
    vaultShown += 24;
    renderVault();
  });

  // Join with code
  function joinRoom() {
    const code = document
      .getElementById("heroJoinCode")
      .value.trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    if (!code) {
      document.getElementById("heroJoinCode").focus();
      return;
    }
    window.location.href = `./night.html?room=${encodeURIComponent(code)}&vote=1`;
  }
  document.getElementById("heroJoinBtn").addEventListener("click", joinRoom);
  document.getElementById("heroJoinCode").addEventListener("keydown", (e) => {
    if (e.key === "Enter") joinRoom();
  });
})();
