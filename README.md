# Discord News Bot

WordPress サイトの最新記事と Gmail メルマガを Discord チャンネルに自動投稿する Bot です。

## 対象ソース

- WordPress サイト（Web UIから自由に追加・削除可能）
- Gmail メルマガ（任意）

## クイックスタート

```bash
cd discord-news-bot
npm install

# ブラウザで設定画面を開く
npm run setup
# → http://localhost:3456 にアクセス

# Bot起動
npm run start
```

## 設定画面 (`npm run setup`)

ブラウザベースの設定画面で全ての設定を管理できます。

```bash
npm run setup
# → http://localhost:3456 で設定画面が開きます
```

### Discord タブ

Webhook URL を貼り付けるだけで完了です。

**Webhook URL の取得方法:**
1. Discord サーバーの「サーバー設定」→「連携サービス」→「ウェブフック」
2. 「新しいウェブフック」を作成
3. 投稿先チャンネルを選択し「ウェブフック URL をコピー」

### WordPress サイト タブ

サイトの追加・削除・編集・有効/無効切り替えをカード形式のUIで操作できます。

- **追加**: 「+ サイト追加」ボタンからサイト名とURLを入力（API URLは自動生成）
- **編集**: 各カードの「編集」ボタンで名前・URL・Embed色を変更
- **切り替え**: 「有効にする / 無効にする」で一時的にON/OFF
- **削除**: 「削除」ボタンで確認後に削除
- **Embed色**: カラーピッカーで直感的に選択

### Gmail メルマガ タブ

トグルスイッチで有効/無効を切り替え。OAuth認証情報とラベル名を入力します。

**Gmail API の準備:**
1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクト作成
2. Gmail API を有効化
3. 「認証情報」→「OAuth クライアント ID」を作成（デスクトップアプリ）
4. [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground) で Refresh Token を取得
   - スコープ: `https://www.googleapis.com/auth/gmail.readonly`
5. 設定画面の「Gmail メルマガ」タブで Client ID / Secret / Refresh Token を入力

### 全般 タブ

- チェック間隔（分）
- 最大取得件数（件/ソース）

## 実行

### 開発モード

```bash
npm run start
```

### 本番モード

```bash
npm run build
npm run start:prod
```

## 動作仕様

- 起動時に即座に1回チェックを実行
- 以降設定した間隔で定期チェック
- 有効な WordPress サイトから最新記事を取得し、未送信分を投稿
- Gmail 有効時は指定ラベルのメールも取得して投稿
- 送信済み ID は `data/seen.json` で管理（最大500件/ソース）
- 設定は `data/config.json` に保存（Web UIで編集）
- 複数記事はレート制限対策として1秒間隔で送信

## ファイル構成

```
discord-news-bot/
├── src/
│   ├── index.ts          # エントリーポイント・cronジョブ
│   ├── server.ts         # 設定画面Webサーバー
│   ├── setup.html        # 設定画面UI
│   ├── config.ts         # 設定の読み書き
│   ├── fetcher.ts        # WordPress REST APIから記事取得
│   ├── gmail.ts          # Gmail APIからメルマガ取得
│   ├── discord.ts        # Discord Webhook送信
│   └── store.ts          # 既読IDの管理
├── data/
│   ├── config.json       # Bot設定（Web UIで自動生成）
│   └── seen.json         # 送信済みID
├── package.json
├── tsconfig.json
└── README.md
```

## npm scripts

| コマンド | 説明 |
|---|---|
| `npm run setup` | 設定画面を起動 (http://localhost:3456) |
| `npm run start` | Bot起動（開発モード） |
| `npm run build` | TypeScriptビルド |
| `npm run start:prod` | Bot起動（本番モード） |
| `npm run setup:prod` | 設定画面を起動（本番モード） |
