// Kontekstuelle coach-linjer: kort, varmt og konkret – riktig info i riktig øyeblikk.
import { fmtKm } from "./format";

export function coachLine({ tPlan, doneToday, doneTodayKm, week }) {
  if (!tPlan) return { head: "Ingen plan for i dag", body: "Planen er ikke lagt inn for denne uka ennå." };

  if (tPlan.run && doneToday) {
    return {
      head: "Dagens tur er i boks.",
      body: `${fmtKm(doneTodayKm)} km logget. Spis, sov, gjenta.`,
    };
  }

  switch (tPlan.run) {
    case "long":
      return {
        head: `Langtur i dag. ${tPlan.km} km.`,
        body: "Bestem distansen før du går, og hold deg til den. Snakketempo, nedoverbakker sist.",
      };
    case "quality":
      return {
        head: "Kveldens jobb: rolig, eller terskel.",
        body: "Kjenner du deg fersk etter benken: 5 × 5 min i nedre sone 4. Ellers: rolig i sone 2.",
      };
    case "easy":
      return {
        head: `Rolig ${fmtKm(tPlan.km)} km i kveld.`,
        body: "Puls under 160, kort og kjapt steg, ingen spurt. Kjedelig er riktig.",
      };
  }

  if (tPlan.strength === "legs")
    return { head: "Legday. Ingen løping.", body: "Tung i bunn, eksentrisk enbein og legg til slutt. Beina skal få jobbe i fred." };
  if (tPlan.strength === "push")
    return { head: "Push i dag. Ingen løping.", body: week?.deload ? "Deload-uke for løpingen – overkroppen kan gå for fullt." : "Ren overkropp. Beina hviler til neste tur." };
  return { head: "Pull i dag. Ingen løping.", body: "Vektede pullups først, mens du er fersk. Beina hviler til neste tur." };
}

export function paceStatus(diff) {
  if (diff == null) return null;
  if (Math.abs(diff) < 0.5) return { tone: "ok", text: "På planen" };
  if (diff > 0) return { tone: "ok", text: `${fmtKm(diff)} km foran planen` };
  return { tone: "behind", text: `${fmtKm(-diff)} km bak – ikke jag det inn` };
}
