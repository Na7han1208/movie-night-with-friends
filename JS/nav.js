// ─── SHARED NAVIGATION ───────────────────────────────────────────────────────
function initNav(current) {
  const navHTML = `
    <nav class="nav" id="siteNav">
      <a class="nav-logo" href="./index.html"><span class="nl-dot"></span>Digital Arts Movie Night</a>
      <ul class="nav-links">
        <li><a href="./index.html" data-id="home">Home</a></li>
        <li><a href="./night.html" data-id="night">Play</a></li>
        <li><a href="${letterboxdUrl()}" target="_blank" rel="noopener">Letterboxd ↗</a></li>
      </ul>
      <a class="nav-cta" href="./night.html">▶ Start a Night</a>
      <button class="nav-ham" id="hamBtn" aria-label="Menu"><span></span><span></span><span></span></button>
    </nav>
    <div class="mob-nav" id="mobNav">
      <a href="./index.html" data-id="home">Home</a>
      <a href="./night.html" data-id="night">Play</a>
      <a href="${letterboxdUrl()}" target="_blank" rel="noopener">Letterboxd ↗</a>
      <a class="mob-cta" href="./night.html">▶ Start a Night</a>
    </div>`;
  document.body.insertAdjacentHTML("afterbegin", navHTML);
  document
    .querySelectorAll(`[data-id="${current}"]`)
    .forEach((el) => el.classList.add("active"));

  const nav = document.getElementById("siteNav");
  window.addEventListener(
    "scroll",
    () => nav.classList.toggle("stuck", window.scrollY > 40),
    { passive: true },
  );

  const ham = document.getElementById("hamBtn");
  const mob = document.getElementById("mobNav");
  ham.addEventListener("click", () => {
    const open = mob.classList.toggle("open");
    ham.classList.toggle("open", open);
    document.body.style.overflow = open ? "hidden" : "";
  });
  mob.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      mob.classList.remove("open");
      ham.classList.remove("open");
      document.body.style.overflow = "";
    }),
  );
}

function injectFooter() {
  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <footer>
      <div class="foot-in">
        <div class="foot-logo"><span class="nl-dot"></span>Digital Arts Movie Night</div>
        <ul class="foot-links">
          <li><a href="./night.html">Play</a></li>
          <li><a href="${letterboxdUrl()}" target="_blank" rel="noopener">Letterboxd</a></li>
        </ul>
        <span class="foot-copy">Pick a movie. Watch it. Rate it.</span>
      </div>
    </footer>`,
  );
}

function initScrollFade() {
  const els = document.querySelectorAll(".fade");
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("vis");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.08 },
  );
  els.forEach((el) => io.observe(el));
}
