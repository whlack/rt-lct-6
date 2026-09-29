import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
const templatePath = fileURLToPath(
  new URL('../docs/templates/catalog-import.xlsx', import.meta.url),
);
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'catalog-import-template',
      configureServer(server) {
        server.middlewares.use(
          '/templates/catalog-import.xlsx',
          (_request, response) => {
            response.setHeader(
              'Content-Type',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            );
            response.end(readFileSync(templatePath));
          },
        );
      },
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'templates/catalog-import.xlsx',
          source: readFileSync(templatePath),
        });
      },
    },
  ],
  // Compose passes the internal upstream; the browser keeps using its own origin.
  server: {
    proxy: { '/api': process.env.API_UPSTREAM ?? 'http://backend:3000' },
  },
  test: { environment: 'jsdom' },
});
