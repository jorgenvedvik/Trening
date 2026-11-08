// Lagring av hviledager i Upstash Redis (Vercel Storage). Brukes via REST, ingen ekstra pakker.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = "puls:rest-days";
export const REST_TAG = "rest-days";

export const storeConfigured = () => Boolean(URL_ && TOKEN);

export async function getRestDays() {
  if (!storeConfigured()) return [];
  try {
    const res = await fetch(`${URL_}/smembers/${encodeURIComponent(KEY)}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      next: { revalidate: 600, tags: [REST_TAG] },
    });
    if (!res.ok) throw new Error(`store ${res.status}`);
    const { result } = await res.json();
    return (result ?? []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  } catch (e) {
    console.error(e);
    return [];
  }
}

async function cmd(...args) {
  const res = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`store ${res.status}`);
  return res.json();
}

export const addRestDay = (iso) => cmd("SADD", KEY, iso);
export const removeRestDay = (iso) => cmd("SREM", KEY, iso);
