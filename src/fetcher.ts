import axios from "axios";
import RSSParser from "rss-parser";
import { getSeenIds } from "./store";
import { SiteEntry, siteKey } from "./config";

export interface Article {
  id: number | string;
  title: string;
  link: string;
  date: string;
  categoryNames: string[];
  siteKey: string;
  siteName: string;
  siteColor: string;
  siteIcon: string;
  thumbnailUrl?: string;
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const rssParser = new RSSParser({
  headers: { "User-Agent": UA },
  timeout: 15000,
});

// ─── WP REST API ───

interface WPPost {
  id: number;
  title: { rendered: string };
  link: string;
  date: string;
  categories: number[];
  _embedded?: {
    "wp:featuredmedia"?: Array<{
      source_url?: string;
      media_details?: { sizes?: { large?: { source_url?: string } } };
    }>;
  };
}

const categoryCache = new Map<string, string>();

async function getCategoryName(apiBase: string, categoryId: number): Promise<string> {
  const cacheKey = `${apiBase}:${categoryId}`;
  if (categoryCache.has(cacheKey)) return categoryCache.get(cacheKey)!;
  try {
    const res = await axios.get(`${apiBase}/categories/${categoryId}`, {
      headers: { "User-Agent": UA },
      timeout: 10000,
    });
    categoryCache.set(cacheKey, res.data.name);
    return res.data.name;
  } catch {
    return "不明";
  }
}

async function fetchViaAPI(site: SiteEntry, key: string, maxPosts: number): Promise<Article[]> {
  const res = await axios.get<WPPost[]>(`${site.apiBase}/posts`, {
    params: {
      per_page: 10, orderby: "date", order: "desc",
      _fields: "id,title,link,date,categories,_links", _embed: true,
    },
    headers: {
      "User-Agent": UA,
      "Accept": "application/json, text/html,*/*",
      "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
      "Referer": site.url,
    },
    timeout: 15000,
  });

  const seenIds = getSeenIds(key);
  const newPosts = res.data.filter((p) => !seenIds.includes(p.id));
  const limited = newPosts.slice(0, maxPosts);
  const articles: Article[] = [];

  for (const post of limited) {
    const categoryNames = await Promise.all(
      post.categories.map((cid) => getCategoryName(site.apiBase, cid))
    );
    const featuredMedia = post._embedded?.["wp:featuredmedia"]?.[0];
    const thumbnailUrl =
      featuredMedia?.media_details?.sizes?.large?.source_url ??
      featuredMedia?.source_url ??
      undefined;
    articles.push({
      id: post.id,
      title: post.title.rendered,
      link: post.link,
      date: post.date,
      categoryNames,
      siteKey: key,
      siteName: site.name,
      siteColor: site.color,
      siteIcon: new URL("/favicon.ico", site.url).href,
      thumbnailUrl,
    });
  }
  return articles;
}

// ─── RSS フィード ───

function extractImageFromContent(content: string): string | undefined {
  const match = content.match(/<img[^>]+src=["']([^"']+)["']/);
  return match?.[1];
}

async function fetchViaRSS(site: SiteEntry, key: string, maxPosts: number): Promise<Article[]> {
  const feedUrl = site.url.replace(/\/?$/, "/feed/");
  console.log(`[fetcher] RSS フォールバック: ${feedUrl}`);

  const feed = await rssParser.parseURL(feedUrl);
  const seenIds = getSeenIds(key);
  const articles: Article[] = [];

  for (const item of feed.items ?? []) {
    if (!item.link) continue;
    // RSSにはnumeric IDがないのでリンクをIDとして使う
    const id = item.link;
    if (seenIds.includes(id)) continue;
    if (articles.length >= maxPosts) break;

    const categoryNames = item.categories ?? [];
    const thumbnailUrl = extractImageFromContent(item["content:encoded"] || item.content || "");

    articles.push({
      id,
      title: item.title || "(タイトルなし)",
      link: item.link,
      date: item.isoDate || item.pubDate || new Date().toISOString(),
      categoryNames,
      siteKey: key,
      siteName: site.name,
      siteColor: site.color,
      siteIcon: new URL("/favicon.ico", site.url).href,
      thumbnailUrl,
    });
  }

  return articles;
}

// ─── メイン ───

export async function fetchNewArticles(
  sites: SiteEntry[],
  maxPosts: number
): Promise<Article[]> {
  const enabledSites = sites.filter((s) => s.enabled);
  const allArticles: Article[] = [];

  for (const site of enabledSites) {
    const key = siteKey(site);
    try {
      console.log(`[fetcher] ${site.name} の記事を取得中...`);
      const articles = await fetchViaAPI(site, key, maxPosts);
      allArticles.push(...articles);
      console.log(`[fetcher] ${site.name}: ${articles.length}件の新着記事 (API)`);
    } catch (err: any) {
      console.log(`[fetcher] ${site.name} API失敗 (${err.response?.status || "error"}), RSSを試行...`);
      try {
        const articles = await fetchViaRSS(site, key, maxPosts);
        allArticles.push(...articles);
        console.log(`[fetcher] ${site.name}: ${articles.length}件の新着記事 (RSS)`);
      } catch (rssErr) {
        console.error(`[fetcher] ${site.name} RSS も失敗:`, (rssErr as Error).message);
      }
    }
  }

  return allArticles;
}
