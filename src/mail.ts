import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { loadConfig } from "./config";

export interface Newsletter {
  subject: string;
  from: string;
  text: string;
  date: string;
}

export async function fetchNewsletters(): Promise<Newsletter[]> {
  const config = loadConfig();
  const mailConfig = config.mail;

  // 環境変数を優先、なければconfig.jsonから取得
  const user = process.env.GMAIL_USER || mailConfig?.user;
  const appPassword = process.env.GMAIL_APP_PASSWORD || mailConfig?.appPassword;
  const label = process.env.GMAIL_LABEL || mailConfig?.label || "INBOX";
  const from = mailConfig?.from || "";

  if (!user || !appPassword) {
    return [];
  }

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user,
      pass: appPassword,
    },
    logger: false,
  });

  const newsletters: Newsletter[] = [];

  try {
    await client.connect();
    console.log(`[mail] メールボックス「${label}」を確認中...`);
    const lock = await client.getMailboxLock(label);

    try {
      // 未読メールを検索
      const searchQuery: Record<string, unknown> = { seen: false };
      if (from) {
        searchQuery.from = from;
      }

      const messages = client.fetch(searchQuery, {
        source: true,
        uid: true,
      });

      for await (const msg of messages) {
        if (!msg.source) continue;
        const parsed = await simpleParser(msg.source) as import("mailparser").ParsedMail;

        const subject = parsed.subject || "(件名なし)";
        const from = parsed.from?.text || "(不明)";
        const rawText = parsed.text || "";
        const text = rawText.slice(0, 200);
        const date = parsed.date
          ? parsed.date.toISOString()
          : new Date().toISOString();

        newsletters.push({ subject, from, text, date });

        // 既読にする
        await client.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"], { uid: true });
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err) {
    console.error("[mail] IMAP接続エラー:", (err as Error).message);
  }

  console.log(`[mail] ${newsletters.length}件の新着メルマガ`);
  return newsletters;
}
