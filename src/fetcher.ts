import axios from "axios";
import { getSeenIds } from "./store";
import { SiteEntry, siteKey } from "./config";

export interface WPPost {
  id: number;
  title: { rendered: string };
  link: string;
  date: string;
  categories: number[];
  _embedded?: {
    "wp:featuredmedia"?: Array<{
      source_url?: string;
      media_details?: {
        sizes?: {
          large?: { source_url?: string };
        };
      };
    }>;
  };
}

export interface Article {
  id: number;
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

const categoryCache = new Map<string, string>();

async function getCategoryName(
  apiBase: string,
  categoryId: number
): Promise<string> {
  const cacheKey = `${apiBase}:${categoryId}`;
  if (categoryCache.has(cacheKey)) {
    return categoryCache.get(cacheKey)!;
  }
  try {
    const res = await axios.get(`${apiBase}/categories/${categoryId}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      timeout: 10000,
    });
    const name: string = res.data.name;
    categoryCache.set(cacheKey, name);
    return name;
  } catch (err) {
    console.error(
      `[fetcher] カテゴリ取得失敗 (${apiBase}, id=${categoryId}):`,
      (err as Error).message
    );
    return "不明";
  }
}

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
      const res = await axios.get<WPPost[]>(`${site.apiBase}/posts`, {
        params: {
          per_page: 10,
          orderby: "date",
          order: "desc",
          _fields: "id,title,link,date,categories,_links",
          _embed: true,
        },
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "Accept": "application/json",
        },
        timeout: 15000,
      });

      const seenIds = getSeenIds(key);
      const newPosts = res.data.filter((p) => !seenIds.includes(p.id));
      const limited = newPosts.slice(0, maxPosts);

      for (const post of limited) {
        const categoryNames = await Promise.all(
          post.categories.map((cid) => getCategoryName(site.apiBase, cid))
        );
        const faviconUrl = new URL("/favicon.ico", site.url).href;
        const featuredMedia = post._embedded?.["wp:featuredmedia"]?.[0];
        const thumbnailUrl =
          featuredMedia?.media_details?.sizes?.large?.source_url ??
          featuredMedia?.source_url ??
          undefined;
        allArticles.push({
          id: post.id,
          title: post.title.rendered,
          link: post.link,
          date: post.date,
          categoryNames,
          siteKey: key,
          siteName: site.name,
          siteColor: site.color,
          siteIcon: faviconUrl,
          thumbnailUrl,
        });
      }

      console.log(`[fetcher] ${site.name}: ${limited.length}件の新着記事`);
    } catch (err: any) {
      console.error(
        `[fetcher] ${site.name} の取得に失敗:`,
        (err as Error).message
      );
      if (err.response) {
        console.error(`[fetcher] status: ${err.response.status}, server: ${err.response.headers?.server || "unknown"}`);
        const body = typeof err.response.data === "string" ? err.response.data.slice(0, 300) : "";
        if (body) console.error(`[fetcher] body: ${body}`);
      }
    }
  }

  return allArticles;
}
