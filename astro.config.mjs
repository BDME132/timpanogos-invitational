// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://bdme132.github.io',
  base: '/timpanogos-invitational',
  trailingSlash: 'ignore',
  output: 'static',
  build: {
    assets: 'assets',
  },
});
