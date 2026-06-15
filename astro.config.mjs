// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.timpinvite.com',
  trailingSlash: 'ignore',
  output: 'static',
  build: {
    assets: 'assets',
  },
});
