import { registerFleet } from './operations/fleet.js';
import { registerPeople } from './operations/people.js';
import { registerDriver } from './operations/driver.js';
import { registerReports } from './operations/reports.js';
import { registerAnalytics } from './operations/analytics.js';

/** All operations endpoints are protected on the server, independently of the UI. */
export function registerOperations(app, context) {
  const { requireAuth, allowRoles } = context;
  const bind = (roles) => (method, path, handler) => {
    app[method](`/api${path}`, requireAuth, allowRoles(...roles), (req, res, next) => {
      Promise.resolve().then(() => handler(req, res)).catch(next);
    });
  };
  const ctx = { ...context, admin: bind(['admin']), staff: bind(['admin', 'manager']), crew: bind(['admin', 'manager', 'driver']) };
  registerFleet(ctx);
  registerPeople(ctx);
  registerDriver(ctx);
  registerReports(ctx);
  registerAnalytics(ctx);
}
