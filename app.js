// ===== Config =====
// Same API as the original project. Rates for one currency live at /currencies/<code>.json
// Response shape: { "date": "2026-10-26", "usd": { "inr": 83.1, "eur": 0.92, ... } }
const BASE_URL =
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies";

// ===== Element references (all ids exist in index.html) =====
const $ = (id) => document.getElementById(id);
const form = $("converterForm");
const amountInput = $("amount");
const amountError = $("amountError");
const fromSelect = $("fromSelect");
const toSelect = $("toSelect");
const fromFlag = $("fromFlag");
const toFlag = $("toFlag");
const swapBtn = $("swapBtn");
const convertBtn = $("convertBtn");
const copyBtn = $("copyBtn");
const copyLabel = $("copyLabel");
const resetBtn = $("resetBtn");
const themeBtn = $("themeBtn");
const menuBtn = $("menuBtn");
const menu = $("menu");

const states = {
  empty: $("stEmpty"),
  loading: $("stLoading"),
  error: $("stError"),
  success: $("stSuccess"),
};

let lastResultText = "";

// ===== Dropdowns and flags =====
function populateSelect(select, defaultCode) {
  for (const code in countryList) {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = code;
    option.selected = code === defaultCode;
    select.append(option);
  }
}

function updateFlag(select, img) {
  const countryCode = countryList[select.value];
  img.style.visibility = "visible";
  // If a flag does not exist, hide the broken image instead of showing an error icon
  img.onerror = () => { img.style.visibility = "hidden"; };
  img.src = `https://flagsapi.com/${countryCode}/flat/64.png`;
}

populateSelect(fromSelect, "USD");
populateSelect(toSelect, "INR");
updateFlag(fromSelect, fromFlag);
updateFlag(toSelect, toFlag);

fromSelect.addEventListener("change", () => updateFlag(fromSelect, fromFlag));
toSelect.addEventListener("change", () => updateFlag(toSelect, toFlag));

// ===== UI state helper: shows exactly one of empty / loading / error / success =====
function showState(name, message) {
  for (const key in states) states[key].hidden = key !== name;
  if (name === "error") states.error.textContent = message;
}

// ===== API =====
// Backup host for the same data, used only if the main CDN request fails
const FALLBACK_URL = "https://latest.currency-api.pages.dev/v1/currencies";

async function fetchRates(baseCode) {
  let lastError;
  for (const root of [BASE_URL, FALLBACK_URL]) {
    try {
      const response = await fetch(`${root}/${baseCode}.json`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data[baseCode]) throw new Error("Unexpected API response");
      return data; // { date, [baseCode]: { ...rates } }
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

// ===== Validation =====
function parseAmount(raw) {
  const cleaned = raw.replace(/,/g, "").trim();
  if (cleaned === "") return { error: "Please enter an amount." };
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return { error: "Amount must be a number, for example 250.50." };
  if (value < 0) return { error: "Amount cannot be negative." };
  if (value === 0) return { error: "Amount must be greater than zero." };
  return { value };
}

function setAmountError(message) {
  amountError.hidden = !message;
  amountError.textContent = message || "";
  amountInput.setAttribute("aria-invalid", message ? "true" : "false");
}

// ===== Conversion =====
const money = (n) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

let requestId = 0; // lets us ignore an old response if a newer conversion started

async function convert() {
  const parsed = parseAmount(amountInput.value);
  if (parsed.error) {
    setAmountError(parsed.error);
    amountInput.focus();
    return;
  }
  setAmountError("");

  const id = ++requestId;
  const amount = parsed.value;
  const fromCode = fromSelect.value;
  const toCode = toSelect.value;
  const from = fromCode.toLowerCase();
  const to = toCode.toLowerCase();

  showState("loading");
  convertBtn.disabled = true;

  try {
    let rate;
    let date = "";
    if (from === to) {
      rate = 1;
    } else {
      const data = await fetchRates(from);
      rate = data[from][to];
      date = data.date || "";
      if (typeof rate !== "number") throw new Error("Rate not available");
    }
    if (id !== requestId) return; // a newer conversion replaced this one
    showResult(amount, fromCode, toCode, rate, date);
  } catch (err) {
    if (id !== requestId) return;
    console.error("Exchange rate error:", err);
    const offline = !navigator.onLine;
    showState(
      "error",
      offline
        ? "You appear to be offline. Check your connection and try again."
        : `Could not get the ${fromCode} to ${toCode} rate. Check your connection or try a different pair.`
    );
  } finally {
    if (id === requestId) convertBtn.disabled = false;
  }
}

function showResult(amount, fromCode, toCode, rate, date) {
  const converted = amount * rate;
  const rateText = rate >= 1 ? rate.toFixed(4) : rate.toPrecision(4);

  $("resFrom").textContent = `${money(amount)} ${fromCode} =`;
  $("resTo").textContent = `${money(converted)} ${toCode}`;
  $("resRate").textContent = `Exchange rate: 1 ${fromCode} = ${rateText} ${toCode}`;
  $("resDate").textContent = date ? `Rate date: ${date}` : "";
  lastResultText = `${money(amount)} ${fromCode} = ${money(converted)} ${toCode}`;

  showState("success");
  // Re-trigger the pop-in animation on every new result
  states.success.style.animation = "none";
  void states.success.offsetWidth;
  states.success.style.animation = "";
}

// ===== Events (each registered once) =====
form.addEventListener("submit", (evt) => {
  evt.preventDefault(); // stops the page reload
  convert();
});

swapBtn.addEventListener("click", () => {
  [fromSelect.value, toSelect.value] = [toSelect.value, fromSelect.value];
  updateFlag(fromSelect, fromFlag);
  updateFlag(toSelect, toFlag);
  swapBtn.classList.toggle("spin");
  if (!states.success.hidden) convert(); // keep the shown result in sync
});

copyBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(lastResultText);
    copyLabel.textContent = "Copied";
  } catch {
    copyLabel.textContent = "Copy failed";
  }
  setTimeout(() => (copyLabel.textContent = "Copy result"), 1800);
});

resetBtn.addEventListener("click", () => {
  amountInput.value = "100";
  fromSelect.value = "USD";
  toSelect.value = "INR";
  updateFlag(fromSelect, fromFlag);
  updateFlag(toSelect, toFlag);
  setAmountError("");
  showState("empty");
});

// ===== Popular pairs (rates shown only after the API responds) =====
const pairButtons = document.querySelectorAll(".pair");

async function loadPairRates() {
  const bases = [...new Set([...pairButtons].map((b) => b.dataset.from.toLowerCase()))];
  const results = {};
  await Promise.all(
    bases.map(async (base) => {
      try {
        results[base] = (await fetchRates(base))[base];
      } catch (err) {
        console.error(`Could not load ${base} rates:`, err);
      }
    })
  );
  pairButtons.forEach((btn) => {
    const rate = results[btn.dataset.from.toLowerCase()]?.[btn.dataset.to.toLowerCase()];
    btn.querySelector(".pair-rate").textContent =
      typeof rate === "number" ? `1 ${btn.dataset.from} = ${rate.toFixed(4)} ${btn.dataset.to}` : "Rate unavailable";
  });
}

pairButtons.forEach((btn) =>
  btn.addEventListener("click", () => {
    fromSelect.value = btn.dataset.from;
    toSelect.value = btn.dataset.to;
    updateFlag(fromSelect, fromFlag);
    updateFlag(toSelect, toFlag);
    $("converter").scrollIntoView({ behavior: "smooth" });
    convert();
  })
);
loadPairRates();

// ===== Theme toggle =====
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const toLight = theme === "dark";
  themeBtn.innerHTML = `<i class="fa-solid ${toLight ? "fa-sun" : "fa-moon"}"></i>`;
  themeBtn.setAttribute("aria-label", toLight ? "Switch to light theme" : "Switch to dark theme");
}
try {
  applyTheme(localStorage.getItem("cf-theme") || "dark");
} catch {
  applyTheme("dark");
}
themeBtn.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  try { localStorage.setItem("cf-theme", next); } catch {}
});

// ===== Mobile menu =====
function setMenu(open) {
  menu.classList.toggle("open", open);
  menuBtn.setAttribute("aria-expanded", String(open));
  menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
}
menuBtn.addEventListener("click", () => setMenu(!menu.classList.contains("open")));
menu.addEventListener("click", (e) => { if (e.target.tagName === "A") setMenu(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

// ===== Footer year =====
$("year").textContent = new Date().getFullYear();
