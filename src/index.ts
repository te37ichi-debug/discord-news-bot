import { loadConfig } from "./config";
import { fetchNewArticles } from "./fetcher";
import { sendToDiscord, sendNewslettersToDiscord, sendNewsletterToDiscord } from "./discord";
import { markAsSeen } from "./store";
import { fetchNewEmails } from "./gmail";
import { fetchNewsletters } from "./mail";

async function main(): Promise<void> {
  const config = loadConfig();
  const { maxPostsPerCheck, sites, gmail } = config;

  // 環境変数を優先、なければconfig.jsonから取得
  const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL || config.discordWebhookUrl;

  if (!discordWebhookUrl) {
    console.error("[bot] DISCORD_WEBHOOK_URL が設定されていません。");
    process.exit(1);
  }

  const enabledSites = sites.filter((s) => s.enabled);

  console.log("[bot] Discord News Bot 起動");
  console.log(`[bot] 最大取得件数: ${maxPostsPerCheck}件/ソース`);
  console.log(`[bot] WordPress サイト: ${enabledSites.map((s) => s.name).join(", ") || "なし"}`);
  console.log(`[bot] Gmail メルマガ: ${gmail.enabled ? "有効" : "無効"}`);
  console.log(`[bot] IMAP メルマガ: ${config.mail?.enabled ? "有効" : "無効"}`);
  console.log(`[bot] チェック開始: ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`);

  // WordPress
  const articles = await fetchNewArticles(sites, maxPostsPerCheck);
  if (articles.length === 0) {
    console.log("[bot] 新着記事なし");
  } else {
    console.log(`[bot] 新着記事 ${articles.length}件を送信中...`);
    await sendToDiscord(discordWebhookUrl, articles);

    const bySite = new Map<string, (number | string)[]>();
    for (const a of articles) {
      const ids = bySite.get(a.siteKey) ?? [];
      ids.push(a.id);
      bySite.set(a.siteKey, ids);
    }
    for (const [key, ids] of bySite) {
      markAsSeen(key, ids);
    }
  }

  // Gmail API
  if (gmail.enabled) {
    const emails = await fetchNewEmails(gmail, maxPostsPerCheck);
    if (emails.length === 0) {
      console.log("[bot] 新着メルマガなし (Gmail API)");
    } else {
      console.log(`[bot] 新着メルマガ ${emails.length}件を送信中 (Gmail API)...`);
      await sendNewslettersToDiscord(discordWebhookUrl, emails);
      markAsSeen("gmail", emails.map((e) => e.id));
    }
  }

  // IMAP メルマガ
  if (config.mail?.enabled) {
    const mailWebhook = config.mail.webhookUrl || discordWebhookUrl;
    const newsletters = await fetchNewsletters();
    if (newsletters.length === 0) {
      console.log("[bot] 新着メルマガなし (IMAP)");
    } else {
      console.log(`[bot] 新着メルマガ ${newsletters.length}件を送信中 (IMAP)...`);
      await sendNewsletterToDiscord(mailWebhook, newsletters);
    }
  }

  console.log("[bot] チェック完了");
}

main().catch((err) => {
  console.error("[bot] エラー:", err);
  process.exit(1);
});
