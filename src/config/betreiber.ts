/**
 * Angaben zum Verantwortlichen.
 *
 * Diese Daten stehen in der Datenschutzerklärung (Art. 13 Abs. 1 lit. a DSGVO
 * verlangt Name und Kontaktdaten des Verantwortlichen) und später, falls
 * gewünscht, auch im Impressum.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * HIER MUSS ETWAS EINGETRAGEN WERDEN, BEVOR DIE SEITE LIVE GEHT.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Zur Anschrift, weil die Frage aufkam:
 *
 * Die Datenschutzerklärung verlangt "Name und Kontaktdaten". Eine
 * Postanschrift ist dort nicht ausdrücklich vorgeschrieben — eine
 * E-Mail-Adresse, unter der man dich erreicht, genügt nach verbreiteter
 * Auffassung. Deshalb darf `anschrift` leer bleiben.
 *
 * Anders beim Impressum nach § 5 DDG: Dort ist eine ladungsfähige Anschrift
 * Pflicht, also eine, an die ein Gerichtsvollzieher zustellen kann. Ein
 * Postfach reicht nicht. Wer die eigene Wohnanschrift nicht nennen will, kann
 * eine Empfangsvollmacht erteilen (BGH, Urteil vom 07.07.2023) — dann steht
 * dort die Adresse des Bevollmächtigten, üblicherweise einer Kanzlei.
 */
export const BETREIBER = {
  /** Vollständiger Name der verantwortlichen Person oder Organisation. */
  name: 'Aristotelis Alatzas',

  /**
   * Postanschrift, Zeile für Zeile. Darf leer bleiben — dann nennt die
   * Datenschutzerklärung nur die E-Mail-Adresse.
   * Beispiel: ['Musterstraße 1', '12345 Musterstadt', 'Deutschland']
   */
  anschrift: [] as string[],

  /**
   * E-Mail-Adresse für Datenschutzanfragen. Pflichtangabe.
   *
   * Bewusst eine Adresse der Domain, nicht die private: Sie steht auf einer
   * öffentlich zugänglichen Seite und wird von Adresssammlern gefunden.
   * Postfach liegt bei Mailfence, Weiterleitung ist eingerichtet.
   */
  email: 'privacy@wild-hoggs.com',
} as const;
