import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

/*
 * Files in `public/` keep their names from one deploy to the next, unlike the
 * hashed bundle under `/assets/`, which Nitro already marks immutable. So they
 * are kept for a day and refreshed in the background after that. `sw.js` is
 * left alone: the browser checks it for updates itself, past any cache.
 */
const PUBLIC_FILE_CACHE = {
  headers: {
    'cache-control': 'public, max-age=86400, stale-while-revalidate=604800',
  },
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  // Astryx declares every colour with CSS `light-dark()`, and the theme toggle
  // switches them by setting `color-scheme` on the root element at runtime.
  // Without a target that supports `light-dark()` natively, the CSS minifier
  // rewrites it into a `prefers-color-scheme` polyfill, which only the OS can
  // move — so the toggle would half-work and the app would come out mixed.
  build: { cssTarget: ['chrome123', 'edge123', 'firefox120', 'safari17.5'] },
  plugins: [
    devtools(),
    nitro({
      routeRules: {
        '/logo.svg': PUBLIC_FILE_CACHE,
        '/logo.png': PUBLIC_FILE_CACHE,
        '/icons/**': PUBLIC_FILE_CACHE,
        '/manifest.webmanifest': PUBLIC_FILE_CACHE,
      },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
