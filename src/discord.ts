import axios from "axios";
import { Article } from "./fetcher";
import { NewsletterEmail } from "./gmail";
import { Newsletter } from "./mail";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
}

function parseColor(hex: string): number {
  const cleaned = hex.replace(/^#/, "");
  return parseInt(cleaned, 16) || 0x808080;
}

export async function sendToDiscord(
  webhookUrl: string,
  articles: Article[]
): Promise<void> {
  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const embed: Record<string, unknown> = {
      title: article.title,
      url: article.link,
      description: `📰 ${article.siteName}`,
      color: parseColor(article.siteColor),
      footer: {
        text: `${article.siteName} | ${formatDate(article.date)}`,
      },
      fields:
        article.categoryNames.length > 0
          ? [
              {
                name: "カテゴリ",
                value: article.categoryNames.join(", "),
                inline: true,
              },
            ]
          : [],
    };
    if (article.thumbnailUrl) {
      embed.image = { url: article.thumbnailUrl };
    }

    try {
      await axios.post(webhookUrl, { embeds: [embed] }, { timeout: 10000 });
      console.log(`[discord] 送信完了: ${article.title}`);
    } catch (err) {
      console.error(
        `[discord] 送信失敗: ${article.title}`,
        (err as Error).message
      );
    }

    if (i < articles.length - 1) {
      await sleep(1000);
    }
  }
}

export async function sendNewslettersToDiscord(
  webhookUrl: string,
  emails: NewsletterEmail[]
): Promise<void> {
  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    const fromName = email.from.replace(/<.*>/, "").trim() || email.from;

    const embed = {
      title: email.subject,
      description:
        email.snippet.length > 300
          ? email.snippet.slice(0, 300) + "..."
          : email.snippet,
      color: 0xd44638,
      author: {
        name: fromName,
      },
      footer: {
        text: `Gmail メルマガ | ${formatDate(email.date)}`,
      },
    };

    try {
      await axios.post(webhookUrl, { embeds: [embed] }, { timeout: 10000 });
      console.log(`[discord] 送信完了: ${email.subject}`);
    } catch (err) {
      console.error(
        `[discord] 送信失敗: ${email.subject}`,
        (err as Error).message
      );
    }

    if (i < emails.length - 1) {
      await sleep(1000);
    }
  }
}

export async function sendNewsletterToDiscord(
  webhookUrl: string,
  newsletters: Newsletter[]
): Promise<void> {
  for (let i = 0; i < newsletters.length; i++) {
    const nl = newsletters[i];
    const description = nl.text.length > 200
      ? nl.text.slice(0, 200) + "..."
      : nl.text + "...";

    const embed = {
      title: nl.subject,
      description,
      color: 0x00c851,
      footer: {
        text: `${nl.from} | ${formatDate(nl.date)}`,
      },
    };

    try {
      await axios.post(webhookUrl, { embeds: [embed] }, { timeout: 10000 });
      console.log(`[discord] 送信完了: ${nl.subject}`);
    } catch (err) {
      console.error(
        `[discord] 送信失敗: ${nl.subject}`,
        (err as Error).message
      );
    }

    if (i < newsletters.length - 1) {
      await sleep(1000);
    }
  }
}
