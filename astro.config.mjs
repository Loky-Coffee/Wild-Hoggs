import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  adapter: cloudflare({
    mode: 'static'
  }),
  site: 'https://wild-hoggs.com'
});
