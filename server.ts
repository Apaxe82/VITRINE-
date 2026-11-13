import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { createWebApp } from './apps/web/src/app.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer(): Promise<void> {
  const app = createWebApp();
  const PORT = Number(process.env.PORT) || 3000;
  // Treat the environment as production unless NODE_ENV === 'development'
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // Dynamically import Vite only in development so production has no Vite runtime dependency
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Resolve built client assets whether running from repo root or bundled dist/server.js
    const distPath =
      path.basename(__dirname) === 'dist' ? __dirname : path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Vitrine] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Vitrine server:', err);
  process.exit(1);
});
