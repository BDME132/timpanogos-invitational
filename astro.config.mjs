// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Update this to your actual Vercel URL once deployed
  site: 'https://timpanogos-invitational.vercel.app',
  trailingSlash: 'ignore',
  output: 'static',
  build: {
    assets: 'assets',
  },
});
