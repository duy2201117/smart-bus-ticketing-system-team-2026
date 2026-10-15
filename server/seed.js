import { hashPassword } from './security.js';
import { nowISO, notify } from './domain.js';

function haversineKm(first, second) {
  const radians = degrees => degrees * Math.PI / 180;
  const dLat = radians(Number(second.lat) - Number(first.lat));
  const dLng = radians(Number(second.lng) - Number(first.lng));
  const lat1 = radians(Number(first.lat)), lat2 = radians(Number(second.lat));
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function backfillSeedRouteDistances(db) {
  const routes = (await db.query('SELECT id FROM routes WHERE "distanceKm"=0')).rows;
  for (const route of routes) {
    const stops = (await db.query('SELECT s.lat,s.lng FROM route_stops rs JOIN stops s ON s.id=rs."stopId" WHERE rs."routeId"=$1 ORDER BY rs."stopOrder"', [route.id])).rows;
    const distance = stops.slice(1).reduce((sum, stop, index) => sum + haversineKm(stops[index], stop), 0);
    if (distance > 0) await db.query('UPDATE routes SET "distanceKm"=$1 WHERE id=$2 AND "distanceKm"=0', [Math.round(distance * 10) / 10, route.id]);
  }
}

async function seedHistory(db, historyDays) {
  const marker = (await db.query("SELECT value FROM schema_meta WHERE key='demo_history_v2'")).rows[0];
  if (marker) return;
  const days = Math.max(0, Math.min(82, Number(historyDays) || 0));
  await db.transaction(async tx => {
    const routes = (await tx.query('SELECT * FROM routes WHERE active=1 ORDER BY code')).rows;
    const buses = (await tx.query('SELECT * FROM buses ORDER BY id')).rows;
    const drivers = (await tx.query("SELECT id FROM users WHERE role='driver' AND active=1 ORDER BY id")).rows;
    const passengerId = 'user_passenger', managerId = 'user_manager';
    const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    for (let offset = days + 7; offset >= 8; offset--) {
      const dayOffset = -offset;
      const departureDate = new Date(Date.parse(`${today}T00:00:00+07:00`) + dayOffset * 86400000);
      const serviceDate = new Date(`${departureDate.toISOString().slice(0, 10)}T12:00:00+07:00`);
      const isWeekday = serviceDate.getUTCDay() !== 0 && serviceDate.getUTCDay() !== 6;
      const date = serviceDate.toISOString().slice(0, 10);
      for (let routeIndex = 0; routeIndex < routes.length; routeIndex++) {
        const route = routes[routeIndex], bus = buses[routeIndex % buses.length], driver = drivers[routeIndex % drivers.length];
        if (!bus || !driver) continue;
        const firstStop = (await tx.query('SELECT s.lat,s.lng FROM route_stops rs JOIN stops s ON s.id=rs."stopId" WHERE rs."routeId"=$1 ORDER BY rs."stopOrder" LIMIT 1', [route.id])).rows[0];
        if (!firstStop) continue;
        for (const hour of [8, 12, 18]) {
          const tripId = `trip_history_${date}_${route.code}_${hour}`;
          const localDeparture = new Date(Date.parse(`${date}T00:00:00+07:00`) + hour * 3600000);
          const departure = localDeparture.toISOString();
          const arrival = new Date(localDeparture.getTime() + Number(route.durationMinutes) * 60000).toISOString();
          const inserted = await tx.query('INSERT INTO trips(id,"routeId","busId","driverId","departureTime","arrivalTime",status,lat,lng,"locationUpdatedAt","locationSource") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(id) DO NOTHING RETURNING id', [tripId, route.id, bus.id, driver.id, departure, arrival, 'completed', firstStop.lat, firstStop.lng, arrival, 'simulation']);
          if (!inserted.rows.length) continue;
          await tx.query('INSERT INTO assignments(id,"tripId","busId","driverId","createdAt") VALUES($1,$2,$3,$4,$5) ON CONFLICT("tripId") DO NOTHING', [`assignment_${tripId}`, tripId, bus.id, driver.id, departure]);
          const peak = hour === 8 || hour === 18;
          const load = routeIndex === 0 ? peak ? 0.94 : 0.78 : routeIndex === 1 ? peak ? 0.18 : 0.05 : peak ? (isWeekday ? 0.36 : 0.25) : (isWeekday ? 0.08 : 0.04);
          const passengerCount = Math.max(1, Math.min(Number(bus.seatCount), Math.floor(Number(bus.seatCount) * load)));
          const createdAt = new Date(localDeparture.getTime() - 86400000).toISOString();
          for (let seat = 1; seat <= passengerCount; seat++) {
            const bookingId = `history_booking_${tripId}_${seat}`;
            const ticketId = `history_ticket_${tripId}_${seat}`;
            const paymentId = `history_payment_${tripId}_${seat}`;
            const code = `SB-HIST-${date.replaceAll('-', '')}-${route.code}-${hour}-${seat}`;
            const userId = seat % 2 ? passengerId : managerId;
            await tx.query('INSERT INTO bookings(id,"userId",status,total,subtotal,"createdAt") VALUES($1,$2,$3,$4,$4,$5) ON CONFLICT(id) DO NOTHING', [bookingId, userId, 'paid', route.price, createdAt]);
            await tx.query('INSERT INTO tickets(id,"userId","tripId","bookingId",seat,status,price,"basePrice",code,"paymentMethod","createdAt","paidAt") VALUES($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,$10) ON CONFLICT(id) DO NOTHING', [ticketId, userId, tripId, bookingId, seat, 'checked_in', route.price, code, 'momo', createdAt]);
            await tx.query('INSERT INTO payments(id,"ticketId","bookingId","userId",amount,method,status,reference,"createdAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(reference) DO NOTHING', [paymentId, ticketId, bookingId, userId, route.price, 'momo', 'paid', `HISTORY-${tripId}-${seat}`, createdAt]);
            await tx.query('INSERT INTO invoices(id,"ticketId","paymentId",number,amount,subtotal,"createdAt") VALUES($1,$2,$3,$4,$5,$5,$6) ON CONFLICT("ticketId") DO NOTHING', [`history_invoice_${tripId}_${seat}`, ticketId, paymentId, `HD-HIST-${date.replaceAll('-', '')}-${route.code}-${hour}-${seat}`, route.price, createdAt]);
          }
        }
      }
    }

    await tx.query('UPDATE users SET "discountType"=$1,"discountStatus"=$2,"discountEvidence"=$3 WHERE id=$4', ['student', 'approved', 'Thẻ sinh viên mẫu đã xác minh', passengerId]);
    await tx.query('INSERT INTO discount_profiles(id,"userId","discountType","discountEvidence",status,"reviewedBy","reviewedAt","reviewReason","createdAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING', ['discount_demo_passenger', passengerId, 'student', 'Thẻ sinh viên mẫu đã xác minh', 'approved', 'user_manager', nowISO(), 'Hồ sơ demo đã xác minh', nowISO()]);
    const route = routes.find(item => item.code === 'HN01') || routes[0];
    if (route) {
      await tx.query('INSERT INTO monthly_passes(id,code,"userId","routeId","startDate","endDate",price,status,"createdAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING', ['pass_demo_passenger', 'MV-DEMO-PASSENGER', passengerId, route.id, new Date(Date.now() - 7 * 86400000).toISOString(), new Date(Date.now() + 23 * 86400000).toISOString(), Number(route.price) * 18, 'active', nowISO()]);
    }
    const sampleTicket = (await tx.query("SELECT * FROM tickets WHERE \"userId\"=$1 AND status='checked_in' ORDER BY \"createdAt\" LIMIT 1", [passengerId])).rows[0];
    if (sampleTicket) {
      await tx.query('INSERT INTO feedback(id,"userId","tripId",rating,message,status,"createdAt") VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING', ['feedback_demo_passenger', passengerId, sampleTicket.tripId, 5, 'Chuyến xe sạch sẽ, tài xế thân thiện.', 'open', nowISO()]);
      await tx.query('INSERT INTO complaints(id,"userId","tripId",category,content,status,"createdAt","updatedAt") VALUES($1,$2,$3,$4,$5,$6,$7,$7) ON CONFLICT(id) DO NOTHING', ['complaint_demo_passenger', passengerId, sampleTicket.tripId, 'Chất lượng dịch vụ', 'Tôi muốn góp ý về thời gian chờ tại trạm.', 'open', nowISO()]);
      const payment = (await tx.query("SELECT * FROM payments WHERE \"ticketId\"=$1 AND status='paid' LIMIT 1", [sampleTicket.id])).rows[0];
      if (payment && !(await tx.query('SELECT 1 FROM refunds WHERE "ticketId"=$1', [sampleTicket.id])).rows.length) {
        await tx.query('UPDATE tickets SET status=$1,"refundStatus"=$2 WHERE id=$3', ['cancelled', 'completed', sampleTicket.id]);
        await tx.query("UPDATE payments SET status='refunded' WHERE id=$1", [payment.id]);
        await tx.query('INSERT INTO refunds(id,"ticketId","paymentId",amount,status,"createdAt") VALUES($1,$2,$3,$4,$5,$6)', ['refund_demo_passenger', sampleTicket.id, payment.id, sampleTicket.price, 'completed', nowISO()]);
      }
    }
    const incidentTrip = (await tx.query("SELECT id,\"driverId\" FROM trips WHERE status='completed' ORDER BY \"departureTime\" DESC LIMIT 1")).rows[0];
    if (incidentTrip) await tx.query('INSERT INTO incidents(id,"tripId","driverId",type,description,"createdAt") VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING', ['incident_demo_seed', incidentTrip.id, incidentTrip.driverId, 'delay', 'Chuyến xe demo có thời gian chờ kéo dài tại trạm.', nowISO()]);
    const liveTrip = (await tx.query("SELECT id,lat,lng FROM trips WHERE status='running' ORDER BY \"departureTime\" DESC LIMIT 1")).rows[0];
    if (liveTrip) await tx.query('INSERT INTO vehicle_locations(id,"tripId",lat,lng,source,"recordedAt") VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING', ['location_demo_seed', liveTrip.id, liveTrip.lat, liveTrip.lng, 'simulation', nowISO()]);
    await notify(tx, passengerId, 'Thông tin tuyến xe', 'Xe mô phỏng cập nhật vị trí từ backend và thông báo khi đến gần trạm.', liveTrip?.id || null);
    await tx.query("INSERT INTO schema_meta(key,value) VALUES('demo_history_v2',$1) ON CONFLICT(key) DO NOTHING", [String(days)]);
  });
}

export async function seedDatabase(db, { historyDays = 60 } = {}) {
  const marker = (await db.query("SELECT value FROM schema_meta WHERE key='demo_seed_v1'")).rows[0];
  if (marker) { await backfillSeedRouteDistances(db); await seedHistory(db, historyDays); return; }
  const passwordHash = await hashPassword('SmartBus@123');
  const now = new Date();
  const today = new Date(now.getTime()+7*3600000).toISOString().slice(0,10);
  await db.transaction(async tx => {
    const users = [
      ['admin','Nguyễn Minh Anh','admin','0901234001'],['manager','Trần Hoàng Nam','manager','0901234002'],
      ['driver','Lê Văn Hùng','driver','0901234003'],['passenger','Phạm Khánh Linh','passenger','0901234004'],
      ['driver2','Nguyễn Văn Dũng','driver','0901234005'],['driver3','Trần Quang Hải','driver','0901234006'],['driver4','Đỗ Minh Tuấn','driver','0901234007'],
    ];
    for(const [key,name,role,phone] of users) {
      await tx.query('INSERT INTO users(id,name,email,"passwordHash",role,phone,"createdAt") VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING',[`user_${key}`,name,`${key}@smartbus.demo`,passwordHash,role,phone,now.toISOString()]);
      if(role==='driver') await tx.query('INSERT INTO drivers(id,"userId","licenseNumber","createdAt") VALUES($1,$2,$3,$4)',[`driver_${key}`,`user_${key}`,`GPLX-${key.toUpperCase()}`,now.toISOString()]);
    }
    const stops = [
      ['mydinh','Bến xe Mỹ Đình','20 Phạm Hùng, Hà Nội',21.0289,105.7787],
      ['cauthanglong','Cầu Thăng Long','Đông Ngạc, Hà Nội',21.0838,105.7856],
      ['noibai','Sân bay Nội Bài','Phú Minh, Sóc Sơn, Hà Nội',21.2187,105.8042],
      ['socson','Trạm Sóc Sơn','Quốc lộ 3, Sóc Sơn, Hà Nội',21.2563,105.8485],
      ['phoyen','Trạm Phổ Yên','Phường Ba Hàng, Thái Nguyên',21.4148,105.8731],
      ['songcong','Bến xe Sông Công','Thắng Lợi, Sông Công, Thái Nguyên',21.4874,105.8405],
      ['thainguyen','Bến xe Thái Nguyên','Đồng Quang, Thái Nguyên',21.5672,105.8252],
    ];
    for(const [key,name,address,lat,lng] of stops) await tx.query('INSERT INTO stops(id,name,address,lat,lng) VALUES($1,$2,$3,$4,$5)',[`stop_${key}`,name,address,lat,lng]);
    const routeData = [
      ['hn_tn','HN01','Hà Nội → Thái Nguyên','Hà Nội','Thái Nguyên',85000,120,['mydinh','cauthanglong','socson','phoyen','songcong','thainguyen']],
      ['tn_hn','TN01','Thái Nguyên → Hà Nội','Thái Nguyên','Hà Nội',85000,120,['thainguyen','songcong','phoyen','socson','cauthanglong','mydinh']],
      ['hn_sc','HN02','Hà Nội → Sông Công','Hà Nội','Sông Công',70000,100,['mydinh','cauthanglong','socson','phoyen','songcong']],
      ['sc_hn','SC01','Sông Công → Hà Nội','Sông Công','Hà Nội',70000,100,['songcong','phoyen','socson','cauthanglong','mydinh']],
      ['hn_nb','HN03','Hà Nội → Nội Bài','Hà Nội','Nội Bài',45000,55,['mydinh','cauthanglong','noibai']],
      ['nb_hn','NB01','Nội Bài → Hà Nội','Nội Bài','Hà Nội',45000,55,['noibai','cauthanglong','mydinh']],
    ];
    for(const [key,code,name,origin,destination,price,duration,routeStops] of routeData){
      await tx.query('INSERT INTO routes(id,code,name,origin,destination,price,"durationMinutes") VALUES($1,$2,$3,$4,$5,$6,$7)',[`route_${key}`,code,name,origin,destination,price,duration]);
      for(let i=0;i<routeStops.length;i++) await tx.query('INSERT INTO route_stops("routeId","stopId","stopOrder") VALUES($1,$2,$3)',[`route_${key}`,`stop_${routeStops[i]}`,i+1]);
    }
    const busData = [['01','29B-123.45',36,'driver'],['02','20B-456.78',36,'driver2'],['03','29B-678.90',32,'driver3'],['04','29B-246.80',28,'driver4']];
    for(const [key,plate,seats] of busData){
      await tx.query('INSERT INTO buses(id,code,type,plate,name,"seatCount",status) VALUES($1,$2,$3,$4,$5,$6,$7)',[`bus_${key}`,`SB-${key}`,'xe khách',plate,`SmartBus ${seats} chỗ · Điều hòa`,seats,'active']);
      for(let seat=1;seat<=seats;seat++) await tx.query('INSERT INTO seats(id,"busId",number) VALUES($1,$2,$3)',[`seat_${key}_${seat}`,`bus_${key}`,seat]);
    }
    await tx.query('INSERT INTO vouchers(id,code,percent,"maxDiscount","expiresAt","usageLimit",value,"startsAt","minAmount") VALUES($1,$2,$3,$4,$5,$6,$3,$7,$8)', ['voucher_chao','CHAO2026',15,30000,new Date(now.getTime()+180*86400000).toISOString(),500,new Date(now.getTime()-86400000).toISOString(),40000]);
    await tx.query('INSERT INTO vouchers(id,code,percent,"maxDiscount","expiresAt","usageLimit",type,value) VALUES($1,$2,0,0,$3,200,$4,$5)',['voucher_bus','SMARTBUS20',new Date(now.getTime()+180*86400000).toISOString(),'fixed',20000]);
    let sampleCount = 0;
    for(let day=-7;day<=14;day++){
      const date=new Date(new Date(`${today}T00:00:00+07:00`).getTime()+day*86400000);
      for(let bi=0;bi<busData.length;bi++){
        const [busKey,,seatCount,driverKey]=busData[bi];
        for(let round=0;round<6;round++){
          const routeIndex=bi<2 ? ((round+(bi===1?1:0))%2) : bi===2 ? 2+(round%2) : 4+(round%2);
          const route=routeData[routeIndex];
          const departure=new Date(date.getTime()+(6+round*3)*3600000+(bi===1?30:0)*60000);
          const arrival=new Date(departure.getTime()+route[6]*60000);
          const tripId=`trip_${today}_${day}_${busKey}_${round}`;
          const status=arrival<now?'completed':departure<=now?'running':'scheduled';
          const stop=stops.find(s=>s[0]===route[7][0]);
          await tx.query('INSERT INTO trips(id,"routeId","busId","driverId","departureTime","arrivalTime",status,lat,lng,"locationUpdatedAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[tripId,`route_${route[0]}`,`bus_${busKey}`,`user_${driverKey}`,departure.toISOString(),arrival.toISOString(),status,stop[3],stop[4],now.toISOString()]);
          await tx.query('INSERT INTO assignments(id,"tripId","busId","driverId","createdAt") VALUES($1,$2,$3,$4,$5)',[`assignment_${tripId}`,tripId,`bus_${busKey}`,`user_${driverKey}`,now.toISOString()]);
          const samples = day<=0 ? Math.min(seatCount,3+((round+bi+day+7)%7)) : day<=2 ? 2 : 0;
          for(let si=0;si<samples;si++){
            sampleCount++;
            const ticketId=`ticket_demo_${sampleCount}`,bookingId=`booking_demo_${sampleCount}`,paymentId=`payment_demo_${sampleCount}`;
            const createdAt=new Date(departure.getTime()-86400000).toISOString();
            const userId=si===0?'user_passenger':'user_manager';
            await tx.query('INSERT INTO bookings(id,"userId",status,total,"createdAt") VALUES($1,$2,$3,$4,$5)',[bookingId,userId,'paid',route[5],createdAt]);
            await tx.query('INSERT INTO tickets(id,"userId","tripId","bookingId",seat,status,price,"basePrice",code,"paymentMethod","createdAt","paidAt") VALUES($1,$2,$3,$4,$5,$6,$7,$7,$8,$9,$10,$10)',[ticketId,userId,tripId,bookingId,si+1,status==='completed'?'checked_in':'paid',route[5],`SB-DEMO-${String(sampleCount).padStart(6,'0')}`,'momo',createdAt]);
            await tx.query('INSERT INTO payments(id,"ticketId","bookingId","userId",amount,method,status,reference,"createdAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[paymentId,ticketId,bookingId,userId,route[5],'momo','paid',`DEMO-SEED-${sampleCount}`,createdAt]);
            await tx.query('INSERT INTO invoices(id,"ticketId","paymentId",number,amount,"createdAt") VALUES($1,$2,$3,$4,$5,$6)',[`invoice_demo_${sampleCount}`,ticketId,paymentId,`HD-DEMO-${String(sampleCount).padStart(6,'0')}`,route[5],createdAt]);
          }
        }
      }
    }
    await notify(tx,'user_passenger','Chào mừng đến với SmartBus','Tài khoản demo đã sẵn sàng. Dùng mã CHAO2026 khi đặt vé và trải nghiệm thanh toán mô phỏng.');
    await tx.query('INSERT INTO audit_logs(id,"userId",action,entity,"entityId",details,"createdAt") VALUES($1,$2,$3,$4,$5,$6,$7)',['audit_seed','user_admin','seed','system','demo','Khởi tạo dữ liệu trình diễn Việt Nam',nowISO()]);
    await tx.query("INSERT INTO schema_meta(key,value) VALUES('demo_seed_v1',$1)",[today]);
  });
  await backfillSeedRouteDistances(db);
  await seedHistory(db, historyDays);
}
