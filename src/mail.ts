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

  if (!mailConfig?.enabled || !mailConfig.user || !mailConfig.appPassword) {
    return [];
  }

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: mailConfig.user,
      pass: mailConfig.appPassword,
    },
    logger: false,
  });

  const newsletters: Newsletter[] = [];
  // Gmailラベルはフォルダとしてアクセス
  const mailbox = mailConfig.label || "INBOX";

  try {
    await client.connect();
    console.log(`[mail] メールボックス「${mailbox}」を確認中...`);
    const lock = await client.getMailboxLock(mailbox);

    try {
      // 未読メールを検索
      const searchQuery: Record<string, unknown> = { seen: false };
      if (mailConfig.from) {
        searchQuery.from = mailConfig.from;
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
