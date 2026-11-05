export const fmtKm = (n) =>
  n == null ? "–" : (Math.round(n * 10) / 10).toLocaleString("nb-NO", { maximumFractionDigits: 1 });

export const DAY_SHORT = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
export const DAY_LONG = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];
