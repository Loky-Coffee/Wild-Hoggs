/**
 * Mailversand über Resend.
 *
 * Warum ein Dienst und nicht SMTP: Cloudflare Workers dürfen keine ausgehenden
 * Verbindungen auf den Mail-Ports aufbauen. Das Postfach der Domain liegt bei
 * Mailfence und kann nur empfangen; zum Senden aus der Anwendung heraus braucht
 * es eine HTTP-Schnittstelle.
 *
 * Die DNS-Seite ist getrennt: Mailfence hängt an wild-hoggs.com, Resend an
 * send.wild-hoggs.com. Der DKIM-Schlüssel von Resend liegt dagegen auf der
 * Hauptdomain (resend._domainkey.wild-hoggs.com) — nur dadurch besteht eine
 * Mail mit Absender @wild-hoggs.com die eigene DMARC-Prüfung, die auf
 * p=quarantine steht.
 */

const RESEND_URL = 'https://api.resend.com/emails';

/** Absender. Antworten hierauf gehen ins Leere — deshalb der Hinweis im Text. */
export const ABSENDER = 'Wild Hoggs <noreply@wild-hoggs.com>';

/** Wohin jemand schreiben kann, der doch antworten möchte. */
export const ANTWORT_AN = 'privacy@wild-hoggs.com';

export interface MailErgebnis {
  ok: boolean;
  /** Kennung der Mail bei Resend — hilft beim Nachsehen in deren Protokoll. */
  id?: string;
  fehler?: string;
}

/**
 * Verschickt eine Mail. Wirft nie — der Aufrufer entscheidet, ob ein
 * fehlgeschlagener Versand den Vorgang abbrechen soll.
 *
 * Wichtig für alles rund um Anmeldung: Ein Fehler darf dem Aufrufer NICHT
 * verraten, ob die Adresse existiert. Deshalb gibt diese Funktion den Fehler
 * zurück, statt ihn nach außen zu reichen.
 */
export async function sendeMail(
  apiKey: string | undefined,
  an: string,
  betreff: string,
  html: string,
  text: string,
): Promise<MailErgebnis> {
  if (!apiKey) {
    return { ok: false, fehler: 'RESEND_API_KEY fehlt' };
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: ABSENDER,
        to: [an],
        reply_to: ANTWORT_AN,
        subject: betreff,
        html,
        text,
      }),
    });

    if (!res.ok) {
      // Der Text der Antwort enthält den Grund (falscher Schlüssel, Domain
      // nicht verifiziert, Empfänger abgelehnt). Er gehört ins Protokoll,
      // nicht in die Antwort an den Browser.
      const grund = await res.text().catch(() => '');
      return { ok: false, fehler: `${res.status} ${grund.slice(0, 200)}` };
    }

    const daten = await res.json() as { id?: string };
    return { ok: true, id: daten.id };
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : 'Netzwerkfehler' };
  }
}
