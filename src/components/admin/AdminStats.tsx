import { useState, useEffect, useRef } from 'preact/hooks';

// Statistik-Bereich des Admin-Panels.
//
// Chart.js wiegt gut 200 KB. Der Import steht deshalb bewusst nicht oben in der
// Datei, sondern wird erst geholt, wenn jemand diesen Bereich öffnet — sonst
// zahlten alle Besucher der Seite für etwas, das nur die Verwaltung sieht.
//
// Alle Zahlen stammen aus Feldern, die ohnehin gespeichert werden (siehe
// functions/api/admin/stats.ts). Es wird nichts zusätzlich mitgeschrieben.

interface Paar { wert: string; n: number }
interface Stunde { stunde: number; n: number }

export interface StatsDaten {
  eckdaten: {
    konten: number; konten_30t: number; aktiv_24h: number; aktiv_7t: number;
    chat_global: number; chat_server: number; chat_pm: number; spielprofile: number;
  };
  anmeldungen: Stunde[];
  monate:      { monat: string; n: number }[];
  sprachen:    Paar[];
  fraktionen:  Paar[];
  server:      Paar[];
  rechner:     Paar[];
  chat:     { stunden: Stunde[]; tage: { tag: string; n: number }[] };
  neueste:  { username: string; created_at: string; server: string | null }[];
  aktivste: { username: string; n: number }[];
  meldungen: number;
  codes: { wartend: number; aktiv: number };
}

const RECHNER_NAMEN: Record<string, string> = {
  research: 'Forschung', building: 'Gebäude', tank: 'Panzer',
  caravan: 'Karawane', 'hero-exp': 'Helden-EP',
};

const MONATE_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function monatsName(iso: string): string {
  const [j, m] = iso.split('-');
  return `${MONATE_KURZ[Number(m) - 1] ?? m} ${j.slice(2)}`;
}

/** Liest eine CSS-Variable — so folgen die Diagramme dem Design des Panels. */
function farbe(name: string, fallback: string): string {
  if (typeof getComputedStyle === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export default function AdminStats({ token }: { readonly token: string }) {
  const [daten, setDaten]   = useState<StatsDaten | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const refStunden  = useRef<HTMLCanvasElement>(null);
  const refMonate   = useRef<HTMLCanvasElement>(null);
  const refSprachen = useRef<HTMLCanvasElement>(null);
  const refRechner  = useRef<HTMLCanvasElement>(null);
  // Chart-Instanzen merken, damit sie beim Verlassen wieder abgebaut werden —
  // sonst hängt Chart.js an einer Leinwand, die es nicht mehr gibt.
  const charts = useRef<any[]>([]);

  useEffect(() => {
    let abgebrochen = false;
    fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
      .then((d: StatsDaten) => { if (!abgebrochen) setDaten(d); })
      .catch(() => { if (!abgebrochen) setFehler('Statistik konnte nicht geladen werden.'); });
    return () => { abgebrochen = true; };
  }, [token]);

  useEffect(() => {
    if (!daten) return;
    let abgebrochen = false;

    (async () => {
      const { Chart, registerables } = await import('chart.js');
      if (abgebrochen) return;
      Chart.register(...registerables);

      const text   = farbe('--admin-text-dim', '#9b9186');
      const gitter = 'rgba(255,255,255,.07)';
      const akzent = farbe('--admin-accent', '#ffa500');
      const info   = '#7cc5ff';
      const gut    = '#52be80';
      const achtung = '#e0a030';
      const kritisch = '#e74c3c';

      Chart.defaults.color = text;
      Chart.defaults.font.family = 'system-ui, -apple-system, sans-serif';
      Chart.defaults.font.size = 11;
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) Chart.defaults.animation = false;

      const achsen = () => ({
        x: { grid: { color: gitter, drawTicks: false }, border: { display: false } },
        y: { grid: { color: gitter, drawTicks: false }, border: { display: false }, beginAtZero: true },
      });
      const basis = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };

      const mach = (el: HTMLCanvasElement | null, cfg: any) => {
        if (!el) return;
        charts.current.push(new Chart(el, cfg));
      };

      // Anmeldungen je Stunde — die Spitze farblich hervorheben
      const hoechste = Math.max(...daten.anmeldungen.map(s => s.n), 0);
      mach(refStunden.current, {
        type: 'bar',
        data: {
          labels: daten.anmeldungen.map(s => String(s.stunde).padStart(2, '0')),
          datasets: [{
            data: daten.anmeldungen.map(s => s.n),
            backgroundColor: daten.anmeldungen.map(s => s.n === hoechste && hoechste > 0 ? akzent : akzent + '66'),
            borderRadius: 3,
          }],
        },
        options: { ...basis, scales: achsen(), plugins: { legend: { display: false }, tooltip: {
          callbacks: { title: (i: any) => `${i[0].label}:00 Uhr`, label: (c: any) => `${c.parsed.y} Anmeldungen` } } } },
      });

      // Neue Konten je Monat
      mach(refMonate.current, {
        type: 'line',
        data: {
          labels: daten.monate.map(m => monatsName(m.monat)),
          datasets: [{
            data: daten.monate.map(m => m.n),
            borderColor: akzent, backgroundColor: akzent + '22',
            fill: true, tension: 0.35, borderWidth: 2,
            pointRadius: 3, pointBackgroundColor: akzent, pointHoverRadius: 6,
          }],
        },
        options: { ...basis, scales: achsen(), plugins: { legend: { display: false }, tooltip: {
          callbacks: { label: (c: any) => `${c.parsed.y} neue Konten` } } } },
      });

      // Sprachen — Ring
      const spr = daten.sprachen.slice(0, 5);
      const rest = daten.sprachen.slice(5).reduce((s, x) => s + x.n, 0);
      const gesamt = daten.sprachen.reduce((s, x) => s + x.n, 0) || 1;
      mach(refSprachen.current, {
        type: 'doughnut',
        data: {
          labels: [...spr.map(s => s.wert), ...(rest ? ['Übrige'] : [])],
          datasets: [{
            data: [...spr.map(s => s.n), ...(rest ? [rest] : [])],
            backgroundColor: [akzent, info, gut, achtung, kritisch, '#4a443c'],
            borderWidth: 0,
          }],
        },
        options: { ...basis, cutout: '58%', plugins: {
          legend: { display: true, position: 'right', labels: { boxWidth: 9, boxHeight: 9, padding: 8, usePointStyle: true } },
          tooltip: { callbacks: { label: (c: any) => `${c.label}: ${c.parsed} (${Math.round(c.parsed / gesamt * 100)} %)` } } } },
      });

      // Rechner — waagerecht, weil die Namen sonst zu eng stehen
      mach(refRechner.current, {
        type: 'bar',
        data: {
          labels: daten.rechner.map(r => RECHNER_NAMEN[r.wert] ?? r.wert),
          datasets: [{ data: daten.rechner.map(r => r.n), backgroundColor: akzent + 'aa', borderRadius: 3 }],
        },
        options: { ...basis, indexAxis: 'y', scales: achsen(), plugins: { legend: { display: false }, tooltip: {
          callbacks: { label: (c: any) => `${c.parsed.x} gespeicherte Stände` } } } },
      });
    })();

    return () => {
      abgebrochen = true;
      charts.current.forEach(c => { try { c.destroy(); } catch { /* schon weg */ } });
      charts.current = [];
    };
  }, [daten]);

  if (fehler) return <p class="admin-empty">{fehler}</p>;
  if (!daten)  return <p class="admin-loading">Zahlen werden geholt …</p>;

  const e = daten.eckdaten;
  const anteil = (n: number) => e.konten ? Math.round(n / e.konten * 100) : 0;

  return (
    <>
      <div class="admin-kz-gitter">
        <Kachel label="Konten"        wert={e.konten}      zusatz={`+${e.konten_30t} in 30 Tagen`} />
        <Kachel label="Aktiv (24 h)"  wert={e.aktiv_24h}   zusatz={`${anteil(e.aktiv_24h)} % aller Konten`} />
        <Kachel label="Aktiv (7 Tage)" wert={e.aktiv_7t}   zusatz={`${anteil(e.aktiv_7t)} % aller Konten`} />
        <Kachel label="Nachrichten"   wert={e.chat_global + e.chat_server + e.chat_pm}
                zusatz={`${e.chat_global} global · ${e.chat_server} Server · ${e.chat_pm} privat`} />
      </div>

      <section class="admin-stat-block">
        <h3 class="admin-stat-titel">Anmeldungen nach Tageszeit</h3>
        <div class="admin-leinwand"><canvas ref={refStunden} /></div>
      </section>

      <section class="admin-stat-block">
        <h3 class="admin-stat-titel">Neue Konten je Monat</h3>
        <div class="admin-leinwand"><canvas ref={refMonate} /></div>
      </section>

      <div class="admin-stat-paar">
        <section class="admin-stat-block">
          <h3 class="admin-stat-titel">Sprachen</h3>
          <div class="admin-leinwand admin-leinwand-klein"><canvas ref={refSprachen} /></div>
        </section>
        <section class="admin-stat-block">
          <h3 class="admin-stat-titel">Meistgenutzte Rechner</h3>
          <div class="admin-leinwand admin-leinwand-klein"><canvas ref={refRechner} /></div>
        </section>
      </div>

      <div class="admin-stat-paar">
        <Tabelle titel="Fraktionen" zeilen={daten.fraktionen} gesamt={e.konten} />
        <Tabelle titel="Server"     zeilen={daten.server}     gesamt={e.konten} />
      </div>

      <div class="admin-stat-paar">
        <section class="admin-stat-block">
          <h3 class="admin-stat-titel">Zuletzt registriert</h3>
          <ul class="admin-mini-liste">
            {daten.neueste.map(n => (
              <li key={n.username}>
                <span>{n.username}</span>
                <span class="admin-mini-still">{n.server ? `Server ${n.server}` : '—'}</span>
              </li>
            ))}
          </ul>
        </section>
        <section class="admin-stat-block">
          <h3 class="admin-stat-titel">Aktivste im Chat</h3>
          <ul class="admin-mini-liste">
            {daten.aktivste.map(a => (
              <li key={a.username}>
                <span>{a.username}</span>
                <span class="admin-mini-still">{a.n} Nachrichten</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function Kachel({ label, wert, zusatz }: { readonly label: string; readonly wert: number; readonly zusatz?: string }) {
  return (
    <div class="admin-kz">
      <div class="admin-kz-label">{label}</div>
      <div class="admin-kz-wert">{wert.toLocaleString('de-DE')}</div>
      {zusatz && <div class="admin-kz-zusatz">{zusatz}</div>}
    </div>
  );
}

function Tabelle({ titel, zeilen, gesamt }: {
  readonly titel: string; readonly zeilen: Paar[]; readonly gesamt: number;
}) {
  const max = Math.max(...zeilen.map(z => z.n), 1);
  return (
    <section class="admin-stat-block">
      <h3 class="admin-stat-titel">{titel}</h3>
      <div class="admin-balken-liste">
        {zeilen.map(z => (
          <div class="admin-balken-zeile" key={z.wert}>
            <span>{z.wert}</span>
            <span class="admin-balken-zahl">
              {z.n}{gesamt ? ` · ${Math.round(z.n / gesamt * 100)} %` : ''}
            </span>
            <span class="admin-balken-spur"><i style={{ width: `${z.n / max * 100}%` }} /></span>
          </div>
        ))}
      </div>
    </section>
  );
}
