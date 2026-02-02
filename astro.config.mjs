import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://wild-hoggs.com',
  i18n: {
    defaultLocale: 'de',
    locales: ['de', 'en'],
    routing: {
      prefixDefaultLocale: false
    }
  },
  integrations: [
    preact(),
    sitemap({
      i18n: {
        defaultLocale: 'de',
        locales: {
          de: 'de',
          en: 'en'
        }
      }
    })
  ]
});
