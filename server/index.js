import { createApp } from './app.js';
import { startGpsSimulator } from './gpsSimulator.js';

const port = Number(process.env.PORT || 3001);
const app = await createApp();
const stopSimulator = app.locals.demoMode ? startGpsSimulator(app.locals.db) : () => {};
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`SmartBus API đang chạy tại http://localhost:${port}/api/health`);
  console.log(`Database: ${app.locals.db.dialect}/${app.locals.db.storageMode || 'default'}`);
});
async function shutdown() {
  stopSimulator();
  server.close(async () => {
    if (app.locals.ownsDb) await app.locals.db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);