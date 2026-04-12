import fs from "fs";
import path from "path";

const CONFIG_PATH = path.join(__dirname, "..", "data", "config.json");

export interface SiteEntry {
  name: string;
  url: string;
  apiBase: string;
  color: string; // hex e.g. "#1DA1F2"
  enabled: boolean;
}

export interface GmailConfig {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  labelName: string;
}

export interface MailConfig {
  enabled: boolean;
  user: string;
  appPassword: string;
  from: string;
  label: string;
  webhookUrl: string;
}

export interface BotConfig {
  discordWebhookUrl: string;
  checkIntervalMinutes: number;
  maxPostsPerCheck: number;
  sites: SiteEntry[];
  gmail: GmailConfig;
  mail: MailConfig;
}

const DEFAULT_CONFIG: BotConfig = {
  discordWebhookUrl: "",
  checkIntervalMinutes: 30,
  maxPostsPerCheck: 5,
  sites: [
    {
      name: "Up to date",
      url: "https://uptodate.tokyo/",
      apiBase: "https://uptodate.tokyo/wp-json/wp/v2",
      color: "#1DA1F2",
      enabled: true,
    },
    {
      name: "fullress",
      url: "https://www.fullress.com/",
      apiBase: "https://www.fullress.com/wp-json/wp/v2",
      color: "#FF6B35",
      enabled: true,
    },
  ],
  gmail: {
    enabled: false,
    clientId: "",
    clientSecret: "",
    refreshToken: "",
    labelName: "メルマガ",
  },
  mail: {
    enabled: false,
    user: "",
    appPassword: "",
    from: "",
    label: "メルマガ",
    webhookUrl: "",
  },
};

export function loadConfig(): BotConfig {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const saved = JSON.parse(raw);
    // DEFAULT_CONFIGとマージして新しいフィールドが欠けないようにする
    return { ...DEFAULT_CONFIG, ...saved, gmail: { ...DEFAULT_CONFIG.gmail, ...saved.gmail }, mail: { ...DEFAULT_CONFIG.mail, ...saved.mail } };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: BotConfig): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

/** サイトURLからsiteKey（ドメイン部分）を導出 */
export function siteKey(site: SiteEntry): string {
  try {
    return new URL(site.url).hostname.replace(/^www\./, "");
  } catch {
    return site.name;
  }
}
