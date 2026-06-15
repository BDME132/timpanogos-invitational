// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.timpinvite.com',
  trailingSlash: 'ignore',
  output: 'static',
  integrations: [sitemap()],
  build: {
    assets: 'assets',
  },
});
