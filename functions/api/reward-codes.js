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

    // Pattern 1: Codes in <code>, <strong>, <b> Tags
    const tagPattern = /<(?:code|strong|b)[^>]*>([A-Z0-9]{4,15})<\/(?:code|strong|b)>/gi;
    let match;
    while ((match = tagPattern.exec(html)) !== null) {
      codes.push({
        code: match[1],
        timestamp: Date.now()
      });
    }

    // Pattern 2: Standalone Codes (GROSSBUCHSTABEN + ZAHLEN)
    // Suche nach Wörtern die wie Codes aussehen
    const wordPattern = /\b([A-Z]{3,}[A-Z0-9]{1,12})\b/g;
    while ((match = wordPattern.exec(html)) !== null) {
      const potentialCode = match[1];
      // Filtere nur valide Code-Muster (mindestens 1 Zahl)
      if (/\d/.test(potentialCode) && potentialCode.length >= 4 && potentialCode.length <= 15) {
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
