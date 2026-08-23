/* ------------------------------------------------------------------
   Edit these three things and nothing else.
------------------------------------------------------------------ */

// The next time you two are in the same place. Keep the -07:00 / -04:00
// offset on the end so it means the same moment in both cities.
const MEETING_DATE = new Date("2026-09-10T22:30:00-04:00");

// Each person gets their own slideshow — drop photos in images/john/ and
// images/mary/, then list the filenames in that person's `slides`. Shots of
// the two of you go in SHARED_SLIDES below and show up for both.
// unit: "fahrenheit" or "celsius" — set per person.
const PEOPLE = {
  john: {
    name: "John",
    city: "Los Angeles, CA",
    lat: 34.0522, lon: -118.2437,
    tz: "America/Los_Angeles",
    unit: "fahrenheit",
    slides: [
      "images/john/s1.jpeg", "images/john/s2.jpeg", "images/john/s3.jpeg",
      "images/john/s4.jpeg", "images/john/s5.jpeg", "images/john/s6.jpeg",
      "images/john/s7.jpeg", "images/john/s8.jpeg", "images/john/s9.jpeg",
      "images/john/s10.jpeg", "images/john/s11.jpeg", "images/john/s12.jpeg",
      "images/john/s13.jpeg", "images/john/s14.jpeg", "images/john/s15.jpeg",
      "images/john/s16.jpeg", "images/john/s17.jpeg", "images/john/s18.jpeg",
    ],
  },
  mary: {
    name: "Mary",
    city: "Providence, RI",
    lat: 41.8240, lon: -71.4128,
    tz: "America/New_York",
    unit: "celsius",
    slides: [
      "images/mary/m1.jpeg", "images/mary/m2.jpeg", "images/mary/m3.jpeg",
      "images/mary/m4.jpeg", "images/mary/m5.jpeg", "images/mary/m6.jpeg",
    ],
  },
};

// Photos of the two of you — these appear in BOTH reels, mixed in with each
// person's own. Drop them in images/shared/ and list the filenames here.
const SHARED_SLIDES = [
  "images/shared/b1.jpeg",
  "images/shared/b2.jpeg",
  "images/shared/b3.jpeg",
  "images/shared/b4.jpeg",
];

// Reshuffle both reels on every page load. Set to false for a fixed order.
const SHUFFLE_SLIDES = true;

/* ------------------------------------------------------------------ */

const SLIDE_INTERVAL = 8000;
const WEATHER_REFRESH = 15 * 60 * 1000;
const STORAGE_KEY = "redondo:person";
const MIN_KEY = "redondo:minimized";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = (id) => document.getElementById(id);

/* ---------- countdown ---------- */

const pad = (n) => String(n).padStart(2, "0");

function renderCountdown() {
  const diff = MEETING_DATE.getTime() - Date.now();

  if (diff <= 0) {
    $("countdown").hidden = true;
    $("reunited").hidden = false;
    $("meeting-date").textContent = "";
    return true; // done — caller stops asking
  }

  const totalSecs = Math.floor(diff / 1000);
  $("cd-days").textContent = Math.floor(totalSecs / 86400);
  $("cd-hours").textContent = pad(Math.floor(totalSecs / 3600) % 24);
  $("cd-mins").textContent = pad(Math.floor(totalSecs / 60) % 60);
  $("cd-secs").textContent = pad(totalSecs % 60);
  return false;
}

function renderMeetingDate() {
  const fmt = new Intl.DateTimeFormat(undefined, {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
  $("meeting-date").textContent = fmt.format(MEETING_DATE);
}

/* ---------- clock ---------- */

const timeFormatters = {};
const dateFormatters = {};

for (const [key, p] of Object.entries(PEOPLE)) {
  timeFormatters[key] = new Intl.DateTimeFormat(undefined, {
    timeZone: p.tz, hour: "numeric", minute: "2-digit",
  });
  dateFormatters[key] = new Intl.DateTimeFormat(undefined, {
    timeZone: p.tz, weekday: "long", month: "short", day: "numeric",
  });
}

function renderClock() {
  const now = new Date();
  $("clock").textContent = timeFormatters[current].format(now);
  $("localdate").textContent = dateFormatters[current].format(now);
}

/* ---------- weather ---------- */

// WMO weather interpretation codes used by Open-Meteo.
const WX_CODES = {
  0: ["☀️", "Clear sky"],
  1: ["🌤️", "Mainly clear"],
  2: ["⛅", "Partly cloudy"],
  3: ["☁️", "Overcast"],
  // 🌁 (U+1F301) rather than 🌫️ (U+1F32B) — the latter is a Unicode 7.0
  // glyph that renders as an empty box on some platforms.
  45: ["🌁", "Fog"],
  48: ["🌁", "Freezing fog"],
  51: ["🌦️", "Light drizzle"],
  53: ["🌦️", "Drizzle"],
  55: ["🌦️", "Heavy drizzle"],
  56: ["🌧️", "Freezing drizzle"],
  57: ["🌧️", "Freezing drizzle"],
  61: ["🌧️", "Light rain"],
  63: ["🌧️", "Rain"],
  65: ["🌧️", "Heavy rain"],
  66: ["🌧️", "Freezing rain"],
  67: ["🌧️", "Freezing rain"],
  71: ["🌨️", "Light snow"],
  73: ["🌨️", "Snow"],
  75: ["🌨️", "Heavy snow"],
  77: ["❄️", "Snow grains"],
  80: ["🌦️", "Light showers"],
  81: ["🌦️", "Showers"],
  82: ["⛈️", "Violent showers"],
  85: ["🌨️", "Snow showers"],
  86: ["🌨️", "Heavy snow showers"],
  95: ["⛈️", "Thunderstorm"],
  96: ["⛈️", "Thunderstorm, hail"],
  99: ["⛈️", "Thunderstorm, hail"],
};

const weatherCache = {}; // key -> { icon, temp, label, hi, lo } | { error: true }

async function fetchWeather(key) {
  const p = PEOPLE[key];
  const url = "https://api.open-meteo.com/v1/forecast"
    + `?latitude=${p.lat}&longitude=${p.lon}`
    + "&current=temperature_2m,weather_code"
    + "&daily=temperature_2m_max,temperature_2m_min"
    + `&temperature_unit=${p.unit}&timezone=${encodeURIComponent(p.tz)}&forecast_days=1`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const [icon, label] = WX_CODES[data.current.weather_code] || ["☁️", "—"];

    weatherCache[key] = {
      icon,
      label,
      unit: p.unit === "celsius" ? "C" : "F",
      temp: Math.round(data.current.temperature_2m),
      hi: Math.round(data.daily.temperature_2m_max[0]),
      lo: Math.round(data.daily.temperature_2m_min[0]),
    };
  } catch (err) {
    console.warn(`Weather lookup failed for ${p.city}:`, err);
    weatherCache[key] = { error: true };
  }

  if (key === current) renderWeather();
}

function renderWeather() {
  const wx = weatherCache[current];

  const placeholder = (label) => {
    $("wx-icon").textContent = "☁️";
    $("wx-temp").textContent = "--°";
    $("wx-label").textContent = label;
    $("wx-hi").textContent = "";
    $("wx-lo").textContent = "";
  };

  if (!wx) return placeholder("Loading weather…");
  if (wx.error) return placeholder("Weather unavailable");

  $("wx-icon").textContent = wx.icon;
  $("wx-temp").textContent = `${wx.temp}°${wx.unit}`;
  $("wx-label").textContent = wx.label;
  $("wx-hi").textContent = `H ${wx.hi}°`;
  $("wx-lo").textContent = `L ${wx.lo}°`;
}

function refreshAllWeather() {
  Object.keys(PEOPLE).forEach(fetchWeather);
}

/* ---------- person toggle ---------- */

let current = "john";

function selectPerson(key) {
  if (!PEOPLE[key]) return;
  current = key;

  for (const k of Object.keys(PEOPLE)) {
    $(`tab-${k}`).setAttribute("aria-selected", String(k === key));
  }
  $("pill").classList.toggle("is-right", key === "mary");
  document.body.dataset.person = key; // drives which map heart is lit

  $("city").textContent = PEOPLE[key].city;
  renderClock();
  renderWeather();
  paintSlide();
  startAutoAdvance();

  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch (err) {
    /* private browsing — the toggle still works, it just won't be remembered */
  }
}

/* ---------- slideshow ---------- */

// Each person keeps their own reel and their own place in it, so switching
// back to someone returns to the photo they were on.
const reels = {};
for (const key of Object.keys(PEOPLE)) reels[key] = { slides: [], index: 0 };

let activeLayer = "a";
let slideTimer = null;

// Fisher-Yates, on a copy — every position is equally likely.
function shuffle(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// A filename that doesn't resolve would otherwise show as a blank frame, so
// keep only the ones that load and let the rest fall off quietly.
function loadSlides(paths) {
  return Promise.all(paths.map((src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => {
      console.warn(`Slideshow image not found: ${src}`);
      resolve(null);
    };
    img.src = src;
  }))).then((results) => results.filter(Boolean));
}

// Paints whatever the current person's reel is pointing at. Called both when
// stepping through photos and when switching people.
function paintSlide() {
  const reel = reels[current];
  const hasPhotos = reel.slides.length > 0;

  document.body.classList.toggle("no-photos", !hasPhotos);
  $("prev").hidden = $("next").hidden = reel.slides.length < 2;

  if (!hasPhotos) {
    // Clear both layers so the other person's photo doesn't linger behind.
    document.querySelectorAll(".slide").forEach((el) => el.classList.remove("is-active"));
    return;
  }

  const incoming = activeLayer === "a" ? "b" : "a";
  const el = document.querySelector(`.slide[data-layer="${incoming}"]`);
  const other = document.querySelector(`.slide[data-layer="${activeLayer}"]`);

  el.style.backgroundImage = `url("${reel.slides[reel.index]}")`;
  el.classList.add("is-active");
  other.classList.remove("is-active");
  activeLayer = incoming;
}

function showSlide(i) {
  const reel = reels[current];
  if (!reel.slides.length) return;
  reel.index = (i + reel.slides.length) % reel.slides.length;
  paintSlide();
}

function startAutoAdvance() {
  clearInterval(slideTimer);
  if (reducedMotion || reels[current].slides.length < 2) return;
  slideTimer = setInterval(() => showSlide(reels[current].index + 1), SLIDE_INTERVAL);
}

function step(delta) {
  showSlide(reels[current].index + delta);
  startAutoAdvance(); // a manual click restarts the clock
}

/* ---------- minimize ---------- */

function setMinimized(on) {
  document.body.classList.toggle("is-minimized", on);
  $("minimize").setAttribute("aria-expanded", String(!on));
  $("minimize").setAttribute("aria-label", on ? "Expand" : "Minimize");

  try {
    localStorage.setItem(MIN_KEY, on ? "1" : "0");
  } catch (err) {
    /* private browsing — minimizing still works, it just won't be remembered */
  }
}

/* ---------- boot ---------- */

function init() {
  renderMeetingDate();

  let saved = null;
  let savedMin = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
    savedMin = localStorage.getItem(MIN_KEY);
  } catch (err) {
    /* ignore */
  }
  selectPerson(PEOPLE[saved] ? saved : "john");
  setMinimized(savedMin === "1");

  $("tab-john").addEventListener("click", () => selectPerson("john"));
  $("tab-mary").addEventListener("click", () => selectPerson("mary"));

  $("minimize").addEventListener("click", () => {
    setMinimized(!document.body.classList.contains("is-minimized"));
  });

  $("prev").addEventListener("click", () => step(-1));
  $("next").addEventListener("click", () => step(1));
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });

  // Until (or unless) photos exist, the gradient on .backdrop shows through.
  // The scrim only needs to be at full strength over real photos, so the
  // no-photos class lightens it and keeps the fallback from looking muddy.
  document.body.classList.add("no-photos");
  for (const key of Object.keys(PEOPLE)) {
    // Own photos plus the shared ones; Set guards against a photo listed twice.
    const paths = [...new Set([...PEOPLE[key].slides, ...SHARED_SLIDES])];
    loadSlides(paths).then((found) => {
      reels[key].slides = SHUFFLE_SLIDES ? shuffle(found) : found;
      if (key !== current) return; // the other reel is ready for when it's picked
      paintSlide();
      startAutoAdvance();
    });
  }

  // One timer drives both. The countdown latches off once it reaches zero,
  // but the clock has to keep ticking after that.
  let countdownDone = renderCountdown();
  renderClock();
  setInterval(() => {
    if (!countdownDone) countdownDone = renderCountdown();
    renderClock();
  }, 1000);

  refreshAllWeather();
  setInterval(refreshAllWeather, WEATHER_REFRESH);
}

init();
