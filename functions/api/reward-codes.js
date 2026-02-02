/**
 * Cloudflare Pages Function: Reward Codes API
 *
 * Fetcht Last-Z Reward Codes von levelgeeks.org und cached sie für 30 Minuten.
 * Fallback zu leeren Array bei Fetch-Fehler.
 *
 * Endpoint: /api/reward-codes
 * Cache: 30 Min (Cloudflare Edge)
 * Stale-While-Revalidate: 1 Stunde
 */

/**
 * Note: Cloudflare Pages Functions run in Workers runtime (V8 Isolates)
 * We use HTMLRewriter API instead of node-html-parser
 */

export async function onRequest(context) {
  try {
    // Fetch von levelgeeks.org mit 5s Timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      'https://levelgeeks.org/last-z-survival-shooter-codes/',
      {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Wild-Hoggs-Bot/1.0)'
        }
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // Parse HTML für Reward Codes (Regex-basiert für Edge Runtime)
    const codes = [];

    // Blacklist: Bekannte False-Positives ausschließen
    const blacklist = new Set([
      'VISIT', 'CONFIRM', 'TITLE', 'PUBLISHER', 'GENRE', 'PLATFORM',
      'RELEASED', 'DEVELOPER', 'ESRB', 'CONTENT', 'RATING', 'PLATFORMS',
      'NINTENDO', 'PLAYSTATION', 'XBOX', 'STEAM'
    ]);

    // Helper: Prüft ob Code ein valider Last-Z Reward Code ist
    const isValidRewardCode = (code) => {
      // Zu kurz oder zu lang
      if (code.length < 4 || code.length > 20) return false;

      // Blacklist-Check
      if (blacklist.has(code.toUpperCase())) return false;

      // Muss mindestens 1 Zahl enthalten
      if (!/\d/.test(code)) return false;

      // Valide Patterns:
      // 1. Beginnt mit "LZ" (offizielles Last-Z Prefix)
      if (code.startsWith('LZ')) return true;

      // 2. Enthält Event-Keywords
      const eventKeywords = ['CHRISTMAS', 'XMAS', 'DISCORD', 'HAPPY', 'COMMING', 'BYEBYE', 'NEWYEAR'];
      if (eventKeywords.some(kw => code.includes(kw))) return true;

      // 3. Jahr-Codes (z.B. "2026ISCOMMING", "BYEBYE2025")
      if (/20\d{2}/.test(code) && code.length >= 8) return true;

      // Alles andere ablehnen (vermeidet Produktnummern wie PMP, TAB, etc.)
      return false;
    };

    // Pattern 1: Codes in <code>, <strong>, <b> Tags
    const tagPattern = /<(?:code|strong|b)[^>]*>([A-Z0-9]{4,20})<\/(?:code|strong|b)>/gi;
    let match;
    while ((match = tagPattern.exec(html)) !== null) {
      const code = match[1];
      if (isValidRewardCode(code)) {
        codes.push({
          code: code,
          timestamp: Date.now()
        });
      }
    }

    // Pattern 2: Standalone Codes (nur Last-Z spezifische Patterns)
    const wordPattern = /\b([A-Z]{2}[A-Z0-9]{2,18})\b/g;
    while ((match = wordPattern.exec(html)) !== null) {
      const potentialCode = match[1];
      if (isValidRewardCode(potentialCode)) {
        codes.push({
          code: potentialCode,
          timestamp: Date.now()
        });
      }
    }

    // Dedupliziere Codes
    const uniqueCodes = [...new Map(codes.map(c => [c.code, c])).values()];

    console.log(`[Reward Codes API] Fetched ${uniqueCodes.length} codes from levelgeeks.org`);

    // Return mit Cloudflare Edge Cache Headers
    return new Response(
      JSON.stringify({
        codes: uniqueCodes,
        fetchedAt: new Date().toISOString(),
        source: 'levelgeeks.org',
        count: uniqueCodes.length
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          // Cache 30 Minuten auf Cloudflare Edge
          'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
          // Cloudflare-spezifische Cache Control
          'CDN-Cache-Control': 'max-age=1800',
          // CORS für API-Zugriff
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          // Cache-Status Header für Debugging
          'X-Cache-Status': 'MISS',
          'X-Fetched-At': new Date().toISOString()
        }
      }
    );

  } catch (error) {
    console.error('[Reward Codes API] Error:', error.message);

    // Fallback: Return leeres Array bei Fehler
    return new Response(
      JSON.stringify({
        codes: [],
        fetchedAt: new Date().toISOString(),
        source: 'fallback',
        error: error.message,
        count: 0
      }),
      {
        status: 200, // 200 statt 500, damit Page nicht bricht
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=300', // 5 Min Cache bei Error
          'Access-Control-Allow-Origin': '*',
          'X-Cache-Status': 'ERROR'
        }
      }
    );
  }
}

// Handle OPTIONS preflight requests
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
