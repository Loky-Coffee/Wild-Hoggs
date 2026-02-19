# Windows in Docker - Anleitung

## 🚀 Schnellstart

### 1. Windows starten
```bash
cd windows-docker
docker-compose up -d
```

### 2. Installation verfolgen
```bash
docker logs -f windows11
```

Die erste Installation dauert **15-30 Minuten** (Windows wird heruntergeladen und installiert).

### 3. Auf Windows zugreifen

#### Option A: Web-Browser (noVNC) - EINFACHSTE METHODE
Öffne im Browser:
```
http://localhost:8006
```

#### Option B: RDP (Remote Desktop)
Verbinde dich mit einem RDP-Client zu:
```
localhost:3389
```

Standardbenutzer:
- **Benutzername**: `Docker`
- **Passwort**: `*****` (wird während der Installation angezeigt)

---

## 📋 Wichtige Befehle

```bash
# Windows starten
docker-compose up -d

# Logs anzeigen
docker logs -f windows11

# Windows stoppen
docker-compose stop

# Windows komplett entfernen (inkl. Daten!)
docker-compose down -v

# Windows neustarten
docker-compose restart

# Status prüfen
docker-compose ps
```

---

## ⚙️ Konfiguration anpassen

Bearbeite `docker-compose.yml`:

- **Mehr RAM**: `RAM_SIZE: "16G"` (aktuell: 8GB)
- **Mehr CPU-Kerne**: `CPU_CORES: "8"` (aktuell: 4)
- **Größere Festplatte**: `DISK_SIZE: "128G"` (aktuell: 64GB)
- **Windows Version ändern**:
  - `VERSION: "10"` für Windows 10
  - `VERSION: "11"` für Windows 11

Nach Änderungen:
```bash
docker-compose down
docker-compose up -d
```

---

## 🔧 Problemlösung

### Windows startet nicht?
```bash
# Prüfe, ob KVM funktioniert
ls -la /dev/kvm

# Sollte sein: crw-rw----+ 1 root kvm
# Falls nicht, füge deinen Benutzer zur kvm-Gruppe hinzu:
sudo usermod -aG kvm $USER
# Dann neu anmelden!
```

### Zu langsam?
- Erhöhe `RAM_SIZE` und `CPU_CORES` in docker-compose.yml
- Stelle sicher, dass KVM-Module geladen sind: `lsmod | grep kvm`

### Port bereits belegt?
Ändere die Ports in docker-compose.yml:
```yaml
ports:
  - "8007:8006"  # Statt 8006
  - "3390:3389"  # Statt 3389
```

---

## 📊 Systemanforderungen

Dein System:
- ✅ 125GB RAM (mehr als genug!)
- ✅ Intel Xeon mit VMX
- ✅ KVM-Module geladen
- ✅ 403GB freier Speicher

**Perfekt geeignet für Windows in Docker!**

---

## 🌐 Externe Zugriff

Um von anderen Geräten im Netzwerk zuzugreifen, ändere die Ports:
```yaml
ports:
  - "0.0.0.0:8006:8006"  # Erlaubt Zugriff von allen IPs
```

Dann zugreifen über: `http://DEINE-IP:8006`

---

## 📚 Mehr Infos

- GitHub: https://github.com/dockur/windows
- Docker Hub: https://hub.docker.com/r/dockurr/windows
