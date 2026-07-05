"""Amazon価格トラッカーの設定。

ジャンル定義・メーカーホワイトリスト・フィルタ基準・実行パラメータをここに集約する。
"""

import os

# ---------- アフィリエイト ----------
# Amazonアソシエイトのトラッキングタグ（例: "xxxx-22"）。
# 未設定の間は通常リンクで動作する。GitHub ActionsではSecretsのAFFILIATE_TAGを使う。
AFFILIATE_TAG = os.environ.get("AFFILIATE_TAG", "")

# ---------- ジャンル定義 ----------
# brands   : ホワイトリスト。「商品名に実際に出る名前」を入れること（会社名ではなく製品ライン名）。
#            商品名にこのいずれかが含まれない商品は登録しない。
# queries  : 商品発見・毎時価格スイープに使う検索クエリ。
# exclude  : 商品名にこれらが含まれたら除外（便乗アクセサリ・粗悪品対策）。
# min_reviews / min_rating : 登録時の品質基準（粗悪品・無名品の足切り）。
# cap      : ジャンルごとの最大登録数。
GENRES = {
    "gadget": {
        "label_ja": "ガジェット",
        "label_en": "Gadgets",
        "brands": [
            "Anker", "UGREEN", "Belkin", "ロジクール", "Logicool", "Logitech",
            "ソニー", "SONY", "Bose", "JBL", "SanDisk", "サンディスク",
            "エレコム", "ELECOM", "バッファロー", "BUFFALO", "Shokz",
            "Sennheiser", "ゼンハイザー", "オーディオテクニカ", "audio-technica",
            "Keychron", "HHKB", "DJI", "GoPro", "Insta360", "Kindle", "Fire",
        ],
        "queries": [
            "Anker 充電器", "Anker モバイルバッテリー", "UGREEN 充電器",
            "ソニー ワイヤレスイヤホン", "Bose イヤホン", "JBL スピーカー",
            "ロジクール マウス", "ロジクール キーボード", "SanDisk SSD",
            "バッファロー 外付けSSD", "オーディオテクニカ ヘッドホン",
            "Shokz 骨伝導", "GoPro アクションカメラ",
        ],
        "exclude": ["対応", "互換", "ケース", "カバー", "フィルム", "保護", "替え", "スキン"],
        "min_reviews": 50,
        "min_rating": 3.9,
        "cap": 60,
    },
    "pcparts": {
        "label_ja": "PCパーツ",
        "label_en": "PC Parts",
        "brands": [
            "ASUS", "MSI", "GIGABYTE", "ASRock", "NZXT", "Corsair", "コルセア",
            "Crucial", "クルーシャル", "Western Digital", "WD", "Samsung", "サムスン",
            "Kingston", "キングストン", "AMD", "Ryzen", "Intel", "インテル", "Core",
            "Cooler Master", "DeepCool", "Thermaltake", "Seasonic", "玄人志向",
            "GeForce", "Radeon", "Noctua", "be quiet",
        ],
        "queries": [
            "RTX 5070 グラボ", "RTX 5060 グラボ", "Radeon グラボ",
            "Ryzen CPU", "Intel Core CPU", "Crucial メモリ DDR5",
            "Corsair メモリ", "Samsung SSD NVMe", "WD SSD NVMe",
            "ASUS マザーボード", "MSI マザーボード", "玄人志向 電源",
            "Corsair 電源", "DeepCool CPUクーラー", "NZXT PCケース",
        ],
        "exclude": ["対応", "互換", "ケーブルのみ", "ブラケット", "ステー", "延長"],
        "min_reviews": 20,
        "min_rating": 3.8,
        "cap": 80,
    },
    "smartphone": {
        "label_ja": "スマホ本体",
        "label_en": "Smartphones",
        "brands": [
            "iPhone", "Galaxy", "Pixel", "Xperia", "AQUOS", "Xiaomi", "Redmi",
            "POCO", "OPPO", "motorola", "moto", "Zenfone", "Nothing Phone", "arrows",
        ],
        "queries": [
            "iPhone 本体 SIMフリー", "Galaxy 本体 SIMフリー", "Google Pixel 本体",
            "Xperia 本体 SIMフリー", "AQUOS sense 本体", "Xiaomi スマートフォン 本体",
            "OPPO スマートフォン 本体", "motorola スマートフォン 本体",
        ],
        # スマホはアクセサリの便乗が特に多いので除外を厚めに
        "exclude": [
            "ケース", "カバー", "フィルム", "保護", "ガラス", "対応", "用",
            "充電器", "ケーブル", "スタンド", "ホルダー", "リング", "バンパー",
            "レンズ", "ストラップ", "壁紙", "修理", "バッテリー交換",
        ],
        "min_reviews": 10,
        "min_rating": 3.7,
        "cap": 50,
    },
    "smartdevice": {
        "label_ja": "スマートデバイス",
        "label_en": "Smart Home",
        "brands": [
            "Echo", "Alexa", "Google Nest", "Nest", "SwitchBot", "スイッチボット",
            "Philips Hue", "Tapo", "TP-Link", "Aqara", "Meross", "Nature Remo",
            "eufy", "Ring", "Chromecast", "Fire TV",
        ],
        "queries": [
            "Echo スマートスピーカー", "Google Nest", "SwitchBot",
            "Philips Hue", "Tapo スマートカメラ", "Aqara", "Nature Remo",
            "eufy ロボット掃除機", "Fire TV Stick",
        ],
        "exclude": ["対応", "互換", "ケース", "カバー", "フィルム", "保護", "取付", "マウント"],
        "min_reviews": 50,
        "min_rating": 3.8,
        "cap": 50,
    },
    "smartwatch": {
        "label_ja": "スマートウォッチ",
        "label_en": "Smartwatches",
        "brands": [
            "Apple Watch", "Garmin", "ガーミン", "Fitbit", "HUAWEI", "ファーウェイ",
            "Galaxy Watch", "Pixel Watch", "Amazfit", "Xiaomi", "Suunto", "POLAR",
            "wena", "GRIT",
        ],
        "queries": [
            "Apple Watch 本体", "Garmin スマートウォッチ", "Fitbit 本体",
            "HUAWEI スマートウォッチ", "Galaxy Watch", "Pixel Watch",
            "Amazfit スマートウォッチ", "Xiaomi Smart Band",
        ],
        # バンド・充電器などの便乗アクセサリ除外
        "exclude": [
            "バンド", "ベルト", "対応", "用", "充電器", "ケーブル", "フィルム",
            "保護", "ケース", "カバー", "スタンド", "交換",
        ],
        "min_reviews": 10,
        "min_rating": 3.7,
        "cap": 50,
    },
}

# ---------- スクレイピング ----------
PAGES_PER_QUERY = 1        # 検索1クエリあたり読むページ数（負荷を抑える）
SLEEP_BETWEEN = (3.0, 6.0)  # ページ間の待機秒（乱数範囲）
DETAILS_PER_RUN = 15        # 毎時の詳細ページ巡回数（売れ筋ランキング更新。全商品を数日で一巡）

# ---------- 価格履歴 ----------
HISTORY_DIR = "site/data/history"   # 商品ごとの価格履歴 {asin}.json
PRODUCTS_FILE = "products.json"     # 登録商品レジストリ（収集側の台帳）
SITE_DATA = "site/data"             # サイトに出す生成データの置き場
BASELINE_DAYS = 30                  # 値下がり率の基準: 過去N日の観測最高値
STALE_HOURS = 48                    # この時間観測できない商品はサイト上で「更新停止」表示

# 値下がりバッジを付ける最小割引率（%）
DROP_BADGE_MIN = 3.0

# ---------- 閲覧数カウンター（任意） ----------
# Cloudflare Workerをデプロイした場合にURLを入れる（例: "https://counter.xxx.workers.dev"）。
# 空なら閲覧数ランキングは非表示になり、売れ筋・値下げ率ランキングのみ動く。
COUNTER_URL = os.environ.get("COUNTER_URL", "")
