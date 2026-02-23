import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://wild-hoggs.com',
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
        // SEO: Exclude placeholder pages from sitemap
        const placeholderPages = ['/events', '/guides'];
        const isPlaceholder = placeholderPages.some(page =>
          item.url.includes(page + '/') || item.url.endsWith(page)
        );

        if (isPlaceholder) {
          return undefined; // Excludes URL from sitemap
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
