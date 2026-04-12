import { google, gmail_v1 } from "googleapis";
import { getSeenIds } from "./store";
import { GmailConfig } from "./config";

export interface NewsletterEmail {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
  siteKey: string;
}

const SITE_KEY = "gmail";

function getAuth(gmailConfig: GmailConfig) {
  if (!gmailConfig.clientId || !gmailConfig.clientSecret || !gmailConfig.refreshToken) {
    throw new Error("Gmail OAuth2 の認証情報が不足しています（npm run setup で設定してください）");
  }

  const oAuth2Client = new google.auth.OAuth2(
    gmailConfig.clientId,
    gmailConfig.clientSecret
  );
  oAuth2Client.setCredentials({ refresh_token: gmailConfig.refreshToken });
  return oAuth2Client;
}

function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

async function resolveLabelId(
  gmail: gmail_v1.Gmail,
  labelName: string
): Promise<string | null> {
  try {
    const res = await gmail.users.labels.list({ userId: "me" });
    const label = res.data.labels?.find(
      (l) => l.name?.toLowerCase() === labelName.toLowerCase()
    );
    return label?.id ?? null;
  } catch (err) {
    console.error("[gmail] ラベル一覧の取得に失敗:", (err as Error).message);
    return null;
  }
}

export async function fetchNewEmails(
  gmailConfig: GmailConfig,
  maxEmails: number
): Promise<NewsletterEmail[]> {
  if (!gmailConfig.enabled) return [];

  let auth;
  try {
    auth = getAuth(gmailConfig);
  } catch (err) {
    console.error("[gmail]", (err as Error).message);
    return [];
  }

  const gmail = google.gmail({ version: "v1", auth });
  const labelName = gmailConfig.labelName || "メルマガ";

  console.log(`[gmail] ラベル「${labelName}」のメールを取得中...`);

  const labelId = await resolveLabelId(gmail, labelName);
  if (!labelId) {
    console.error(`[gmail] ラベル「${labelName}」が見つかりません`);
    return [];
  }

  try {
    const listRes = await gmail.users.messages.list({
      userId: "me",
      labelIds: [labelId],
      maxResults: 20,
    });

    const messages = listRes.data.messages ?? [];
    if (messages.length === 0) return [];

    const seenIds = getSeenIds(SITE_KEY);
    const newMessages = messages.filter((m) => m.id && !seenIds.includes(m.id));
    const limited = newMessages.slice(0, maxEmails);

    const emails: NewsletterEmail[] = [];

    for (const msg of limited) {
      if (!msg.id) continue;
      try {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "metadata",
          metadataHeaders: ["Subject", "From", "Date"],
        });

        const headers = detail.data.payload?.headers;
        const subject = getHeader(headers, "Subject") || "(件名なし)";
        const from = getHeader(headers, "From");
        const dateHeader = getHeader(headers, "Date");
        const snippet = detail.data.snippet ?? "";

        const date = dateHeader
          ? new Date(dateHeader).toISOString()
          : new Date(Number(detail.data.internalDate)).toISOString();

        emails.push({ id: msg.id, subject, from, snippet, date, siteKey: SITE_KEY });
      } catch (err) {
        console.error(`[gmail] メール取得失敗 (id=${msg.id}):`, (err as Error).message);
      }
    }

    console.log(`[gmail] ${emails.length}件の新着メルマガ`);
    return emails;
  } catch (err) {
    console.error("[gmail] メール一覧の取得に失敗:", (err as Error).message);
    return [];
  }
}
