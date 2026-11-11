// Thin wrappers around the Wikipedia / Wikidata / Wikimedia pageviews APIs.

const USER_AGENT =
  "daily-wikipedia-bot/1.0 (https://github.com/NoChar4Char/daily-wikipedia)";
const API = "https://en.wikipedia.org/w/api.php";
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const REST = "https://en.wikipedia.org/api/rest_v1";
const PAGEVIEWS = "https://wikimedia.org/api/rest_v1/metrics/pageviews";

// Wikidata sitelinks ending in "wiki" that are not language Wikipedias.
const NOT_LANGUAGE_WIKIS = new Set([
  "commonswiki",
  "specieswiki",
  "metawiki",
  "mediawikiwiki",
  "wikidatawiki",
  "sourceswiki",
  "outreachwiki",
  "wikimaniawiki",
  "incubatorwiki",
  "foundationwiki",
  "wikifunctionswiki",
]);

export async function getJson(url, attempt = 1) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (res.ok) return res.json();
  if (res.status === 404) return null;
  if (attempt < 4 && (res.status === 429 || res.status >= 500)) {
    await new Promise((r) => setTimeout(r, 2000 * attempt));
    return getJson(url, attempt + 1);
  }
  throw new Error(`${res.status} ${res.statusText} for ${url}`);
}

function query(base, params) {
  const qs = new URLSearchParams({ format: "json", ...params });
  return getJson(`${base}?${qs}`);
}

/**
 * Looks up pages by ID or title and returns real articles only (main namespace,
 * not redirects, not disambiguation pages), each with its relevance signals:
 * { pageid, title, incomingLinks, languages }.
 */
export async function getArticles({ pageids, titles }) {
  const data = await query(API, {
    action: "query",
    formatversion: "2",
    ...(pageids ? { pageids: pageids.join("|") } : {}),
    ...(titles ? { titles: titles.join("|"), redirects: "1" } : {}),
    prop: "info|pageprops|cirrusdoc",
    ppprop: "disambiguation|wikibase_item",
    cdincludes: "incoming_links",
  });

  const pages = (data?.query?.pages ?? []).filter(
    (p) =>
      !p.missing &&
      p.ns === 0 &&
      !p.redirect &&
      p.pageprops?.disambiguation === undefined,
  );

  const qids = pages.map((p) => p.pageprops?.wikibase_item).filter(Boolean);
  const languages = await languageCounts(qids);

  const articles = [];
  for (const p of pages) {
    articles.push({
      pageid: p.pageid,
      title: p.title,
      // The search index hasn't counted links for very new pages yet.
      incomingLinks:
        p.cirrusdoc?.[0]?.source?.incoming_links ??
        (await countIncomingLinks(p.title)),
      languages: languages.get(p.pageprops?.wikibase_item) ?? 1,
    });
  }
  return articles;
}

/** Articles linking to `title` (counts up to 500; plenty for the score's log scale). */
async function countIncomingLinks(title) {
  const data = await query(API, {
    action: "query",
    formatversion: "2",
    titles: title,
    prop: "linkshere",
    lhnamespace: "0",
    lhshow: "!redirect",
    lhlimit: "500",
  });
  return data?.query?.pages?.[0]?.linkshere?.length ?? 0;
}

/** Number of language Wikipedias covering each Wikidata item. */
async function languageCounts(qids) {
  const counts = new Map();
  for (let i = 0; i < qids.length; i += 50) {
    const data = await query(WIKIDATA_API, {
      action: "wbgetentities",
      ids: qids.slice(i, i + 50).join("|"),
      props: "sitelinks",
    });
    for (const [qid, entity] of Object.entries(data?.entities ?? {})) {
      const keys = Object.keys(entity.sitelinks ?? {});
      counts.set(
        qid,
        keys.filter((k) => k.endsWith("wiki") && !NOT_LANGUAGE_WIKIS.has(k))
          .length,
      );
    }
  }
  return counts;
}

/** Total user pageviews from July 2015 up to the start of `endMonth` ("YYYY-MM"). */
export async function allTimeViews(title, endMonth) {
  const end = `${endMonth.replace("-", "")}0100`;
  const data = await getJson(
    `${PAGEVIEWS}/per-article/en.wikipedia/all-access/user/${encodeURIComponent(
      title.replaceAll(" ", "_"),
    )}/monthly/2015070100/${end}`,
  );
  return (data?.items ?? []).reduce((sum, item) => sum + item.views, 0);
}

/** Daily most-viewed list ("YYYY-MM-DD"), or null if not available yet. */
export async function topViewed(date) {
  const [y, m, d] = date.split("-");
  const data = await getJson(
    `${PAGEVIEWS}/top/en.wikipedia/all-access/${y}/${m}/${d}`,
  );
  return data?.items?.[0]?.articles.map((a) => a.article) ?? null;
}

/** Display summary for a normal article, or null (disambiguation, missing, …). */
export async function getSummary(title) {
  const data = await getJson(
    `${REST}/page/summary/${encodeURIComponent(title.replaceAll(" ", "_"))}`,
  );
  if (!data || data.type !== "standard") return null;
  return {
    title: data.title,
    description: data.description ?? null,
    extract: data.extract,
    url: data.content_urls.desktop.page,
    thumbnail: data.thumbnail?.source ?? null,
  };
}
