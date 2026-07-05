/**
 * 閲覧数カウンター（Cloudflare Worker・任意）
 *
 * デプロイ手順:
 * 1. Cloudflareダッシュボード → Workers & Pages → Create Worker
 * 2. このコードを貼り付け
 * 3. KV namespace を作成し「VIEWS」という名前でバインドする
 * 4. WorkerのURLを GitHub リポジトリの Variables に COUNTER_URL として登録
 *    （サイト側の meta.json 経由で自動的に有効になる）
 *
 * エンドポイント:
 *   POST/GET /hit?asin=XXX&kind=view|click  … カウント+1
 *   GET      /top?n=50                      … {asin: count} 上位N件
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST",
    };

    if (url.pathname === "/hit") {
      const asin = (url.searchParams.get("asin") || "").slice(0, 20);
      if (!/^[A-Z0-9]{10}$/.test(asin)) {
        return new Response("bad asin", { status: 400, headers: cors });
      }
      const key = `v:${asin}`;
      const cur = parseInt((await env.VIEWS.get(key)) || "0", 10);
      await env.VIEWS.put(key, String(cur + 1));
      return new Response("ok", { headers: cors });
    }

    if (url.pathname === "/top") {
      const n = Math.min(parseInt(url.searchParams.get("n") || "50", 10), 200);
      const list = await env.VIEWS.list({ prefix: "v:", limit: 1000 });
      const entries = [];
      for (const k of list.keys) {
        const count = parseInt((await env.VIEWS.get(k.name)) || "0", 10);
        entries.push([k.name.slice(2), count]);
      }
      entries.sort((a, b) => b[1] - a[1]);
      const top = Object.fromEntries(entries.slice(0, n));
      return new Response(JSON.stringify(top), {
        headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "max-age=300" },
      });
    }

    return new Response("not found", { status: 404, headers: cors });
  },
};
