// ============================================================
// CONFIGURAZIONE — modifica qui contatti, proporzioni e prezzi
// ============================================================
const CONFIG = {
  brand: "Controluce",
  whatsapp: "39XXXXXXXXXX",             // numero con prefisso internazionale, senza + né spazi
  email: "ciao@controluce.example",     // indirizzo che riceve le richieste
  // Proporzioni come nel generatore MakerLab. Misure in cm riferite alla verticale.
  // Le descrizioni sono in i18n.js ("ratio.3:4", ...).
  ratios: [
    { id: "3:4", w: 15, h: 20,   price: 25 },
    { id: "1:1", w: 15, h: 15,   price: 22 },
    { id: "2:3", w: 13, h: 19.5, price: 25 },
  ],
};

// Parametri fisici della simulazione (uguali allo shader in litho3d.js)
const SIM = { tMin: 0.8, tMax: 3.0, mu: [1.05, 1.45, 2.15], lamp: [1.0, 0.93, 0.80], plastic: [0.925, 0.915, 0.895] };

// ============================================================
// Utilità
// ============================================================
const $ = (sel, root = document) => root.querySelector(sel);
const euro = (n) => new Intl.NumberFormat(lang, { style: "currency", currency: "EUR", maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(n);
const cm = (n) => n.toLocaleString(lang);
const ratioById = (id) => CONFIG.ratios.find((r) => r.id === id);
const orientationLabel = (o) => t(`orient.${o}`);

function ratioDims(r, orientation) {
  return orientation === "portrait" ? [r.w, r.h] : [r.h, r.w];
}
const dimLabel = (r, o = "portrait") => ratioDims(r, o).map(cm).join(" × ") + " cm";

function bindPressGroup(container, onChange) {
  container.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-value]");
    if (!btn) return;
    container.querySelectorAll("button[data-value]").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    onChange?.(btn.dataset.value);
  });
}

let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-visible"), 2600);
}

// ============================================================
// Foto di esempio generata: tramonto in montagna sul lago
// ============================================================
function sampleScene(size = 1200) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const s = size / 1000;
  const horizon = 640 * s;

  const sky = g.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#3a3a3a");
  sky.addColorStop(0.55, "#9a9a9a");
  sky.addColorStop(1, "#e6e6e6");
  g.fillStyle = sky;
  g.fillRect(0, 0, size, horizon);

  const sunX = 610 * s, sunY = 470 * s;
  const halo = g.createRadialGradient(sunX, sunY, 0, sunX, sunY, 320 * s);
  halo.addColorStop(0, "rgba(255,255,255,.95)");
  halo.addColorStop(0.25, "rgba(255,255,255,.35)");
  halo.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = halo;
  g.fillRect(0, 0, size, horizon);
  g.fillStyle = "#fff";
  g.beginPath(); g.arc(sunX, sunY, 62 * s, 0, Math.PI * 2); g.fill();

  // nuvole sottili
  g.fillStyle = "rgba(255,255,255,.18)";
  [[180, 210, 260, 22], [700, 160, 320, 18], [420, 300, 220, 14], [850, 330, 200, 12]].forEach(([x, y, w, h]) => {
    g.beginPath(); g.ellipse(x * s, y * s, w * s, h * s, 0, 0, Math.PI * 2); g.fill();
  });

  // creste di montagna a strati
  function ridge(base, amp, seed, shade) {
    g.fillStyle = shade;
    g.beginPath();
    g.moveTo(0, horizon);
    for (let x = 0; x <= 1000; x += 4) {
      const y = base
        - amp * (0.55 * Math.sin(x * 0.006 + seed) + 0.3 * Math.sin(x * 0.017 + seed * 2.1) + 0.15 * Math.sin(x * 0.051 + seed * 3.7));
      g.lineTo(x * s, y * s);
    }
    g.lineTo(size, horizon);
    g.closePath();
    g.fill();
  }
  ridge(470, 120, 1.3, "#8c8c8c");
  ridge(540, 90, 4.1, "#5e5e5e");
  ridge(600, 55, 7.7, "#353535");

  // lago con riflesso
  const lake = g.createLinearGradient(0, horizon, 0, size);
  lake.addColorStop(0, "#9e9e9e");
  lake.addColorStop(1, "#2a2a2a");
  g.fillStyle = lake;
  g.fillRect(0, horizon, size, size - horizon);
  for (let i = 0; i < 26; i++) {
    const y = horizon + (8 + i * i * 0.55) * s;
    const w = (120 - i * 3.2) * s;
    g.fillStyle = `rgba(255,255,255,${0.75 - i * 0.026})`;
    g.fillRect(sunX - w / 2 + Math.sin(i * 1.7) * 14 * s, y, w, 2.4 * s);
  }

  // abeti in primo piano
  function pine(x, base, h) {
    g.fillStyle = "#141414";
    const w = h * 0.36;
    for (let k = 0; k < 6; k++) {
      const t = k / 6;
      g.beginPath();
      g.moveTo(x * s, (base - h + h * t * 0.85) * s);
      g.lineTo((x - w * (0.35 + t * 0.65)) * s, (base - h + h * (t + 0.3) * 0.85) * s);
      g.lineTo((x + w * (0.35 + t * 0.65)) * s, (base - h + h * (t + 0.3) * 0.85) * s);
      g.fill();
    }
    g.fillRect((x - 5) * s, (base - 30) * s, 10 * s, 30 * s);
  }
  g.fillStyle = "#141414";
  g.beginPath();
  g.moveTo(0, 860 * s);
  g.quadraticCurveTo(160 * s, 800 * s, 330 * s, 900 * s);
  g.lineTo(330 * s, size); g.lineTo(0, size); g.fill();
  g.beginPath();
  g.moveTo(size, 820 * s);
  g.quadraticCurveTo(840 * s, 790 * s, 700 * s, 920 * s);
  g.lineTo(700 * s, size); g.lineTo(size, size); g.fill();
  [[60, 880, 330], [150, 870, 250], [235, 900, 190], [930, 840, 360], [830, 860, 260], [760, 905, 170]].forEach(([x, b, h]) => pine(x, b, h));

  // stormo
  g.strokeStyle = "#2a2a2a";
  g.lineWidth = 3 * s;
  [[300, 250], [330, 235], [355, 262], [390, 228]].forEach(([x, y]) => {
    g.beginPath();
    g.moveTo((x - 12) * s, y * s); g.quadraticCurveTo(x * s, (y - 8) * s, x * s, y * s);
    g.quadraticCurveTo(x * s, (y - 8) * s, (x + 12) * s, y * s);
    g.stroke();
  });
  return c;
}

// ============================================================
// Simulazione 2D (miniature e confronto): stesso modello dello shader
// ============================================================
function simulate(src, lit) {
  const { width: W, height: H } = src;
  const ctx = src.getContext("2d");
  const data = ctx.getImageData(0, 0, W, H);
  const p = data.data;
  const lum = new Float32Array(W * H);
  for (let i = 0, j = 0; j < lum.length; i += 4, j++) lum[j] = p[i] / 255;
  const out = new ImageData(W, H);
  const o = out.data;
  const L = [-0.45, 0.55, 0.75];
  const ln = Math.hypot(...L);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const j = y * W + x;
      const th = 1 - lum[j];
      let r, g, b;
      if (lit) {
        const mm = SIM.tMin + (SIM.tMax - SIM.tMin) * th;
        const dx = x / W - 0.5, dy = y / H - 0.46;
        const fall = (1 - 0.55 * (dx * dx + dy * dy)) * 1.08;
        r = SIM.lamp[0] * Math.exp(-SIM.mu[0] * (mm - SIM.tMin)) * fall;
        g = SIM.lamp[1] * Math.exp(-SIM.mu[1] * (mm - SIM.tMin)) * fall;
        b = SIM.lamp[2] * Math.exp(-SIM.mu[2] * (mm - SIM.tMin)) * fall;
      } else {
        const hx = (1 - lum[y * W + Math.min(W - 1, x + 1)]) - (1 - lum[y * W + Math.max(0, x - 1)]);
        const hy = (1 - lum[Math.max(0, y - 1) * W + x]) - (1 - lum[Math.min(H - 1, y + 1) * W + x]);
        const n = [-hx * 2.2, -hy * 2.2, 1];
        const nn = Math.hypot(...n);
        const diff = Math.max(0, (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / (nn * ln));
        const k = 0.8 + 0.2 * diff;
        r = SIM.plastic[0] * k - th * 0.05;
        g = SIM.plastic[1] * k - th * 0.05;
        b = SIM.plastic[2] * k - th * 0.05;
      }
      const i = j * 4;
      o[i] = r * 255; o[i + 1] = g * 255; o[i + 2] = b * 255; o[i + 3] = 255;
    }
  }
  return out;
}

// Ritaglio "cover" con zoom e spostamento, in scala di grigi
function drawCrop(target, img, zoom = 1, panX = 0, panY = 0, blur = 0) {
  const c = target.getContext("2d", { willReadFrequently: true });
  const { width: W, height: H } = target;
  c.fillStyle = "#ddd";
  c.fillRect(0, 0, W, H);
  const scale = Math.max(W / img.width, H / img.height) * zoom;
  const dw = img.width * scale;
  const dh = img.height * scale;
  c.filter = `grayscale(1)${blur ? ` blur(${blur}px)` : ""}`;
  c.drawImage(img, (W - dw) / 2 + panX * (dw - W) / 2, (H - dh) / 2 + panY * (dh - H) / 2, dw, dh);
  c.filter = "none";
}

// ============================================================
// Studio
// ============================================================
const SAMPLE = sampleScene();
const state = {
  image: SAMPLE,
  isSample: true,
  orientation: "portrait",
  ratio: "3:4",
  zoom: 1,
  panX: 0,
  panY: 0,
  lit: true,
  qty: 1,
};

const cropBox = $("#crop");
const cropCanvas = $("#crop-canvas");
const texCanvas = document.createElement("canvas"); // texture della lastra (con lieve diffusione)

const has3D = window.LithoViewer?.supported;
const studioViewer = has3D ? new LithoViewer($("#studio-viewer"), { startAngle: -0.5 }) : null;
if (!has3D) document.body.classList.add("no-webgl");

function currentDims() {
  return ratioDims(ratioById(state.ratio), state.orientation);
}

function layout() {
  const [w, h] = currentDims();
  cropBox.style.setProperty("--ratio", `${w} / ${h}`);
  const long = 600;
  cropCanvas.width = w >= h ? long : Math.round(long * w / h);
  cropCanvas.height = h > w ? long : Math.round(long * h / w);
  texCanvas.width = cropCanvas.width;
  texCanvas.height = cropCanvas.height;
  studioViewer?.setSize(w, h);
  render();
}

function render() {
  drawCrop(cropCanvas, state.image, state.zoom, state.panX, state.panY);
  drawCrop(texCanvas, state.image, state.zoom, state.panX, state.panY, 0.8);
  studioViewer?.setTexture(texCanvas);
  if (!has3D) renderFallback();
}

// Senza WebGL: anteprima 2D simulata nello stage
function renderFallback() {
  let c = $("#studio-viewer canvas");
  if (!c) { c = document.createElement("canvas"); $("#studio-viewer").appendChild(c); }
  c.width = texCanvas.width;
  c.height = texCanvas.height;
  c.getContext("2d").putImageData(simulate(texCanvas, state.lit), 0, 0);
}

function updatePrice() {
  $("#price").textContent = euro(ratioById(state.ratio).price * state.qty);
}

function renderRatioButtons() {
  $("#ratios").innerHTML = CONFIG.ratios.map((r) => {
    const [w, h] = ratioDims(r, state.orientation);
    const k = 34 / Math.max(w, h);
    return `
      <button type="button" class="ratio" data-value="${r.id}" aria-pressed="${r.id === state.ratio}">
        <span class="ratio-shape" style="width:${Math.round(w * k)}px;height:${Math.round(h * k)}px" aria-hidden="true"></span>
        <span class="ratio-name">${r.id}</span>
        <span class="ratio-dim">${dimLabel(r, state.orientation)}</span>
      </button>`;
  }).join("");
}

bindPressGroup($("#ratios"), (id) => {
  state.ratio = id;
  state.panX = state.panY = 0;
  layout();
  updatePrice();
});

bindPressGroup($("#orientation"), (o) => {
  state.orientation = o;
  state.panX = state.panY = 0;
  renderRatioButtons();
  layout();
});

function renderLightLabel() {
  const btn = $("#light-toggle");
  btn.setAttribute("aria-pressed", String(state.lit));
  btn.lastElementChild.textContent = t(state.lit ? "studio.lightOn" : "studio.lightOff");
}

function renderUploadLabels() {
  $("#upload-title").textContent = state.isSample ? t("studio.uploadTitle") : state.fileName;
  $("#upload-sub").textContent = t(state.isSample ? "studio.uploadSub" : "studio.uploadChange");
  $("#add").textContent = t(state.isSample ? "studio.addDisabled" : "studio.add");
}

$("#light-toggle").addEventListener("click", () => {
  state.lit = !state.lit;
  renderLightLabel();
  $("#stage-light").classList.toggle("is-off", !state.lit);
  studioViewer?.setLit(state.lit);
  if (!has3D) renderFallback();
});

// Caricamento foto
const input = $("#photo-input");
const stage = $("#stage");

function loadFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) { toast(t("toast.notImage")); return; }
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(img.src);
    Object.assign(state, { image: img, isSample: false, fileName: file.name, zoom: 1, panX: 0, panY: 0 });
    $("#zoom").value = 1;
    $("#upload-btn").classList.add("has-photo");
    $("#stage-badge").hidden = true;
    $("#add").disabled = false;
    renderUploadLabels();
    render();
    renderCompare();
  };
  img.onerror = () => toast(t("toast.readError"));
  img.src = URL.createObjectURL(file);
}

input.addEventListener("change", (e) => { loadFile(e.target.files[0]); input.value = ""; });

["dragenter", "dragover"].forEach((t) => stage.addEventListener(t, (e) => { e.preventDefault(); stage.classList.add("is-over"); }));
["dragleave", "drop"].forEach((t) => stage.addEventListener(t, () => stage.classList.remove("is-over")));
stage.addEventListener("drop", (e) => { e.preventDefault(); loadFile(e.dataTransfer.files[0]); });

// Inquadratura: trascina nel riquadro e zoom
$("#zoom").addEventListener("input", (e) => { state.zoom = Number(e.target.value); render(); });

let drag = null;
cropCanvas.addEventListener("pointerdown", (e) => {
  cropCanvas.setPointerCapture(e.pointerId);
  drag = { x: e.clientX, y: e.clientY, panX: state.panX, panY: state.panY };
  cropBox.classList.add("is-dragging");
});
cropCanvas.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const rect = cropCanvas.getBoundingClientRect();
  const img = state.image;
  const W = cropCanvas.width, H = cropCanvas.height;
  const scale = Math.max(W / img.width, H / img.height) * state.zoom;
  // eccedenza dell'immagine oltre il riquadro, in pixel a schermo
  const overX = ((img.width * scale - W) / 2) * (rect.width / W);
  const overY = ((img.height * scale - H) / 2) * (rect.height / H);
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  if (overX > 0) state.panX = clamp(drag.panX + (e.clientX - drag.x) / overX);
  if (overY > 0) state.panY = clamp(drag.panY + (e.clientY - drag.y) / overY);
  render();
});
const endDrag = () => { drag = null; cropBox.classList.remove("is-dragging"); };
cropCanvas.addEventListener("pointerup", endDrag);
cropCanvas.addEventListener("pointercancel", endDrag);

// Quantità
const setQty = (n) => { state.qty = Math.max(1, Math.min(20, n)); $("#qty").textContent = state.qty; updatePrice(); };
$("#qty-dec").addEventListener("click", () => setQty(state.qty - 1));
$("#qty-inc").addEventListener("click", () => setQty(state.qty + 1));

// Miniatura accesa per il riepilogo
function thumbnail() {
  const t = document.createElement("canvas");
  const [w, h] = currentDims();
  t.width = 140;
  t.height = Math.round(140 * h / w);
  drawCrop(t, state.image, state.zoom, state.panX, state.panY, 0.4);
  t.getContext("2d").putImageData(simulate(t, true), 0, 0);
  return t.toDataURL("image/jpeg", 0.8);
}

$("#add").addEventListener("click", () => {
  addToCart({
    ratio: state.ratio,
    orientation: state.orientation,
    fileName: state.fileName,
    qty: state.qty,
    thumb: thumbnail(),
  });
});

// ============================================================
// Hero: litofania di esempio che ruota e si accende/spegne
// ============================================================
let heroLit = true;
function renderHeroState() {
  const el = $("#hero-state");
  el.classList.toggle("is-off", !heroLit);
  el.lastElementChild.textContent = t(heroLit ? "hero.on" : "hero.off");
}

if (has3D) {
  const hero = new LithoViewer($("#hero-viewer"), { autoRotate: true, startAngle: -0.6 });
  const heroTex = document.createElement("canvas");
  heroTex.width = 600;
  heroTex.height = 800;
  drawCrop(heroTex, SAMPLE, 1, 0, 0, 0.8);
  hero.setSize(15, 20);
  hero.setTexture(heroTex);

  setInterval(() => {
    heroLit = !heroLit;
    hero.setLit(heroLit);
    renderHeroState();
    $("#hero-glow").classList.toggle("is-off", !heroLit);
  }, 4000);
} else {
  const c = document.createElement("canvas");
  c.width = 450; c.height = 600;
  drawCrop(c, SAMPLE, 1, 0, 0, 0.6);
  c.getContext("2d").putImageData(simulate(c, true), 0, 0);
  $("#hero-viewer").appendChild(c);
  $("#hero-state").hidden = true;
}

// ============================================================
// Confronto spenta / accesa
// ============================================================
const compareCanvas = $("#compare-canvas");
const compareRange = $("#compare-range");
let compareImages = null;

function renderCompare() {
  const src = document.createElement("canvas");
  src.width = compareCanvas.width;
  src.height = compareCanvas.height;
  drawCrop(src, state.image, 1, 0, state.isSample ? 0.15 : 0, 0.7);
  compareImages = { off: simulate(src, false), on: simulate(src, true) };
  drawCompare();
}

function drawCompare() {
  if (!compareImages) return;
  const c = compareCanvas.getContext("2d");
  const W = compareCanvas.width;
  const split = Math.round(W * compareRange.value / 100);
  c.putImageData(compareImages.on, 0, 0);
  c.putImageData(compareImages.off, 0, 0, 0, 0, split, compareCanvas.height);
  $("#compare-handle").style.left = `${compareRange.value}%`;
}
compareRange.addEventListener("input", drawCompare);

// ============================================================
// Richiesta (carrello), salvata in localStorage
// ============================================================
const CART_KEY = "controluce-cart";
let cart = [];
try { cart = JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { cart = []; }

function saveCart() {
  try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* quota piena: resta in memoria */ }
  renderCart();
}

function addToCart(item) {
  cart.push({ ...item, key: crypto.randomUUID?.() || String(Date.now() + Math.random()) });
  saveCart();
  toast(t("toast.added", { ratio: item.ratio, orientation: orientationLabel(item.orientation) }));
}

const itemTotal = (i) => ratioById(i.ratio).price * i.qty;

function renderCart() {
  const count = cart.reduce((n, i) => n + i.qty, 0);
  const countEl = $(".cart-count");
  countEl.textContent = count;
  countEl.dataset.empty = String(count === 0);

  $("#cart-empty").hidden = cart.length > 0;
  $("#order-form").hidden = cart.length === 0;
  $("#cart-total").textContent = euro(cart.reduce((t, i) => t + itemTotal(i), 0));

  $("#cart-items").innerHTML = cart.map((i) => `
    <li class="cart-item" data-key="${i.key}">
      <div class="cart-thumb"><img src="${i.thumb}" alt=""></div>
      <div>
        <h3>${t("cart.item", { ratio: i.ratio })}</h3>
        <p>${orientationLabel(i.orientation)} · ${dimLabel(ratioById(i.ratio), i.orientation)}</p>
        <div class="qty">
          <button type="button" data-action="dec" aria-label="${t("cart.dec")}">−</button>
          <span>${i.qty}</span>
          <button type="button" data-action="inc" aria-label="${t("cart.inc")}">+</button>
        </div>
      </div>
      <div class="cart-item-side">
        <strong>${euro(itemTotal(i))}</strong>
        <button type="button" class="remove" data-action="remove">${t("cart.remove")}</button>
      </div>
    </li>`).join("");
}

$("#cart-items").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  const item = cart.find((c) => c.key === btn.closest(".cart-item").dataset.key);
  if (btn.dataset.action === "inc") item.qty += 1;
  if (btn.dataset.action === "dec") item.qty = Math.max(1, item.qty - 1);
  if (btn.dataset.action === "remove") cart = cart.filter((c) => c !== item);
  saveCart();
});

// Apertura / chiusura
const drawer = $("#cart");
const backdrop = $(".drawer-backdrop");
let lastFocus;
function openCart() {
  lastFocus = document.activeElement;
  drawer.hidden = backdrop.hidden = false;
  document.body.style.overflow = "hidden";
  $(".icon-btn", drawer).focus();
}
function closeCart() {
  drawer.hidden = backdrop.hidden = true;
  document.body.style.overflow = "";
  lastFocus?.focus();
}
document.querySelectorAll("[data-open-cart]").forEach((b) => b.addEventListener("click", openCart));
// delega: il link nel carrello vuoto viene riscritto a ogni cambio lingua
document.addEventListener("click", (e) => { if (e.target.closest("[data-close-cart]")) closeCart(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !drawer.hidden) closeCart(); });

// Invio
bindPressGroup($("#delivery"));
let channel = "whatsapp";
document.querySelectorAll(".send-actions button").forEach((b) =>
  b.addEventListener("click", () => { channel = b.dataset.channel; })
);

$("#order-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const name = form.name.value.trim();
  const contact = form.contact.value.trim();
  form.name.setAttribute("aria-invalid", String(!name));
  form.contact.setAttribute("aria-invalid", String(!contact));
  if (!name || !contact) {
    $("#form-error").textContent = t("form.error");
    return;
  }
  $("#form-error").textContent = "";

  const notes = form.notes.value.trim();
  const delivery = $('#delivery button[aria-pressed="true"]').dataset.value;
  const parts = [
    t("msg.intro", { brand: CONFIG.brand }),
    "",
    ...cart.map((i) => `• ${i.qty} × ${i.ratio} ${orientationLabel(i.orientation)} (${dimLabel(ratioById(i.ratio), i.orientation)})${i.fileName ? ` — ${t("msg.photo", { name: i.fileName })}` : ""} — ${euro(itemTotal(i))}`),
    "",
    `${t("msg.total")}: ${$("#cart-total").textContent}`,
    `${t("msg.delivery")}: ${t(delivery === "pickup" ? "form.pickupFull" : "form.shipping")}`,
    `${t("msg.name")}: ${name}`,
    `${t("msg.contact")}: ${contact}`,
    `${t("msg.language")}: ${t("lang.name")}`,
  ];
  if (notes) parts.push(`${t("msg.notes")}: ${notes}`);
  parts.push("", t("msg.attach"));
  const text = parts.join("\n");

  const url = channel === "whatsapp"
    ? `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`
    : `mailto:${CONFIG.email}?subject=${encodeURIComponent(t("msg.subject", { name }))}&body=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener");
  toast(t("toast.sent"));
});

// ============================================================
// Sezione proporzioni
// ============================================================
function renderRatioCards() {
  $("#ratio-cards").innerHTML = CONFIG.ratios.map((r) => {
    const k = 150 / Math.max(r.w, r.h);
    return `
      <article class="ratio-card">
        <div class="ratio-card-visual"><span style="width:${Math.round(r.w * k * 0.8)}px;height:${Math.round(r.h * k * 0.8)}px"></span></div>
        <div>
          <h3>${r.id}</h3>
          <p>${dimLabel(r)} · ${t(`ratio.${r.id}`)}</p>
          <strong>${euro(r.price)}</strong>
        </div>
      </article>`;
  }).join("");
}

// ============================================================
// Navigazione mobile, footer, avvio
// ============================================================
const navToggle = $(".nav-toggle");
const nav = $("#main-nav");
navToggle.addEventListener("click", () => {
  const open = navToggle.getAttribute("aria-expanded") !== "true";
  navToggle.setAttribute("aria-expanded", String(open));
  nav.classList.toggle("is-open", open);
});
nav.addEventListener("click", (e) => {
  if (!e.target.closest("a")) return;
  navToggle.setAttribute("aria-expanded", "false");
  nav.classList.remove("is-open");
});

$("#footer-contacts").innerHTML =
  `<a href="https://wa.me/${CONFIG.whatsapp}" target="_blank" rel="noopener">WhatsApp</a> · <a href="mailto:${CONFIG.email}">${CONFIG.email}</a>`;

// Testi che dipendono dalla lingua
function renderLocalized() {
  renderRatioButtons();
  renderRatioCards();
  renderLightLabel();
  renderUploadLabels();
  renderHeroState();
  updatePrice();
  renderCart();
  const [minT, maxT] = $(".thickness-scale").querySelectorAll("span");
  minT.textContent = `${cm(SIM.tMin)} mm`;
  maxT.textContent = `${cm(SIM.tMax)} mm`;
}

document.querySelectorAll("[data-lang]").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.lang)));
document.addEventListener("langchange", renderLocalized);

applyI18n();
renderLocalized();
layout();
renderCompare();
