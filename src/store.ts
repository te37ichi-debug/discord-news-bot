import fs from "fs";
import path from "path";

const SEEN_PATH = path.join(__dirname, "..", "data", "seen.json");
const MAX_IDS = 500;

type SeenId = number | string;
type SeenData = Record<string, SeenId[]>;

function load(): SeenData {
  try {
    const raw = fs.readFileSync(SEEN_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function save(data: SeenData): void {
  fs.writeFileSync(SEEN_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export function getSeenIds(siteKey: string): SeenId[] {
  const data = load();
  return data[siteKey] ?? [];
}

export function markAsSeen(siteKey: string, ids: SeenId[]): void {
  const data = load();
  const existing = data[siteKey] ?? [];
  const merged = [...existing, ...ids];
  // 最大500件に制限（古いものから削除）
  data[siteKey] = merged.slice(-MAX_IDS);
  save(data);
}
