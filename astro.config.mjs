// @ts-check
import { defineConfig } from 'astro/config';

// The repo is `maraterrywedding.github.io` under the account of the same name,
// so the site is served from the root and `base` stays '/'. Should it ever move
// to a differently-named repo, set PUBLIC_BASE=/repo-name — every link is built
// through src/lib/paths.ts, which picks that up automatically.
const base = process.env.PUBLIC_BASE || '/';

export default defineConfig({
  site: process.env.PUBLIC_SITE || 'https://maraterrywedding.github.io',
  base,
  trailingSlash: 'ignore',
  output: 'static',
  build: {
    // Emit `/schedule/index.html` so URLs stay clean without a server rewrite.
    format: 'directory',
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'de', 'pt'],
    routing: {
      // English lives at the root: `/`, `/de/`, `/pt/`.
      prefixDefaultLocale: false,
    },
  },
  image: {
    // Guests are overwhelmingly on phones; these are the widths we actually serve.
    responsiveStyles: true,
  },
  devToolbar: { enabled: false },
});
