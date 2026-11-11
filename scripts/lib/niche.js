// Niche score: 0 = extremely obscure, 1 = extremely mainstream.
//
// Two signals, each scaled to 0–1 on a log scale:
//   - views:     total en.wikipedia pageviews since July 2015 (all-time data)
//   - relevance: how much the rest of the world references the topic —
//                incoming links from other English articles, and how many
//                language editions of Wikipedia have an article on it.
// Relevance carries most of the weight, so a widely-referenced topic that
// nobody happens to read is still "common", and a viral page that nothing
// links to is still "niche".

export const WEIGHTS = { views: 0.25, relevance: 0.75 };

// Values at or above these caps score 1.
const CAPS = {
  views: 50_000_000,
  incomingLinks: 20_000,
  languages: 250,
};

// Minimum score for each level; anything below level 4's minimum is level 5.
export const LEVEL_MIN_SCORE = { 1: 0.7, 2: 0.55, 3: 0.4, 4: 0.25, 5: 0 };

const logNorm = (x, cap) =>
  Math.min(1, Math.log10(1 + Math.max(0, x)) / Math.log10(1 + cap));

export function relevanceScore({ incomingLinks, languages }) {
  return (
    0.5 * logNorm(incomingLinks, CAPS.incomingLinks) +
    0.5 * logNorm(languages, CAPS.languages)
  );
}

export function viewScore(allTimeViews) {
  return logNorm(allTimeViews, CAPS.views);
}

export function nicheScore({ allTimeViews, incomingLinks, languages }) {
  return (
    WEIGHTS.views * viewScore(allTimeViews) +
    WEIGHTS.relevance * relevanceScore({ incomingLinks, languages })
  );
}

export function levelFor(score) {
  for (const level of [1, 2, 3, 4]) {
    if (score >= LEVEL_MIN_SCORE[level]) return level;
  }
  return 5;
}

/** Score range a page can still reach once its relevance is known. */
export function scoreBounds(relevance) {
  const base = WEIGHTS.relevance * relevance;
  return [base, base + WEIGHTS.views];
}

/** Whether a page with this score range could land in `level`. */
export function couldBeLevel(level, [lo, hi]) {
  const min = LEVEL_MIN_SCORE[level];
  const max = level === 1 ? Infinity : LEVEL_MIN_SCORE[level - 1];
  return hi >= min && lo < max;
}
