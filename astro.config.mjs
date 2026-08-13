import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://wild-hoggs.com',
  trailingSlash: 'always',
  i18n: {
    defaultLocale: 'en',
    locales: ['de', 'en', 'fr', 'ko', 'th', 'ja', 'pt', 'es', 'tr', 'id', 'zh-TW', 'zh-CN', 'it', 'ar', 'vi'],
    routing: {
      prefixDefaultLocale: false
    }
  },
  integrations: [
    preact(),
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: {
          de: 'de',
          en: 'en',
          fr: 'fr',
          ko: 'ko',
          th: 'th',
          ja: 'ja',
          pt: 'pt',
          es: 'es',
          tr: 'tr',
          id: 'id',
          'zh-TW': 'zh-TW',
          'zh-CN': 'zh-CN',
          it: 'it',
          ar: 'ar',
          vi: 'vi'
        }
      },
      // SEO-Optimierung: <lastmod> Tag hinzufügen (wichtigster optionaler Tag)
      // Google, Bing, Yandex nutzen lastmod für intelligenteres Crawling
      serialize(item) {
        // SEO: Exclude non-indexable pages from sitemap
        //
        // Was hier fehlt, landet in der Sitemap und traegt trotzdem noindex —
        // die Sitemap bittet Google dann um die Aufnahme einer Seite, die sich
        // selbst die Aufnahme verbietet. Das kostet Crawl-Budget und stiftet
        // widerspruechliche Signale.
        //
        // /tools/hero-exp ist eine Weiterleitung auf /heroes#exp (alte Adresse,
        // siehe hero-exp.astro) und stand mit 15 Sprachfassungen in der Sitemap.
        const excludedPaths = ['/admin', '/profile', '/community', '/tools/hero-exp'];
        const isExcluded = excludedPaths.some(path =>
          item.url.includes(path + '/') || item.url.endsWith(path)
        );

        if (isExcluded) {
          return undefined;
        }

        item.lastmod = new Date().toISOString();
        return item;
      }
    })
  ],
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    // Kennung dieses Builds. Der Client vergleicht sie mit /version.json und
    // weist auf eine neue Fassung hin, wenn jemand die Seite lange offen hat.
    // Auf Cloudflare Pages liefert CF_PAGES_COMMIT_SHA den Commit; lokal bleibt
    // es 'dev', damit beim Entwickeln kein Fehlalarm entsteht.
    define: {
      __BUILD_ID__: JSON.stringify(process.env.CF_PAGES_COMMIT_SHA || 'dev'),
    },
    build: {
      cssCodeSplit: true,
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // Separate vendor chunks for better caching
            if (id.includes('node_modules')) {
              if (id.includes('preact')) {
                return 'vendor-preact';
              }
              // Chart.js braucht ein eigenes Bündel. Landet es im gemeinsamen
              // 'vendor', zieht der erste statische Import daraus die ganzen
              // 200 KB auf jede Seite — obwohl die Diagramme nur im
              // Admin-Panel vorkommen und dort erst nachgeladen werden.
              if (id.includes('node_modules/chart.js')) {
                return 'vendor-chartjs';
              }
              return 'vendor';
            }
          }
        }
      }
    },
    esbuild: {
      drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : []
    }
  }
});
