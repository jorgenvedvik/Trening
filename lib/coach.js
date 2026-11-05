// Kontekstuelle coach-linjer: kort, varmt og konkret – riktig info i riktig øyeblikk.
import { fmtKm } from "./format";

export function coachLine({ tPlan, doneToday, doneTodayKm, week }) {
  if (!tPlan) return { head: "Ingen plan for i dag", body: "Planen er ikke lagt inn for denne uka ennå." };

  if (tPlan.run && doneToday) {
    return {
      head: "Dagens tur er i boks.",
      body: `${fmtKm(doneTodayKm)} km logget. Spis, sov – og la trappetesten i morgen tidlig si sitt.`,
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
  if (tPlan.extra)
    return { head: "Trappetest i morges?", body: "0–1/10 ned trappa = grønt. Da går uka videre som planlagt." };
  if (tPlan.strength === "rest")
    return { head: "Hviledag.", body: "Det er her formen faktisk bygges. Gå en tur, spis godt." };
  return { head: "Ingen løping i dag.", body: week?.deload ? "Deload-uke – mindre er mer." : "Hold beina fri før langturen." };
}

export function paceStatus(diff) {
  if (diff == null) return null;
  if (Math.abs(diff) < 0.5) return { tone: "ok", text: "På planen" };
  if (diff > 0) return { tone: "ok", text: `${fmtKm(diff)} km foran planen` };
  return { tone: "behind", text: `${fmtKm(-diff)} km bak – ikke jag det inn` };
}
