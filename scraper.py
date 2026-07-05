"""Amazon.co.jpの未ログインスクレイピング（Playwright/Chromium使用）。

AmazonはJavaScript必須の確認ページ（Akamai interstitial）を返すため、
requests等ではHTMLを取得できない。実ブラウザでページを表示して読み取る。

注意:
- Amazonアソシエイト規約はPA-API以外での商品データ取得を禁止している。
  本モジュールの利用はアカウント停止リスクを理解した上での自己責任。
- 低頻度・低負荷アクセスのみ。CAPTCHA/ブロックを検出したら即終了し、
  回避策は取らない（次回実行に委ねる）。
"""

import re
import time
import random
import urllib.parse

from bs4 import BeautifulSoup

import config

SEARCH_URL = "https://www.amazon.co.jp/s"

_BLOCK_MARKERS = (
    "api-services-support@amazon.com",
    "Robot Check",
    "ロボットではない",
    "validateCaptcha",
)


class BlockedError(Exception):
    """bot検出でブロックされた（今回はあきらめて次回に委ねる）"""


# ---------- ブラウザ（1回の実行で1セッションを使い回す） ----------

_pw = None
_browser = None
_page = None


def _get_page():
    global _pw, _browser, _page
    if _page is None:
        from playwright.sync_api import sync_playwright
        _pw = sync_playwright().start()
        _browser = _pw.chromium.launch(headless=True)
        _page = _browser.new_page(
            locale="ja-JP", viewport={"width": 1280, "height": 900}
        )
    return _page


def close():
    global _pw, _browser, _page
    if _browser is not None:
        _browser.close()
    if _pw is not None:
        _pw.stop()
    _pw = _browser = _page = None


def sleep_polite():
    time.sleep(random.uniform(*config.SLEEP_BETWEEN))


def _goto(url, ready_selector, scroll=False):
    page = _get_page()
    page.goto(url, wait_until="domcontentloaded", timeout=60_000)
    try:
        page.wait_for_selector(ready_selector, timeout=30_000)
    except Exception:
        html = page.content()
        if any(m in html for m in _BLOCK_MARKERS):
            raise BlockedError("CAPTCHA page detected")
        raise BlockedError(f"page did not load: {url}")
    if scroll:
        # 詳細ページ下部（売れ筋ランキング等）は遅延読み込みされる
        for delta in (3000, 5000, 8000):
            page.mouse.wheel(0, delta)
            time.sleep(0.8)
    return page.content()


# ---------- 検索結果 ----------

def search(keyword):
    """検索結果の商品リストを返す。

    返り値: [{asin, title, price, list_price, rating, reviews, image}]
    """
    items = []
    for page_no in range(1, config.PAGES_PER_QUERY + 1):
        query = urllib.parse.urlencode({"k": keyword, "page": page_no})
        html = _goto(
            f"{SEARCH_URL}?{query}",
            'div[data-component-type="s-search-result"]',
        )
        items.extend(_parse_search_page(html))
        if page_no < config.PAGES_PER_QUERY:
            sleep_polite()
    return items


def _parse_search_page(html):
    soup = BeautifulSoup(html, "html.parser")
    results = soup.select('div[data-component-type="s-search-result"][data-asin]')
    items = []
    for el in results:
        item = _parse_item(el)
        if item:
            items.append(item)
    return items


def _parse_item(item):
    asin = item.get("data-asin", "").strip()
    if not asin:
        return None

    # スポンサー広告は除外
    if item.select_one('[data-component-type="sp-sponsored-result"]'):
        return None

    # 商品名: 通常カードは h2 span だが、カード種によって別要素に入るため
    # 候補の中から最も長いテキストを採用する
    candidates = item.select(
        "h2 span, span.a-size-base-plus, span.a-size-medium, span.a-size-small.a-color-base"
    )
    texts = [c.get_text(strip=True) for c in candidates if c.get_text(strip=True)]
    if not texts:
        return None
    title = max(texts, key=len)

    price = _parse_yen(item.select_one("span.a-price:not(.a-text-price) span.a-offscreen"))
    if not price:
        return None
    # 参考価格（打ち消し線）。無ければセール中でない
    list_price = _parse_yen(item.select_one("span.a-price.a-text-price span.a-offscreen"))
    if list_price is not None and list_price <= price:
        list_price = None

    rating = None
    rating_el = item.select_one("span.a-icon-alt")
    if rating_el:
        # 表記は「5つ星のうち4.3」。先頭の「5」ではなく「のうち」の後の数値を取る
        text = rating_el.get_text()
        m = re.search(r"のうち\s*([0-9.]+)", text) or re.search(r"([0-9.]+)", text)
        if m:
            rating = float(m.group(1))

    reviews = None
    reviews_el = item.select_one('a[aria-label*="件の評価"], span.s-underline-text')
    if reviews_el:
        m = re.search(r"([\d,]+)", reviews_el.get_text())
        if m:
            reviews = int(m.group(1).replace(",", ""))

    image = None
    img_el = item.select_one("img.s-image")
    if img_el:
        image = img_el.get("src")

    return {
        "asin": asin,
        "title": title,
        "price": price,
        "list_price": list_price,
        "rating": rating,
        "reviews": reviews,
        "image": image,
    }


def _parse_yen(el):
    if not el:
        return None
    m = re.search(r"([\d,]+)", el.get_text())
    return int(m.group(1).replace(",", "")) if m else None


# ---------- 商品詳細ページ（売れ筋ランキング・画像） ----------

def fetch_details(asin):
    """商品ページから売れ筋ランキング・画像・価格を取得する。"""
    sleep_polite()
    html = _goto(f"https://www.amazon.co.jp/dp/{asin}", "#productTitle", scroll=True)
    soup = BeautifulSoup(html, "html.parser")

    image = None
    img_el = soup.select_one("#landingImage")
    if img_el:
        image = img_el.get("src")

    price = _parse_yen(soup.select_one(
        "#corePriceDisplay_desktop_feature_div span.a-price:not(.a-text-price) span.a-offscreen"
    )) or _parse_yen(soup.select_one("span.a-price:not(.a-text-price) span.a-offscreen"))

    return {
        "sales_rank": _parse_sales_rank(soup),
        "image": image,
        "price": price,
    }


def _parse_sales_rank(soup):
    """売れ筋ランキングの最初(=大分類)の順位を返す。

    表記例: 「Amazon 売れ筋ランキング 家電＆カメラ - 5,861位 ( ... )」
    """
    text = re.sub(r"\s+", " ", soup.get_text(" ", strip=True))
    m = re.search(r"売れ筋ランキング\D{0,30}?([\d,]+)\s*位", text)
    if m:
        try:
            return int(m.group(1).replace(",", ""))
        except ValueError:
            pass
    return None
