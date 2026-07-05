# ガジェット価格トラッカー

Amazon.co.jp のガジェット・PCパーツ・スマホ本体・スマートデバイス・スマートウォッチの価格を毎時追跡し、値下げ・セールを一覧できる静的サイト。

## 構成

```
アマゾン_商品検索/
├─ config.py            # ジャンル定義・メーカーホワイトリスト・フィルタ基準
├─ scraper.py           # Playwright による Amazon スクレイピング
├─ update.py            # 毎時実行の本体（価格スイープ＋商品発見＋データ書き出し）
├─ products.json        # 登録商品レジストリ（自動生成・コミット対象）
├─ site/                # 公開する静的サイト（Cloudflare Pages のルートに指定）
│   ├─ index.html / style.css / app.js
│   └─ data/            # 生成データ（products.json / meta.json / history/{asin}.json）
├─ worker/counter.js    # 閲覧数カウンター（Cloudflare Worker・任意）
└─ .github/workflows/update.yml  # 毎時の自動実行
```

## 動作の仕組み

1. **商品登録（1日1回 自動）**: `config.py` のジャンル別検索クエリを巡回し、
   メーカーホワイトリストに載っていて品質基準（レビュー数・星評価）を満たす商品を自動登録する。
   「〇〇対応」「ケース」などの便乗アクセサリは除外パターンで弾く。
2. **価格取得（毎時0分）**: 同じ検索クエリを巡回して登録済み商品の価格を観測し、
   `site/data/history/{asin}.json` に蓄積する。同価格が続く間は約1日1点に間引くのでファイルは肥大化しない。
   加えて毎回15商品ずつ詳細ページを巡回し、売れ筋ランキングを更新する（全商品を数日で一巡）。
3. **値下がり判定**: 「過去30日の観測最高値」を基準価格とし、そこからの下落率を表示する。
   Amazonの水増し参考価格ではなく自前の観測値を基準にする。
4. **サイト**: 完全な静的サイト。GitHub Actions がデータJSONをコミット → Cloudflare Pages が自動デプロイ。

## セットアップ手順（ユーザー作業）

### 1. GitHub リポジトリ

```bash
cd アマゾン_商品検索
git init
git add .
git commit -m "initial"
# GitHubで公開リポジトリを作成してpush（公開リポジトリならActions実行時間は無料・無制限）
```

- リポジトリの **Settings → Secrets and variables → Actions**
  - Secrets に `AFFILIATE_TAG`（Amazonアソシエイトのタグ、例 `xxxx-22`）※未登録の間は空でOK
  - Variables に `COUNTER_URL`（閲覧数カウンターWorkerのURL）※任意
- Actions タブでワークフローを有効化。手動実行は「Run workflow」から（discover にチェックで商品発見も実行）

### 2. Cloudflare Pages

1. Cloudflare ダッシュボード → Workers & Pages → Pages → 「Connect to Git」
2. このリポジトリを選択
3. Build settings: フレームワークなし・ビルドコマンドなし・**出力ディレクトリ `site`**
4. デプロイ後、Actions がデータをコミットするたびに自動で再デプロイされる

### 3. 閲覧数ランキング（任意）

`worker/counter.js` の冒頭コメントの手順で Cloudflare Worker をデプロイし、
URL を GitHub Variables の `COUNTER_URL` に登録すると「閲覧数」タブが自動で有効になる。
未設定の間は「売れ筋」「値下げ率」ランキングのみ表示される。

### 4. ローカルでの実行・確認

```bash
pip install -r requirements.txt
python -m playwright install chromium

python update.py --discover   # 初回: 商品登録＋価格取得
python update.py              # 通常: 価格取得のみ

# サイトのプレビュー
python -m http.server 8888 --directory site
# → http://localhost:8888
```

## 商品の追加・調整

- ジャンル・ブランド・検索クエリ・除外語・品質基準はすべて `config.py` の `GENRES` で調整する
- ブランドは「**商品名に実際に出る名前**」を入れること（会社名ではなく製品ライン名。例: Apple ではなく iPhone）
- 特定商品を手動登録したい場合は `products.json` に直接エントリを追加してもよい（次回実行から追跡される）

## 収益化

- `AFFILIATE_TAG` を設定すると、サイト内の「Amazonで確認」リンクにアソシエイトタグが付く
- サイトフッターに #PR 表記あり（ステマ規制対応）。削除しないこと
- Google AdSense は審査通過後、`site/index.html` にスニペットを貼るだけで導入可能

## 注意（重要）

- Amazonアソシエイト規約は PA-API 以外での商品データ取得を禁止している。
  スクレイピングでの運用は**アカウント停止リスクを理解した上での自己責任**。
  アソシエイト成果3件達成で PA-API が使えるようになったら、取得部分の PA-API 化を推奨。
- スクレイピングは低頻度・低負荷のみ。CAPTCHA検出時は即終了し回避しない設計。
- 通知（プッシュ）はアプリ化 or PWA 化のタイミングで実装予定。現状はお気に入りの値下げハイライトのみ。
