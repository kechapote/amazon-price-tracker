"""価格トラッカー本体。

毎時実行:  python update.py            … 登録済み商品の価格スイープ＋詳細ローテーション
商品発見:  python update.py --discover … スイープに加え、基準を満たす新商品を自動登録

処理の流れ:
1. ジャンルごとの検索クエリを巡回し、登録済みASINの価格を観測する
2. (--discover時) ホワイトリストのブランドで基準を満たす未登録商品を登録する
3. 詳細ページを少数ローテーション巡回し、売れ筋ランキングを更新する
4. 価格履歴(site/data/history/{asin}.json)とサイト用データ(site/data/products.json)を書き出す
"""

import argparse
import datetime
import json
import os
import sys

import config
import scraper

BASE = os.path.dirname(os.path.abspath(__file__))


def now_iso():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_json(path, default):
    full = os.path.join(BASE, path)
    if os.path.exists(full):
        with open(full, encoding="utf-8") as f:
            return json.load(f)
    return default


def save_json(path, data):
    full = os.path.join(BASE, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))


# ---------- 判定 ----------

def matches_brand(title, genre_cfg):
    t = title.lower()
    for b in genre_cfg["brands"]:
        if b.lower() in t:
            return b
    return None


def is_excluded(title, genre_cfg):
    return any(x in title for x in genre_cfg["exclude"])


def passes_quality(item, genre_cfg):
    if (item.get("reviews") or 0) < genre_cfg["min_reviews"]:
        return False
    if (item.get("rating") or 0) < genre_cfg["min_rating"]:
        return False
    return True


# ---------- 価格履歴 ----------

def observe(asin, price, ts):
    """価格を履歴に追記する。同価格が続く間は約1日1点に間引く。"""
    path = f"{config.HISTORY_DIR}/{asin}.json"
    hist = load_json(path, [])
    if hist:
        last_ts, last_price = hist[-1]
        if last_price == price:
            last_dt = datetime.datetime.fromisoformat(last_ts.replace("Z", "+00:00"))
            now_dt = datetime.datetime.fromisoformat(ts.replace("Z", "+00:00"))
            if (now_dt - last_dt).total_seconds() < 20 * 3600:
                return  # 変化なし・前回記録から20時間未満 → 記録しない
    hist.append([ts, price])
    save_json(path, hist)


def baseline_price(asin, ts):
    """過去BASELINE_DAYS日の観測最高値（値下がり率の基準）。"""
    hist = load_json(f"{config.HISTORY_DIR}/{asin}.json", [])
    if not hist:
        return None
    now_dt = datetime.datetime.fromisoformat(ts.replace("Z", "+00:00"))
    cutoff = now_dt - datetime.timedelta(days=config.BASELINE_DAYS)
    prices = [
        p for t, p in hist
        if datetime.datetime.fromisoformat(t.replace("Z", "+00:00")) >= cutoff
    ]
    return max(prices) if prices else None


def lowest_price(asin):
    hist = load_json(f"{config.HISTORY_DIR}/{asin}.json", [])
    return min((p for _, p in hist), default=None)


# ---------- メイン ----------

def run(discover=False):
    ts = now_iso()
    registry = load_json(config.PRODUCTS_FILE, {})
    seen = 0
    registered = 0

    blocked = False
    try:
        for genre, gcfg in config.GENRES.items():
            if blocked:
                break
            genre_count = sum(1 for p in registry.values() if p["genre"] == genre)
            for query in gcfg["queries"]:
                try:
                    items = scraper.search(query)
                except scraper.BlockedError as e:
                    # ブロックされたら打ち切り（回避しない）。観測済み分は保存する
                    print(f"[block] {query}: {e}", file=sys.stderr)
                    blocked = True
                    break
                for item in items:
                    asin = item["asin"]
                    if asin in registry:
                        p = registry[asin]
                        p["price"] = item["price"]
                        p["list_price"] = item["list_price"]
                        if item.get("rating"):
                            p["rating"] = item["rating"]
                        if item.get("reviews"):
                            p["reviews"] = item["reviews"]
                        if item.get("image") and not p.get("image"):
                            p["image"] = item["image"]
                        p["updated"] = ts
                        observe(asin, item["price"], ts)
                        seen += 1
                    elif discover and genre_count < gcfg["cap"]:
                        brand = matches_brand(item["title"], gcfg)
                        if (
                            brand
                            and not is_excluded(item["title"], gcfg)
                            and passes_quality(item, gcfg)
                        ):
                            registry[asin] = {
                                "title": item["title"],
                                "genre": genre,
                                "brand": brand,
                                "image": item.get("image"),
                                "price": item["price"],
                                "list_price": item["list_price"],
                                "rating": item.get("rating"),
                                "reviews": item.get("reviews"),
                                "sales_rank": None,
                                "added": ts,
                                "updated": ts,
                                "detail_updated": None,
                            }
                            observe(asin, item["price"], ts)
                            genre_count += 1
                            registered += 1
                scraper.sleep_polite()

        # 詳細ページローテーション（売れ筋ランキング更新）
        targets = [] if blocked else sorted(
            registry.keys(),
            key=lambda a: registry[a].get("detail_updated") or "",
        )[: config.DETAILS_PER_RUN]
        for asin in targets:
            try:
                d = scraper.fetch_details(asin)
            except scraper.BlockedError as e:
                print(f"[block] details {asin}: {e}", file=sys.stderr)
                break
            except Exception as e:
                print(f"[warn] details {asin}: {e}", file=sys.stderr)
                registry[asin]["detail_updated"] = ts  # 失敗も一巡に数え、詰まらせない
                continue
            p = registry[asin]
            if d["sales_rank"]:
                p["sales_rank"] = d["sales_rank"]
            if d["image"]:
                p["image"] = d["image"]
            if d["price"]:
                p["price"] = d["price"]
                p["updated"] = ts
                observe(asin, d["price"], ts)
            p["detail_updated"] = ts
    finally:
        scraper.close()

    save_json(config.PRODUCTS_FILE, registry)
    export_site_data(registry, ts)
    print(f"done: observed={seen} registered={registered} total={len(registry)}")


def export_site_data(registry, ts):
    """サイトが読むJSONを書き出す。"""
    products = []
    drops = 0
    for asin, p in registry.items():
        base = baseline_price(asin, ts)
        price = p.get("price")
        drop_pct = 0.0
        if base and price and base > price:
            drop_pct = round((base - price) / base * 100, 1)
        if drop_pct >= config.DROP_BADGE_MIN:
            drops += 1
        products.append({
            "asin": asin,
            "title": p["title"],
            "genre": p["genre"],
            "brand": p["brand"],
            "image": p.get("image"),
            "price": price,
            "baseline": base,
            "drop_pct": drop_pct,
            "low": lowest_price(asin),
            "rating": p.get("rating"),
            "reviews": p.get("reviews"),
            "sales_rank": p.get("sales_rank"),
            "updated": p.get("updated"),
        })
    save_json(f"{config.SITE_DATA}/products.json", products)
    save_json(f"{config.SITE_DATA}/meta.json", {
        "updated": ts,
        "total": len(products),
        "drops": drops,
        "affiliate_tag": config.AFFILIATE_TAG,
        "counter_url": config.COUNTER_URL,
        "genres": {
            g: {"ja": c["label_ja"], "en": c["label_en"]}
            for g, c in config.GENRES.items()
        },
    })


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--discover", action="store_true", help="新商品の自動登録も行う")
    args = ap.parse_args()
    run(discover=args.discover)
