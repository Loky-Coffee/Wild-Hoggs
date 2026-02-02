# Deployment auf Cloudflare Pages

Diese Anleitung erklärt, wie du die Wild Hoggs Website auf Cloudflare Pages deployen kannst.

## Voraussetzungen

- Ein Cloudflare Account
- Die Domain wild-hoggs.com in Cloudflare
- Dieses GitHub Repository

## Schritte zum Deployment

### 1. Cloudflare Pages Projekt erstellen

1. Gehe zu [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigiere zu **Workers & Pages**
3. Klicke auf **Create application**
4. Wähle **Pages** Tab
5. Klicke auf **Connect to Git**

### 2. Repository verbinden

1. Autorisiere Cloudflare für dein GitHub Account
2. Wähle das Repository **wild-hoggs**
3. Klicke auf **Begin setup**

### 3. Build Einstellungen konfigurieren

Verwende diese Einstellungen:

- **Project name:** wild-hoggs
- **Production branch:** main
- **Framework preset:** Astro
- **Build command:** `npm run build`
- **Build output directory:** `dist`

### 4. Deploy starten

1. Klicke auf **Save and Deploy**
2. Warte bis der Build abgeschlossen ist (ca. 1-2 Minuten)
3. Du erhältst eine `*.pages.dev` URL zum Testen

### 5. Custom Domain einrichten

1. Gehe zu deinem Pages Projekt
2. Klicke auf **Custom domains**
3. Klicke auf **Set up a custom domain**
4. Gib `wild-hoggs.com` ein
5. Cloudflare konfiguriert automatisch die DNS Einträge
6. Warte bis der DNS propagiert ist (kann bis zu 24h dauern, meist aber nur wenige Minuten)

## Lokale Entwicklung

Zum lokalen Testen:

```sh
# Development Server starten
npm run dev

# Build testen
npm run build
npm run preview
```

Der Development Server läuft auf http://localhost:4321

## Automatische Deployments

Cloudflare Pages deployt automatisch:
- **main branch** → Production (wild-hoggs.com)
- **andere branches** → Preview Deployments

Jeder Push zu GitHub triggert automatisch einen neuen Build!

## Troubleshooting

### Build fehlgeschlagen?
- Überprüfe die Build Logs in Cloudflare Dashboard
- Stelle sicher, dass `npm install` und `npm run build` lokal funktionieren

### Domain funktioniert nicht?
- Warte ein paar Minuten (DNS Propagierung)
- Überprüfe die DNS Einstellungen in Cloudflare
- Stelle sicher, dass die Domain auf "Proxied" (orange Cloud) steht

### Änderungen werden nicht angezeigt?
- Lösche den Browser Cache
- Warte ein paar Minuten (Cloudflare CDN Cache)
- Überprüfe ob der Build erfolgreich war

## Kosten

Cloudflare Pages Free Plan beinhaltet:
- Unlimited Bandbreite
- Unlimited Requests
- 500 Builds pro Monat
- 1 Build zur Zeit

Perfekt für eine Gilden-Website!
