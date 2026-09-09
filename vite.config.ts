import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  // Astryx declares every colour with CSS `light-dark()`, and the theme toggle
  // switches them by setting `color-scheme` on the root element at runtime.
  // Without a target that supports `light-dark()` natively, the CSS minifier
  // rewrites it into a `prefers-color-scheme` polyfill, which only the OS can
  // move — so the toggle would half-work and the app would come out mixed.
  build: { cssTarget: ['chrome123', 'edge123', 'firefox120', 'safari17.5'] },
  plugins: [devtools(), nitro(), tailwindcss(), tanstackStart(), viteReact()],
})

export default config
