# SmartBus API contract

Runtime contract for the current React/Vite + Express implementation. JSON uses camelCase, `/api` prefix, resource objects/arrays on success, errors `{ message }`; timestamps are ISO UTC and money is integer VND. Auth uses an HttpOnly `smartbus_session` cookie with `credentials: include`. Roles are `admin`, `manager`, `driver`, `passenger`. Root entrypoints are `src/main.jsx`, `src/App.jsx`, `src/router.jsx`; backend entrypoint is `server/index.js`.

## Shared server interface

`createDatabase(path)` in `server/db.js` is async. It returns a PostgreSQL-compatible adapter backed by persistent PGlite by default or `pg.Pool` when `DATABASE_URL` is set, and applies `server/schema.sql`. `seedDatabase(db,{historyDays})` is idempotent and runs on demo startup. `createApp({db,demoMode})` in `server/app.js` builds Express and registers auth/core/operations endpoints. `requireAuth(req,res,next)` attaches safe `req.user`; use `requireAuth` and `allowRoles(...)` explicitly. Transactions serialize critical inventory/payment paths. SQL identifiers that contain camelCase must be quoted. Input is parameterized and validated; mutations use an Origin allowlist, body size limit and auth rate limit. Passwords use scrypt and session tokens are stored hashed. Demo accounts (password `SmartBus@123`): `admin@smartbus.demo`, `manager@smartbus.demo`, `driver@smartbus.demo`, `passenger@smartbus.demo`.

## Database tables (core agent owns all schema)

- users(id,name,email,passwordHash,role,phone,discountType,discountStatus,discountEvidence,active,createdAt)
- sessions(tokenHash,userId,expiresAt)
- stops(id,name,address,lat,lng)
- routes(id,code,name,origin,destination,distanceKm,price,durationMinutes,active)
- route_stops(routeId,stopId,stopOrder)
- buses(id,code,type,plate,name,seatCount,status)
- trips(id,routeId,busId,driverId,departureTime,arrivalTime,status,lat,lng,locationUpdatedAt,locationSource)
- tickets(id,userId,tripId,seat,status,price,code,holdExpiresAt,paymentMethod,refundStatus,createdAt,paidAt,voucherId)
- payments(id,ticketId,userId,amount,method,status,reference,createdAt)
- refunds(id,ticketId,amount,status,createdAt)
- monthly_passes(id,code,userId,routeId,startDate,endDate,price,status,bookingId,createdAt)
- vouchers(id,code,name,description,type,value,minAmount,maxDiscount,startsAt,expiresAt,usageLimit,perUserLimit,usedCount,active)
- seat_holds, assignments, voucher_usages, discount_profiles, ticket_scans, vehicle_locations
- invoices, complaints, demand_forecasts
- incidents(id,tripId,driverId,type,description,createdAt)
- feedback(id,userId,tripId,rating,message,response,status,createdAt)
- notifications(id,userId,tripId,title,message,read,dedupeKey,createdAt)
- audit_logs(id,userId,action,entity,entityId,details,createdAt)
- outbox(id,userId,ticketId,recipient,subject,body,status,createdAt)

Statuses: tickets `held|paid|checked_in|cancelled|expired`; trips `scheduled|running|completed|cancelled`; buses `active|maintenance|inactive`; discount `none|pending|approved|rejected`; refunds `requested|processing|completed|rejected|failed`; passes `active|expired`; payments `paid|failed|cancelled|refunded`; feedback/complaints have their own workflow statuses. Partial unique index reserves each active (tripId,seat); scan/refund/idempotency have additional unique constraints. Demo seed includes 60 days of history and does not duplicate on restart.

## Core backend + passenger UI

- GET /health => {ok,demoMode}; GET /config => {demoMode,paymentMode:'demo'|'disabled',refundPolicy:'...'}
- POST /auth/register {name,email,password,phone?} => {user}; POST /auth/login {email,password} => {user}; GET /auth/me => {user}; POST /auth/logout => {ok}
- GET /routes => routes; GET /stops => stops
- GET /trips?origin=&destination=&date=YYYY-MM-DD&time=HH:mm&routeId= => joined trips `{id,routeId,routeName,routeCode,origin,destination,price,busId,plate,seatCount,driverId,driverName,departureTime,arrivalTime,status,availableSeats,lat,lng,locationUpdatedAt,locationSource}`
- GET /trips/:id => joined trip plus `seats:[{seat,status:'available'|'held'|'paid'|'checked_in'}]`, `stops:[{id,name,lat,lng,stopOrder}]`
- POST /holds {tripId,seat,voucherCode?} => joined ticket held for 10 minutes. POST /holds/:id/release => {ok}. POST /payments {ticketId,method:'momo'|'vnpay'|'zalopay'|'bank',outcome:'success'|'failed'|'cancelled',idempotencyKey?} => {ticket,message}; demo only, no real money. Successful repeats are idempotent; failed/cancelled attempts release the hold.
- GET /tickets => joined own tickets, each `{id,tripId,routeId,routeName,origin,destination,seat,status,price,code,holdExpiresAt,departureTime,arrivalTime,plate,refundStatus,paymentMethod,createdAt}`
- GET /tickets/:id/qr => `{dataUrl,code}` for an own paid/check-in ticket. GET /tickets/:id/invoice => authenticated PDF download. POST /tickets/:id/email => demo outbox.
- POST /tickets/:id/cancel => ticket + `requested` refund before departure; manager processes refund state transitions. POST /tickets/:id/change {tripId,seat} => same route/price, future trip, new code, atomic inventory update.
- GET /passes => own passes joined routeName; POST `/passes` and `/passes/:id/renew` create sandbox payment and invoice; purchase/renew requests accept idempotencyKey.
- POST /profile/discount {discountType:'student'|'senior',discountEvidence} => {user}
- GET /notifications => own; POST /notifications/:id/read => {ok}
- GET /feedback => own; POST /feedback {tripId,rating,message} => feedback (own paid or checked-in trip only)
- GET/POST `/complaints` => own complaint list/create

## Operations backend + root operations UI

- GET /admin/overview => `{stats:{revenue,tickets,occupancy,trips},daily:[{date,revenue,tickets}],byRoute:[{routeId,routeName,revenue,tickets,occupancy}],recentTickets:[],incidents:[]}`. GET /admin/reports?from=&to=&routeId= same aggregates. GET /admin/reports/export?format=xlsx|pdf&from=&to=&routeId= download. Aggregate actual payment net refunds; occupancy over inventory.
- GET /admin/routes => routes with stops:[stop IDs]; POST /admin/routes {code,name,origin,destination,price,durationMinutes,stopIds:[]} => route; PATCH /admin/routes/:id same => route; DELETE /admin/routes/:id soft deactivate => {ok}
- GET /admin/stops => stops; POST /admin/stops {name,address,lat,lng}; PATCH /admin/stops/:id; DELETE /admin/stops/:id reject referenced.
- GET /admin/buses => buses; POST /admin/buses {plate,name,seatCount,status}; PATCH /admin/buses/:id. Capacity/vehicle changes on existing reservations rejected.
- GET /admin/trips => joined trips; POST /admin/trips {routeId,busId,driverId,departureTime}; POST /admin/schedules {routeId,busId,driverId,startDate,endDate,firstDeparture:'HH:mm',lastDeparture:'HH:mm',frequencyMinutes} => {created}; PATCH /admin/trips/:id {busId?,driverId?,departureTime?,status?}; validate overlaps for bus+driver, not just same departure. Cancellation releases holds + refunds paid + notification. Backend handles assigned trip lifecycle.
- GET /admin/users => safe users (admin/manager view); POST /admin/users {name,email,password,role,phone?} admin only; PATCH /admin/users/:id {role?,active?} admin only, prevent self demotion/last admin disabled.
- GET /admin/discounts => pending or all requests; PATCH /admin/discounts/:id {discountStatus:'approved'|'rejected'} => user
- GET /admin/vouchers => vouchers; POST /admin/vouchers {code,percent,maxDiscount,expiresAt,usageLimit,active}; PATCH /admin/vouchers/:id same
- GET /admin/feedback => joined feedback; PATCH /admin/feedback/:id {response,status:'resolved'}
- GET /admin/audit?from=&to=&action=&entity=&userId=&search= => joined/filterable logs, admin only
- GET `/admin/refunds`; PATCH `/admin/refunds/:id` => audited refund transitions
- GET `/admin/complaints`; PATCH `/admin/complaints/:id` => manager response/status
- GET /driver/trips => assigned joined trips driver, all for admin/manager
- POST /driver/scan {code,tripId} => `{ticket,message}`; only paid ticket assigned trip and matching tripId, QR can use raw code; reject reuse.
- POST /driver/trips/:id/location {lat,lng} => {ok}; assigned only; update source 'gps'. Notify paid passengers near next stops using distance, dedupe.
- POST /driver/trips/:id/status {status:'running'|'completed'} => trip; assigned only, legal transition.
- POST /driver/incidents {tripId,type,description} => incident; assigned only, notify passengers.

## Analytics

Admin/manager endpoints: `/admin/analytics/passenger-density`, `/peak-hours`, `/route-demand`, `/occupancy-trends`, POST `/forecast`, GET `/forecasts`, `/recommendations`, `/export?type=analytics|occupancy|forecast&format=xlsx|pdf`. Forecast uses weighted moving average over historical trips for the same route/hour; low sample counts return low confidence and backtest may be null. Recommendations never mutate schedules or prices.

## Shared frontend interface

`src/lib/api.js`: `api(path,options={})` fetches `/api` + path JSON and throws Error; accepts `{method,body}`; `download(path,filename)` gets an authenticated blob; exports `money(n)`, `dateTime(value)`, `statusLabel(status)`.
`src/context/AuthContext.jsx`: `useAuth()` => `{user,loading,login(email,password),register(form),logout(),refresh()}`.
Passenger files export defaults: SearchPage.jsx (/), BookingPage.jsx (/booking/:tripId), TicketsPage.jsx (/tickets), TrackingPage.jsx (/tracking), PassesPage.jsx (/passes), SupportPage.jsx (/support). Pages render inside root shell; do not add Navbar. UI shared CSS classes root provides: page-heading, eyebrow, muted, grid, grid-2, grid-3, card, panel, btn, btn-primary, btn-secondary, btn-danger, form-grid, field, input, badge, alert, alert-error, alert-success, table-wrap, data-table, empty-state, stack, row, spread, stat-card, page-section. Forms labels and error states, disable pending; use links to /login when no auth. Add own passenger.css for specialized components if necessary. No global CSS reset or shared-file edits by agents.
