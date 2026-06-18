// ─── FIREBASE HELPERS ────────────────────────────────────────────────────────
const DB = CONFIG.firebaseUrl;

async function dbGet(path) {
  try {
    const r = await fetch(`${DB}${path}.json`);
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}
async function dbSet(path, data) {
  try {
    await fetch(`${DB}${path}.json`, {
      method: "PUT",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("dbSet failed", e);
  }
}
async function dbPatch(path, data) {
  try {
    await fetch(`${DB}${path}.json`, {
      method: "PATCH",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("dbPatch failed", e);
  }
}
async function dbDelete(path = "") {
  try {
    await fetch(`${DB}${path}.json`, { method: "DELETE" });
  } catch (e) {
    console.error("dbDelete failed", e);
  }
}
function uid(len = 8) {
  return Math.random()
    .toString(36)
    .slice(2, 2 + len);
}
function esc(s) {
  const d = document.createElement("div");
  d.textContent = s || "";
  return d.innerHTML;
}
function letterboxdUrl() {
  return `https://letterboxd.com/${encodeURIComponent(CONFIG.letterboxdUsername)}/`;
}
