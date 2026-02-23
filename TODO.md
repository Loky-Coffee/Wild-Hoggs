Jetzt habe ich ein vollständiges Bild. Hier sind alle gefundenen Probleme:                                         
                                                                                                                     
  ---                                                                                                                
  Ergebnisse der vollständigen Untersuchung                                                                          
                                                                                                                     
  1. Hero-Daten — Skills fehlen                                                                                      
a
  ┌──────────┬────────┬────────┬───────────────────────────────────────────────────┐                                 
  │   Hero   │ Rarity │ Skills │                      Problem                      │                                 
  ├──────────┼────────┼────────┼───────────────────────────────────────────────────┤                                 
  │ Amber    │ S4     │ 0/4    │ Alle Skills fehlen                                │                                 
  ├──────────┼────────┼────────┼───────────────────────────────────────────────────┤                                 
  │ Alma     │ S2     │ 0/4    │ Alle Skills fehlen                                │                                 
  ├──────────┼────────┼────────┼───────────────────────────────────────────────────┤                                 
  │ Bella    │ S2     │ 0/4    │ Alle Skills fehlen                                │                                 
  ├──────────┼────────┼────────┼───────────────────────────────────────────────────┤                                 
  │ Dodomeki │ S3     │ 0/4    │ Alle Skills fehlen                                │                                 
  ├──────────┼────────┼────────┼───────────────────────────────────────────────────┤                                 
  │ Harleyna │ S2     │ 0/4    │ Alle Skills fehlen                                │                                 
  ├──────────┼────────┼────────┼───────────────────────────────────────────────────┤                                 
  │ Licia    │ S3     │ 0/4    │ Alle Skills fehlen                                │                                 
  ├──────────┼────────┼────────┼───────────────────────────────────────────────────┤
  │ Liliana  │ S3     │ 0/4    │ Alle Skills fehlen                                │                                 
  ├──────────┼────────┼────────┼───────────────────────────────────────────────────┤                                 
  │ Nyx      │ S1     │ 0/4    │ Alle Skills fehlen                                │
  ├──────────┼────────┼────────┼───────────────────────────────────────────────────┤
  │ Queenie  │ S4     │ 0/4    │ Alle Skills fehlen                                │
  ├──────────┼────────┼────────┼───────────────────────────────────────────────────┤
  │ Yu Chan  │ S4     │ 0/4    │ Alle Skills fehlen                                │
  ├──────────┼────────┼────────┼───────────────────────────────────────────────────┤
  │ Mia      │ S      │ 3/4    │ Exclusive fehlt (bekannt)                         │
  ├──────────┼────────┼────────┼───────────────────────────────────────────────────┤
  │ Sakura   │ S1     │ 2/4    │ Global + Exclusive fehlen + Placeholder (bekannt) │
  └──────────┴────────┴────────┴───────────────────────────────────────────────────┘

  25 von 36 Heroes haben vollständige Skills. 11 sind unvollständig.

  ---
  2. Hero-Beschreibungen — fast alle leer

  Nur Athena und Katrina haben eine Beschreibung — alle anderen 34 Heroes haben description: ''. Das ist kein Bug
  (der Code zeigt einfach nichts wenn leer), aber ein Content-Gap.

  ---
  3. Research-Icons — die meisten Kategorien zeigen Fallback-Buchstaben

  ┌───────────────────────┬─────────────────┬──────────────┬────────────────┐
  │       Kategorie       │ Icons vorhanden │ Knoten total │     Status     │
  ├───────────────────────┼─────────────────┼──────────────┼────────────────┤
  │ alliance-recognition  │ 19              │ 19           │ ✅ Vollständig │
  ├───────────────────────┼─────────────────┼──────────────┼────────────────┤
  │ unit-special-training │ 13              │ 22           │ ⚠️  9 fehlen    │
  ├───────────────────────┼─────────────────┼──────────────┼────────────────┤
  │ field                 │ 5               │ 14           │ ⚠️  9 fehlen    │
  ├───────────────────────┼─────────────────┼──────────────┼────────────────┤
  │ army-building         │ 0               │ 23           │ ❌ Alle fehlen │
  ├───────────────────────┼─────────────────┼──────────────┼────────────────┤
  │ fully-armed-alliance  │ 0               │ 18           │ ❌ Alle fehlen │
  ├───────────────────────┼─────────────────┼──────────────┼────────────────┤
  │ hero-training         │ 0               │ 13           │ ❌ Alle fehlen │
  ├───────────────────────┼─────────────────┼──────────────┼────────────────┤
  │ military-strategies   │ 0               │ 18           │ ❌ Alle fehlen │
  ├───────────────────────┼─────────────────┼──────────────┼────────────────┤
  │ peace-shield          │ 0               │ 16           │ ❌ Alle fehlen │
  ├───────────────────────┼─────────────────┼──────────────┼────────────────┤
  │ siege-to-seize        │ 0               │ 18           │ ❌ Alle fehlen │
  └───────────────────────┴─────────────────┴──────────────┴────────────────┘



  CF-2 — Cloudflare Worker für 404

  Wenn jemand eine falsche URL besucht (z.B. /xyz), zeigt deine 404-Seite eine Weiterleitung zur richtigen Sprache.
  Das passiert aktuell mit JavaScript im Browser — also lädt erstmal die 404-Seite, dann läuft JS, dann wird
  weitergeleitet.

  Ein "Cloudflare Worker" ist ein kleines Skript das auf Cloudflares Servern läuft, bevor die Seite überhaupt geladen
   wird. Das wäre schneller.

  Risiko wenn nicht gemacht: Kein Problem. Die aktuelle Lösung funktioniert einwandfrei, ist nur minimal langsamer.

  ---
  CODE-4 — Sentry

  Sentry ist ein Fehler-Tracking-Dienst. Wenn bei einem Nutzer irgendwo in deiner App ein JavaScript-Fehler auftritt,
   bekommst du automatisch eine Benachrichtigung mit genauer Fehlermeldung, Browsertyp, Seite usw.

  Aktuell weißt du nur von Fehlern, wenn dir ein Nutzer es schreibt. Mit Sentry siehst du Fehler sofort selbst.

  Risiko wenn nicht gemacht: Du merkst Bugs nur, wenn Nutzer sie melden. Für eine kleine Community-Seite oft
  ausreichend.
