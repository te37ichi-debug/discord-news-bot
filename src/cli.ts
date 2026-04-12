import readline from "readline";
import { loadConfig, saveConfig, BotConfig, SiteEntry, siteKey } from "./config";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));
}

function printHeader(title: string): void {
  console.log("");
  console.log("=".repeat(50));
  console.log(`  ${title}`);
  console.log("=".repeat(50));
}

function printSites(sites: SiteEntry[]): void {
  if (sites.length === 0) {
    console.log("  (サイト未登録)");
    return;
  }
  sites.forEach((s, i) => {
    const status = s.enabled ? "ON" : "OFF";
    console.log(`  [${i + 1}] ${s.name} (${s.url}) [${status}] 色:${s.color}`);
  });
}

// ─── メインメニュー ───

async function mainMenu(config: BotConfig): Promise<void> {
  while (true) {
    printHeader("Discord News Bot 設定");
    console.log("");
    console.log("  1) Discord Webhook 設定");
    console.log("  2) WordPress サイト管理");
    console.log("  3) Gmail メルマガ設定");
    console.log("  4) 全般設定（チェック間隔・取得件数）");
    console.log("  5) 現在の設定を表示");
    console.log("  0) 保存して終了");
    console.log("");

    const choice = await ask("選択 > ");

    switch (choice) {
      case "1":
        await webhookMenu(config);
        break;
      case "2":
        await sitesMenu(config);
        break;
      case "3":
        await gmailMenu(config);
        break;
      case "4":
        await generalMenu(config);
        break;
      case "5":
        showConfig(config);
        break;
      case "0":
        saveConfig(config);
        console.log("\n設定を保存しました。");
        rl.close();
        return;
      default:
        console.log("無効な選択です。");
    }
  }
}

// ─── Discord Webhook ───

async function webhookMenu(config: BotConfig): Promise<void> {
  printHeader("Discord Webhook 設定");
  const current = config.discordWebhookUrl || "(未設定)";
  console.log(`  現在: ${current}`);
  console.log("");

  const url = await ask("Webhook URL (空欄でスキップ) > ");
  if (url) {
    config.discordWebhookUrl = url;
    console.log("Webhook URL を更新しました。");
  }
}

// ─── WordPress サイト管理 ───

async function sitesMenu(config: BotConfig): Promise<void> {
  while (true) {
    printHeader("WordPress サイト管理");
    printSites(config.sites);
    console.log("");
    console.log("  a) サイトを追加");
    console.log("  d) サイトを削除");
    console.log("  t) 有効/無効を切り替え");
    console.log("  e) サイトを編集");
    console.log("  b) 戻る");
    console.log("");

    const choice = await ask("選択 > ");

    switch (choice) {
      case "a":
        await addSite(config);
        break;
      case "d":
        await removeSite(config);
        break;
      case "t":
        await toggleSite(config);
        break;
      case "e":
        await editSite(config);
        break;
      case "b":
        return;
      default:
        console.log("無効な選択です。");
    }
  }
}

async function addSite(config: BotConfig): Promise<void> {
  console.log("\n--- サイト追加 ---");
  const name = await ask("サイト名 > ");
  if (!name) return;

  let url = await ask("サイトURL (例: https://example.com/) > ");
  if (!url) return;
  if (!url.endsWith("/")) url += "/";

  let apiBase = await ask(`WP REST API ベースURL (空欄で自動: ${url}wp-json/wp/v2) > `);
  if (!apiBase) {
    apiBase = `${url}wp-json/wp/v2`;
  }

  const colorInput = await ask("Embed色 (例: #1DA1F2, 空欄でデフォルト) > ");
  const color = colorInput || "#808080";

  const entry: SiteEntry = { name, url, apiBase, color, enabled: true };
  config.sites.push(entry);
  console.log(`「${name}」を追加しました。`);
}

async function removeSite(config: BotConfig): Promise<void> {
  if (config.sites.length === 0) {
    console.log("削除するサイトがありません。");
    return;
  }
  printSites(config.sites);
  const num = await ask("削除する番号 (0でキャンセル) > ");
  const idx = parseInt(num, 10) - 1;
  if (idx >= 0 && idx < config.sites.length) {
    const removed = config.sites.splice(idx, 1)[0];
    console.log(`「${removed.name}」を削除しました。`);
  }
}

async function toggleSite(config: BotConfig): Promise<void> {
  if (config.sites.length === 0) return;
  printSites(config.sites);
  const num = await ask("切り替える番号 > ");
  const idx = parseInt(num, 10) - 1;
  if (idx >= 0 && idx < config.sites.length) {
    config.sites[idx].enabled = !config.sites[idx].enabled;
    const status = config.sites[idx].enabled ? "有効" : "無効";
    console.log(`「${config.sites[idx].name}」を${status}にしました。`);
  }
}

async function editSite(config: BotConfig): Promise<void> {
  if (config.sites.length === 0) return;
  printSites(config.sites);
  const num = await ask("編集する番号 > ");
  const idx = parseInt(num, 10) - 1;
  if (idx < 0 || idx >= config.sites.length) return;

  const site = config.sites[idx];
  console.log(`\n--- 「${site.name}」の編集 (空欄で変更なし) ---`);

  const name = await ask(`サイト名 [${site.name}] > `);
  if (name) site.name = name;

  const url = await ask(`URL [${site.url}] > `);
  if (url) site.url = url;

  const apiBase = await ask(`API ベースURL [${site.apiBase}] > `);
  if (apiBase) site.apiBase = apiBase;

  const color = await ask(`Embed色 [${site.color}] > `);
  if (color) site.color = color;

  console.log("更新しました。");
}

// ─── Gmail メルマガ設定 ───

async function gmailMenu(config: BotConfig): Promise<void> {
  printHeader("Gmail メルマガ設定");
  const g = config.gmail;
  const status = g.enabled ? "有効" : "無効";
  console.log(`  状態: ${status}`);
  console.log(`  Client ID: ${g.clientId ? g.clientId.slice(0, 20) + "..." : "(未設定)"}`);
  console.log(`  Client Secret: ${g.clientSecret ? "****" : "(未設定)"}`);
  console.log(`  Refresh Token: ${g.refreshToken ? "****" : "(未設定)"}`);
  console.log(`  ラベル名: ${g.labelName}`);
  console.log("");
  console.log("  1) 有効/無効を切り替え");
  console.log("  2) OAuth認証情報を設定");
  console.log("  3) ラベル名を変更");
  console.log("  b) 戻る");
  console.log("");

  const choice = await ask("選択 > ");

  switch (choice) {
    case "1":
      config.gmail.enabled = !config.gmail.enabled;
      console.log(`Gmail メルマガを${config.gmail.enabled ? "有効" : "無効"}にしました。`);
      break;
    case "2":
      await gmailAuth(config);
      break;
    case "3": {
      const label = await ask(`ラベル名 [${g.labelName}] > `);
      if (label) config.gmail.labelName = label;
      break;
    }
    case "b":
      return;
  }
}

async function gmailAuth(config: BotConfig): Promise<void> {
  console.log("\n--- Gmail OAuth2 認証情報 ---");
  console.log("Google Cloud Console で取得した情報を入力してください。");
  console.log("(空欄で現在の値を維持)");
  console.log("");

  const clientId = await ask("Client ID > ");
  if (clientId) config.gmail.clientId = clientId;

  const clientSecret = await ask("Client Secret > ");
  if (clientSecret) config.gmail.clientSecret = clientSecret;

  const refreshToken = await ask("Refresh Token > ");
  if (refreshToken) config.gmail.refreshToken = refreshToken;

  if (config.gmail.clientId && config.gmail.clientSecret && config.gmail.refreshToken) {
    config.gmail.enabled = true;
    console.log("認証情報を設定し、Gmail機能を有効にしました。");
  } else {
    console.log("認証情報を更新しました（一部未設定のため無効のままです）。");
  }
}

// ─── 全般設定 ───

async function generalMenu(config: BotConfig): Promise<void> {
  printHeader("全般設定");
  console.log(`  チェック間隔: ${config.checkIntervalMinutes}分`);
  console.log(`  最大取得件数: ${config.maxPostsPerCheck}件/ソース`);
  console.log("");

  const interval = await ask(`チェック間隔（分） [${config.checkIntervalMinutes}] > `);
  if (interval) {
    const n = parseInt(interval, 10);
    if (n > 0) config.checkIntervalMinutes = n;
  }

  const maxPosts = await ask(`最大取得件数 [${config.maxPostsPerCheck}] > `);
  if (maxPosts) {
    const n = parseInt(maxPosts, 10);
    if (n > 0) config.maxPostsPerCheck = n;
  }
}

// ─── 設定表示 ───

function showConfig(config: BotConfig): void {
  printHeader("現在の設定");
  console.log(`  Webhook: ${config.discordWebhookUrl || "(未設定)"}`);
  console.log(`  間隔: ${config.checkIntervalMinutes}分 / 最大: ${config.maxPostsPerCheck}件`);
  console.log("");
  console.log("  [WordPress サイト]");
  printSites(config.sites);
  console.log("");
  console.log("  [Gmail メルマガ]");
  const g = config.gmail;
  console.log(`    状態: ${g.enabled ? "有効" : "無効"}`);
  console.log(`    ラベル: ${g.labelName}`);
  console.log(`    認証: ${g.clientId ? "設定済み" : "未設定"}`);
}

// ─── エントリーポイント ───

async function run(): Promise<void> {
  const config = loadConfig();
  console.log("Discord News Bot 設定ツール");
  await mainMenu(config);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
