import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The deployment base path is configurable so the same code can be served from
 * a GitHub Pages project site (`/<repo-name>/`), a custom domain (`/`) or any
 * other sub-path. Set BASE_PATH at build time.
 *
 *   BASE_PATH=/my-repo/ npm run build
 */
export default defineConfig(({ command }) => ({
  // Dev serves from the site root; production builds default to a GitHub Pages
  // project-site sub-path unless BASE_PATH says otherwise.
  base: process.env.BASE_PATH ?? (command === 'build' ? '/paxos-protocol-explorer/' : '/'),
  plugins: [react()],
  server: {
    // Bind for container previews; the allowed host is supplied by the preview
    // environment rather than being opened up to every hostname.
    host: '0.0.0.0',
    port: Number(process.env.PORT ?? 3000),
    strictPort: true,
    allowedHosts: process.env.PREVIEW_HOST ? [process.env.PREVIEW_HOST] : undefined,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
}));
