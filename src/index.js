import { dayKey, nextReset } from "./day.js";

const DATA_URL = `${import.meta.env.BASE_URL}data/`;
const LEVEL_STORAGE_KEY = "niche-level";

const $ = (selector) => document.querySelector(selector);

const els = {
  articleView: $(".daily-article"),
  archiveView: $(".archive"),
  archiveList: $(".archive__list"),
  level: $("#niche-level"),
  title: $(".article__title"),
  date: $(".article__date"),
  description: $(".article__description"),
  thumb: $(".article__thumb"),
  summary: $(".article__summary"),
  link: $(".article__link"),
  views: $(".article__views"),
  next: $(".article__next"),
};

const today = dayKey();
const params = new URLSearchParams(location.search);

function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode etc.); the default level still works.
  }
}

function formatDate(key) {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString(undefined, {
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

async function fetchJson(path) {
  const res = await fetch(`${DATA_URL}${path}`);
  if (!res.ok) throw new Error(`${res.status} loading ${path}`);
  return res.json();
}

function showMessage(title, message) {
  els.title.textContent = title;
  els.description.textContent = "";
  els.summary.textContent = message;
  els.thumb.hidden = true;
  els.link.hidden = true;
  els.views.textContent = "";
}

function renderArticle(article) {
  els.title.textContent = article.title;
  els.description.textContent = article.description ?? "";
  els.summary.textContent = article.extract;
  els.link.href = article.url;
  els.link.hidden = false;
  const plural = (n, word) =>
    `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
  els.views.textContent = [
    `${plural(article.allTimeViews, "view")} since 2015`,
    `linked from ${plural(article.incomingLinks, "article")}`,
    `in ${plural(article.languages, "language")}`,
  ].join(" · ");
  if (article.thumbnail) {
    els.thumb.src = article.thumbnail;
    els.thumb.alt = article.title;
    els.thumb.hidden = false;
  } else {
    els.thumb.hidden = true;
  }
}

function renderCountdown(date) {
  if (date !== today) {
    els.next.innerHTML = `<a href="./">Go to today's article</a>`;
    return;
  }
  const ms = nextReset() - Date.now();
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  els.next.textContent = `New articles every day at 4:00 AM UTC+8 (in ${hours}h ${minutes}m).`;
}

async function showArticle() {
  const requested = params.get("date");
  // Only past days and today; later days may already be generated but stay hidden.
  const date =
    requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested <= today
      ? requested
      : today;

  const savedLevel = storageGet(LEVEL_STORAGE_KEY);
  if (savedLevel && els.level.querySelector(`option[value="${savedLevel}"]`)) {
    els.level.value = savedLevel;
  }

  els.date.textContent = formatDate(date);
  renderCountdown(date);
  showMessage("Loading…", "");

  let day;
  try {
    day = await fetchJson(`${date}.json`);
  } catch {
    showMessage(
      "No article yet",
      "There's no article for this day yet. Check back soon.",
    );
    return;
  }

  const render = () => renderArticle(day.levels[els.level.value]);
  els.level.addEventListener("change", () => {
    storageSet(LEVEL_STORAGE_KEY, els.level.value);
    render();
  });
  render();
}

async function showArchive() {
  els.articleView.hidden = true;
  els.archiveView.hidden = false;
  document.title = "Archive · Daily Wikipedia";

  let dates = [];
  try {
    dates = (await fetchJson("index.json")).filter((d) => d <= today);
  } catch {
    // Falls through to the empty message.
  }
  if (dates.length === 0) {
    els.archiveList.innerHTML = "<li>No past articles yet.</li>";
    return;
  }
  els.archiveList.replaceChildren(
    ...dates.reverse().map((date) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = `?date=${date}`;
      a.textContent = formatDate(date);
      li.append(a);
      return li;
    }),
  );
}

if (params.get("view") === "archive") {
  showArchive();
} else {
  showArticle();
}
