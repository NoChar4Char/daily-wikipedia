#!/usr/bin/env node
// Precomputes the daily articles (one per niche level) and writes them to
// public/data/<YYYY-MM-DD>.json plus public/data/index.json.
//
// Usage:
//   node scripts/generate.js                 # current site-day and the next one
//   node scripts/generate.js 2026-11-12      # specific date(s)
//   node scripts/generate.js --force ...     # overwrite existing files
//
// Existing files are never touched without --force, so a published day never changes.
// Niche levels come from scripts/lib/niche.js (all-time views + relevance).

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";
import { addDays, dayKey } from "../src/day.js";
import {
  couldBeLevel,
  levelFor,
  nicheScore,
  relevanceScore,
  scoreBounds,
} from "./lib/niche.js";
import { createRng, shuffle } from "./lib/random.js";
import {
  allTimeViews,
  getArticles,
  getSummary,
  topViewed,
} from "./lib/wiki.js";

const DATA_DIR = fileURLToPath(new URL("../public/data/", import.meta.url));

// Fixed so the candidate sequence for a date never changes. Roughly the highest
// en.wikipedia page ID as of Nov 2026.
const MAX_PAGE_ID = 84_000_000;
const BATCH_SIZE = 50;
const MAX_BATCHES = 200;

// Topics not suited to a "fun daily article" site. Extend as needed.
const BLOCKED = /suicide|self-harm|porn|xxx|sex|nude|rape|murder|massacre/i;
const NON_ARTICLE =
  /^(Main_Page$|-$|(Special|Wikipedia|File|Image|Portal|Help|Category|Template|User|Talk|Draft|Module|MediaWiki|TimedText|Book)(_talk)?:)/i;

/**
 * Scores candidate articles in order and fills any still-needed level.
 * All-time views are only fetched when the relevance score leaves the
 * article able to land in a needed level (one request per article).
 */
async function fillLevels(candidates, picks, needed, used, endMonth) {
  for (const article of candidates) {
    if (needed.every((l) => picks[l])) return;
    if (used.has(article.title) || BLOCKED.test(article.title)) continue;

    const relevance = relevanceScore(article);
    const open = needed.filter(
      (l) => !picks[l] && couldBeLevel(l, scoreBounds(relevance)),
    );
    if (open.length === 0) continue;

    const views = await allTimeViews(article.title, endMonth);
    const score = nicheScore({ ...article, allTimeViews: views });
    const level = levelFor(score);
    if (!open.includes(level)) continue;

    const summary = await getSummary(article.title);
    if (!summary || used.has(summary.title)) continue;

    picks[level] = {
      ...summary,
      score: Math.round(score * 1000) / 1000,
      allTimeViews: views,
      incomingLinks: article.incomingLinks,
      languages: article.languages,
    };
    used.add(summary.title);
    console.log(
      `  level ${level}: ${summary.title} (score ${score.toFixed(3)}, ` +
        `${views} views, ${article.incomingLinks} links, ${article.languages} languages)`,
    );
  }
}

/** Level 1 candidates: the daily most-viewed list a few days before `date`, seeded shuffle. */
async function popularCandidates(date) {
  for (let back = 2; back <= 10; back++) {
    const titles = await topViewed(addDays(date, -back));
    if (!titles) continue;
    return shuffle(
      titles
        .filter((t) => !NON_ARTICLE.test(t) && !BLOCKED.test(t))
        .map((t) => t.replaceAll("_", " ")),
      createRng(`${date}:level-1`),
    );
  }
  return [];
}

async function generateDay(date, used) {
  const endMonth = date.slice(0, 7); // views up to the start of the target month
  const picks = {};

  // Level 1 is rare among random pages, so draw it from trending articles,
  // which still have to score as level 1 on relevance + all-time views.
  const popular = await popularCandidates(date);
  const order = new Map(popular.map((t, idx) => [t, idx]));
  for (let i = 0; i < popular.length && !picks[1]; i += BATCH_SIZE) {
    const articles = await getArticles({
      titles: popular.slice(i, i + BATCH_SIZE),
    });
    articles.sort(
      (a, b) => (order.get(a.title) ?? 1e9) - (order.get(b.title) ?? 1e9),
    );
    await fillLevels(articles, picks, [1], used, endMonth);
  }

  // Levels 2–5: seeded random page IDs.
  const rng = createRng(`${date}:sample`);
  const needed = [2, 3, 4, 5];
  for (
    let batch = 0;
    batch < MAX_BATCHES && !needed.every((l) => picks[l]);
    batch++
  ) {
    const ids = Array.from(
      { length: BATCH_SIZE },
      () => 1 + Math.floor(rng() * MAX_PAGE_ID),
    );
    const byId = new Map(
      (await getArticles({ pageids: ids })).map((a) => [a.pageid, a]),
    );
    // Walk in seeded order, not API order, so the result is reproducible.
    const articles = ids.map((id) => byId.get(id)).filter(Boolean);
    await fillLevels(articles, picks, needed, used, endMonth);
  }

  const missing = [1, ...needed].filter((l) => !picks[l]);
  if (missing.length > 0) {
    throw new Error(`No article found for level(s) ${missing} on ${date}`);
  }
  return picks;
}

async function writeJson(path, value) {
  const text = await prettier.format(JSON.stringify(value), { parser: "json" });
  await writeFile(path, text);
}

async function existingDates() {
  const files = await readdir(DATA_DIR).catch(() => []);
  return files
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => f.slice(0, 10))
    .sort();
}

/** Titles already featured, so no article repeats. */
async function usedTitles(dates) {
  const used = new Set();
  for (const date of dates) {
    const day = JSON.parse(await readFile(`${DATA_DIR}${date}.json`, "utf8"));
    for (const article of Object.values(day.levels)) used.add(article.title);
  }
  return used;
}

async function generate(date, force) {
  const dates = await existingDates();
  if (dates.includes(date) && !force) {
    console.log(`${date}: already exists, skipping`);
    return;
  }
  console.log(`${date}: generating`);
  const used = await usedTitles(dates.filter((d) => d !== date));
  const levels = await generateDay(date, used);
  await writeJson(`${DATA_DIR}${date}.json`, { date, levels });
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  let dates = args.filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  if (dates.length === 0) {
    const now = new Date();
    dates = [dayKey(now), addDays(dayKey(now), 1)];
  }

  await mkdir(DATA_DIR, { recursive: true });
  for (const date of dates) await generate(date, force);
  await writeJson(`${DATA_DIR}index.json`, await existingDates());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
