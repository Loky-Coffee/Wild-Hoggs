/**
 * Zeitstempel aus der Datenbank in Millisekunden umrechnen.
 *
 * Die Datenbank liefert zwei Schreibweisen nebeneinander:
 *   • SQLite selbst  — "2026-08-20 21:59:00"     (datetime('now'), immer UTC,
 *                                                  aber ohne jede Kennzeichnung)
 *   • unsere APIs    — "2026-08-20T21:59:00.000Z" (ISO mit Zonenangabe)
 *
 * Fehlt die Kennzeichnung, deutet `new Date(...)` den Wert als Ortszeit des
 * Betrachters. Derselbe Gift-Code liefe dann in Tokio sieben Stunden früher ab
 * als in Berlin, und zwischen zwei Geräten verglichene Zeitstempel wären um die
 * Zeitzonendifferenz verschoben — genau so gingen schon einmal Rechnerstände
 * verloren.
 *
 * Deshalb: Wo keine Zone dabeisteht, wird ausdrücklich UTC angenommen.
 *
 * @returns Millisekunden seit 1970, oder NaN wenn der Wert unlesbar ist.
 *          Wer stattdessen 0 braucht, schreibt `msAusZeitstempel(x) || 0`.
 */
export function msAusZeitstempel(ts: string | null | undefined): number {
  if (!ts) return NaN;
  const hatZone = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(ts);
  const iso = ts.includes('T') ? ts : ts.replace(' ', 'T');
  const ms = new Date(hatZone ? iso : iso + 'Z').getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

/**
 * Stundenwerte aus der Datenbank auf die Zeit des Betrachters drehen.
 *
 * SQLite gruppiert nach UTC-Stunden. Unbehandelt behauptet das Diagramm "die
 * meisten melden sich um 20 Uhr an" und meint 20 Uhr UTC — im Sommer also 22
 * Uhr hier. Die Summen bleiben unverändert, nur ihre Zuordnung verschiebt sich.
 *
 * Halbe Zeitzonen (Indien, +5:30) landen auf der abgerundeten Stunde.
 */
export function stundenInOrtszeit<T extends { stunde: number; n: number }>(
  stunden: T[],
): { stunde: number; n: number }[] {
  const versatz = -new Date().getTimezoneOffset() / 60;
  const raus = Array.from({ length: 24 }, (_, h) => ({ stunde: h, n: 0 }));
  for (const s of stunden) {
    const ziel = Math.floor((((s.stunde + versatz) % 24) + 24) % 24);
    raus[ziel].n += s.n;
  }
  return raus;
}
