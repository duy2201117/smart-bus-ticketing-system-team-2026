# Ma trận nghiệm thu SmartBus - FINAL

Tiêu chí `COMPLETE`: có implementation thực sự theo phạm vi đề; với dịch vụ bên thứ ba không có credential, sử dụng Sandbox/Development adapter như yêu cầu cho phép. Mỗi mục được đối chiếu UI + Backend/API + DB + RBAC/validation + test/coverage phù hợp.

| # | Requirement | Frontend | Backend/API | Database | Verification | Status |
|---:|---|---|---|---|---|---|
| 1 | Auth/register/login/logout/profile/forgot-reset/session | Có | Cookie session + reset token | users/sessions/password_resets | integration | COMPLETE |
| 2 | Protected routes + RBAC 4 roles | Có guards | middleware + owner checks | users.role/active | 403 assertions | COMPLETE |
| 3 | Admin user/role/lock/unlock | Có | last-admin/self-lock/session revoke | users/sessions/audit | integration | COMPLETE |
| 4 | Search origin/destination/date/time | Có | DB filters timezone VN | routes/trips | integration | COMPLETE |
| 5 | Seat AVAILABLE/SELECTED/HELD/SOLD | SeatGrid + selected | live availability states | seats/tickets | held→paid→expiry assertions + UI coverage | COMPLETE |
| 6 | Hold 10 phút/refresh/auto release/race | Countdown expiresAt | transaction + expiry cleanup | seat_holds/tickets | TTL + competing users | COMPLETE |
| 7 | Booking/server price/discount/voucher | Checkout | server calculation/locks | bookings/vouchers/usages | race/limits | COMPLETE |
| 8 | MoMo/VNPay/ZaloPay/Card sandbox + callback | 4 methods/status UX | HMAC signed webhook, idempotency, four providers | payments | gateway unit + callback/replay/bad signature | COMPLETE |
| 9 | QR ticket/My Tickets/invoice PDF | Có | QR/PDF owner-protected | tickets/invoices | PNG/PDF assertions | COMPLETE |
| 10 | QR scanner camera/manual/validation/replay/history | ZXing camera + manual fallback | assigned trip/date/status/used validation | ticket_scans | API scan/replay + Playwright camera path | COMPLETE |
| 11 | Cancel/change transaction/edge cases | Modal/forms | atomic validation/rollback | ticket_changes/tickets | same/wrong route rollback | COMPLETE |
| 12 | Refund automatic/history/double refund | Status/UI | sandbox provider refund + transition guard | refunds/payments | automatic completed + duplicate block | COMPLETE |
| 13 | GPS realtime/map/ETA | Leaflet + polling + ETA | browser GPS endpoint + simulator + ETA | trips/vehicle_locations | simulator/ETA unit+integration | COMPLETE |
| 14 | Stop notifications READ/UNREAD | Notification center | proximity + dedupe | notifications | integration | COMPLETE |
| 15 | Driver incidents | Form | assigned validation + fanout | incidents/notifications | integration | COMPLETE |
| 16 | Route CRUD + distance/duration/fare/status | Manager editor | CRUD/validation | routes/route_stops | integration | COMPLETE |
| 17 | Stop CRUD + coordinate/order | Manager editor | CRUD/reference guard | stops/route_stops | integration | COMPLETE |
| 18 | Bus CRUD + seat config/status | Manager editor | seat generation/conflict guard | buses/seats | integration | COMPLETE |
| 19 | Fare/schedule/frequency/status | Manager UI | generation + validation | routes/schedules/trips/fare_versions | integration | COMPLETE |
| 20 | Bus/driver assignment + conflicts | Manager UI | overlap/maintenance checks | assignments/trips | integration | COMPLETE |
| 21 | Monthly pass purchase/view/renew | Có | sandbox payment/idempotency | monthly_passes/bookings/payments | integration | COMPLETE |
| 22 | Discount profile upload/approve/reject | File + text + status/reason | private upload + RBAC + review | discount_profiles/private_files | owner/manager/forbidden assertions | COMPLETE |
| 23 | Voucher CRUD + conditions/race | Có | time/min/max/usage/per-user locks | vouchers/usages | integration race | COMPLETE |
| 24 | Review 1-5 eligibility | Có | ticket ownership + duplicate guard | feedback | integration | COMPLETE |
| 25 | Complaint + manager response | Có | owner/staff endpoints | complaints | integration | COMPLETE |
| 26 | Revenue dashboard/filter | KPI/charts/filter | net payment-refund query | payments/refunds | integration | COMPLETE |
| 27 | Occupancy | chart/progress | sold/capacity aggregation | tickets/buses/trips | 0..100 assertions | COMPLETE |
| 28 | Excel/PDF exports | Download UI | ExcelJS/PDFKit | source DB + audit | file headers/magic | COMPLETE |
| 29 | Audit log/filter | Admin UI | major action logging/filter | audit_logs | integration | COMPLETE |
| 30 | Passenger analytics/heatmap | Recharts/heatmap | DB aggregates | tickets/trips/routes | API integration | COMPLETE |
| 31 | Peak/low analysis | Ranked UI | dynamic ranking | history data | API assertions | COMPLETE |
| 32 | Demand forecast/confidence/levels | Forecast form/result | weighted moving average | demand_forecasts | integration | COMPLETE |
| 33 | Backtest MAE/MAPE | Metrics UI | rolling holdout; no fake accuracy | forecast metrics | deterministic unit test | COMPLETE |
| 34 | AI recommendations | Cards/disclaimer | occupancy threshold rules only | route/trip facts | API assertions | COMPLETE |
| 35 | Analytics backend APIs | No fake frontend series | density/peak/demand/occupancy/forecast/recommendation/export | real SQL | integration | COMPLETE |
| 36 | DB schema PK/FK/index/constraint | N/A | idempotent schema init | all required entities | fresh PGlite integration | COMPLETE |
| 37 | Seed 60 days/diverse/4+ buses+drivers | Demo-ready | idempotent seed | historical trips/bookings/tickets | dedicated 60-day seed test | COMPLETE |
| 38 | Vietnamese UX + responsive states | Loading/error/empty/confirm/toast-like alerts + CSS | VN errors | N/A | Playwright viewport suite 1920→390 | COMPLETE |
| 39 | Security/race/validation | safe UI | parameterized SQL, Origin gate, Helmet, RBAC, server totals, idempotency | constraints | security/race assertions | COMPLETE |
| 40 | Demo flows all roles | Passenger/Driver/Manager/Admin pages | all role APIs | seeded data | Playwright role suite + integration APIs | COMPLETE |
| 41 | Deployment/sandbox readiness | clear demo labels | sandbox adapters, PostgreSQL option, env config, no fake success when DEMO_MODE=false | PGlite/PostgreSQL | config/docs/runbook | COMPLETE |

**FINAL: 41 COMPLETE / 0 PARTIAL / 0 MISSING.**
