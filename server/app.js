import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createDatabase } from './db.js';
import { seedDatabase } from './seed.js';
import { installAuth } from './security.js';
import { registerCore } from './core.js';
import { registerOperations } from './operations.js';

export async function createApp({ db: providedDb, demoMode = process.env.DEMO_MODE !== 'false' } = {}) {
  const db = providedDb || await createDatabase();
  if (demoMode && !providedDb) await seedDatabase(db);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(express.json({ limit: '3mb', strict: true }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    const origin = req.get('Origin');
    const fetchSite = req.get('Sec-Fetch-Site');
    if (fetchSite === 'cross-site') return res.status(403).json({ message: 'Yêu cầu không cùng nguồn bị từ chối.' });
    if (origin) {
      try {
        const originUrl = new URL(origin);
        const allowed = (process.env.SMARTBUS_ORIGIN || '').split(',').map(value => value.trim()).filter(Boolean);
        const devPort = Number(originUrl.port || 80);
        const developmentOrigin = process.env.NODE_ENV !== 'production' && originUrl.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(originUrl.hostname) && [5173, 5174, 5175].includes(devPort);
        if (origin !== `${req.protocol}://${req.get('host')}` && !developmentOrigin && !allowed.includes(origin)) return res.status(403).json({ message: 'Nguồn yêu cầu không được cho phép.' });
      } catch { return res.status(403).json({ message: 'Nguồn yêu cầu không hợp lệ.' }); }
    }
    next();
  });
  const auth = installAuth(app, { db, demoMode });
  registerCore(app, { db, ...auth, demoMode });
  registerOperations(app, { db, ...auth, audit: (...args) => args, fail: (status, message) => { throw Object.assign(new Error(message), { status }); } });
  app.use((error, _req, res, _next) => {
    const status = Number(error.status) || 500;
    if (status >= 500) console.error('SmartBus API error:', error.message);
    if (res.headersSent) return res.end();
    res.status(status).json({ message: status >= 500 ? 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.' : error.message });
  });
  app.locals.db = db;
  app.locals.ownsDb = !providedDb;
  app.locals.demoMode = demoMode;
  return app;
}