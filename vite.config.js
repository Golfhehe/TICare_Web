import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Dev only: serve api/<name>.js like Vercel does (res.status/res.json, parsed JSON body).
 * Loads ALL env vars (incl. non-VITE_ ones such as GEMINI_API_KEY) into process.env for the handlers only;
 * they are never exposed to the client bundle.
 */
function devApi() {
  return {
    name: 'ticare-dev-api',
    apply: 'serve',
    configResolved(config) {
      const env = loadEnv(config.mode, process.cwd(), '');
      for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v;
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const m = /^\/api\/([a-z-]+)(?:\?.*)?$/.exec(req.url || '');
        if (!m) return next();
        res.status = code => { res.statusCode = code; return res; };
        res.json = obj => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)); return res; };
        try {
          const chunks = [];
          let size = 0;
          for await (const c of req) {
            size += c.length;
            if (size > 100 * 1024) return res.status(413).json({ error: 'Nội dung gửi lên quá lớn.' });
            chunks.push(c);
          }
          const raw = Buffer.concat(chunks).toString('utf8');
          if (raw && /json/i.test(req.headers['content-type'] || '')) { try { req.body = JSON.parse(raw); } catch { req.body = undefined; } }
          else req.body = raw || undefined;
          const mod = await server.ssrLoadModule('/api/' + m[1] + '.js');
          await mod.default(req, res);
        } catch (e) {
          server.config.logger.error('[devApi] ' + (e && e.stack || e));
          if (!res.headersSent) res.status(500).json({ error: 'Lỗi máy chủ dev.' });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: 'src/test/setup.js',
    include: ['src/**/*.test.{js,jsx}', 'api/**/*.test.js'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules[/\\](react|react-dom|scheduler)[/\\]/.test(id)) return 'react-vendor';
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('lucide-react')) return 'icons';
          return undefined;
        },
      },
    },
  },
});
