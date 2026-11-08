import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { timingSafeEqual } from "node:crypto";
import { addRestDay, removeRestDay, storeConfigured, REST_TAG } from "../../../lib/store";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function passwordOk(given) {
  const pw = process.env.PLAN_PASSWORD;
  if (!pw || typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(pw);
  return a.length === b.length && timingSafeEqual(a, b);
}

// POST { date: "YYYY-MM-DD", action: "add" | "remove", password }
export async function POST(request) {
  if (!storeConfigured() || !process.env.PLAN_PASSWORD) {
    return NextResponse.json({ error: "Lagring eller PLAN_PASSWORD er ikke satt opp i Vercel." }, { status: 503 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }
  const { date, action, password } = body ?? {};
  if (!passwordOk(password)) {
    await sleep(1000); // bremser gjetting
    return NextResponse.json({ error: "Feil passord." }, { status: 401 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !["add", "remove"].includes(action)) {
    return NextResponse.json({ error: "Ugyldig dato eller handling." }, { status: 400 });
  }
  try {
    if (action === "add") await addRestDay(date);
    else await removeRestDay(date);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Klarte ikke å lagre. Prøv igjen." }, { status: 502 });
  }
  revalidateTag(REST_TAG);
  revalidatePath("/");
  return NextResponse.json({ ok: true });
}
