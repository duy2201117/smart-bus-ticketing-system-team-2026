package vn.smartbus;
import java.time.*;
import java.util.*;
import static vn.smartbus.Util.*;
public final class Seed {
    public static void initialize(Database db,boolean demo){db.tx(()->{if(!demo){String email=System.getenv("SMARTBUS_ADMIN_EMAIL"),password=System.getenv("SMARTBUS_ADMIN_PASSWORD");if(db.scalar("SELECT COUNT(*) FROM users WHERE role='admin' AND active=1")==0){if(email==null||password==null||password.length()<12)throw new IllegalStateException("Production bootstrap requires SMARTBUS_ADMIN_EMAIL and SMARTBUS_ADMIN_PASSWORD (12+ characters).");new Security(db).register(map("name","Quản trị viên","email",email,"password",password),"admin");}return null;}if(db.one("SELECT value FROM settings WHERE key='demoSeed'")!=null)return null;
        String password=Security.hashPassword("SmartBus@123");String[] roles={"admin","manager","driver","passenger"};String[] names={"Quản trị SmartBus","Điều hành SmartBus","Nguyễn Văn An","Lê Duy"};for(int i=0;i<4;i++)db.execute("INSERT INTO users(name,email,passwordHash,role,phone,createdAt) VALUES(?,?,?,?,?,?)",names[i],roles[i]+"@smartbus.demo",password,roles[i],"0901234567",now());
        for(int i=2;i<=4;i++)db.execute("INSERT INTO users(name,email,passwordHash,role,createdAt) VALUES(?,?,?,'driver',?)","Tài xế "+i,"driver"+i+"@smartbus.demo",password,now());
        Object[][] stops={{"Bến xe Mỹ Đình","Nam Từ Liêm, Hà Nội",21.0288,105.7789},{"Cầu Giấy","Cầu Giấy, Hà Nội",21.036,105.797},{"Đại học Quốc gia","Cầu Giấy, Hà Nội",21.0368,105.7827},{"Sân bay Nội Bài","Sóc Sơn, Hà Nội",21.2187,105.8042},{"Bến xe Thái Nguyên","Thành phố Thái Nguyên",21.5672,105.8255},{"Đại học Thái Nguyên","Phan Đình Phùng, Thái Nguyên",21.5943,105.8165},{"Sông Công","Thái Nguyên",21.4863,105.8416},{"Phổ Yên","Thái Nguyên",21.4151,105.8746},{"Long Biên","Long Biên, Hà Nội",21.0434,105.849},{"Hồ Gươm","Hoàn Kiếm, Hà Nội",21.0285,105.8542}};
        for(Object[] s:stops)db.execute("INSERT INTO stops(name,address,lat,lng) VALUES(?,?,?,?)",s);
        String[][] routes={{"01","Mỹ Đình — Thái Nguyên","Mỹ Đình","Thái Nguyên"},{"02","Thái Nguyên — Mỹ Đình","Thái Nguyên","Mỹ Đình"},{"03","Mỹ Đình — Nội Bài","Mỹ Đình","Nội Bài"},{"04","Long Biên — Cầu Giấy","Long Biên","Cầu Giấy"},{"05","Thái Nguyên — Phổ Yên","Thái Nguyên","Phổ Yên"},{"06","Hồ Gươm — Nội Bài","Hồ Gươm","Nội Bài"}};
        int[][] stopIds={{1,2,3,8,5},{5,7,8,3,1},{1,2,3,9,4},{9,10,3,1,2},{5,6,7,8},{10,9,2,3,4}};
        int[] prices={80000,80000,30000,15000,20000,35000};int[] durations={120,120,60,45,50,70};
        for(int i=0;i<routes.length;i++){String[] r=routes[i];long id=db.insert("INSERT INTO routes(code,name,origin,destination,price,durationMinutes) VALUES(?,?,?,?,?,?)",r[0],r[1],r[2],r[3],prices[i],durations[i]);for(int j=0;j<stopIds[i].length;j++)db.execute("INSERT INTO route_stops VALUES(?,?,?)",id,stopIds[i][j],j+1);}
        for(int i=1;i<=4;i++)db.execute("INSERT INTO buses(plate,name,seatCount,status) VALUES(?,?,40,'active')","29B-100.0"+i,"SmartBus "+i);
        ZoneId zone=ZoneId.of("Asia/Ho_Chi_Minh");LocalDate start=LocalDate.now(zone);int[] drivers={3,5,6,7};
        for(int day=0;day<14;day++)for(int bus=1;bus<=4;bus++)for(int slot=0;slot<4;slot++){int route=(bus+slot-1)%6+1;Instant dep=start.plusDays(day).atTime(6+slot*4,bus*5).atZone(zone).toInstant();if(dep.isBefore(Instant.now()))continue;db.execute("INSERT INTO trips(routeId,busId,driverId,departureTime,arrivalTime,locationSource) VALUES(?,?,?,?,?,'unavailable')",route,bus,drivers[bus-1],iso(dep),iso(dep.plusSeconds(durations[route-1]*60L)));}
        db.execute("INSERT INTO vouchers(code,percent,maxDiscount,expiresAt,usageLimit) VALUES('SMARTBUS20',20,20000,?,1000)",iso(Instant.now().plusSeconds(86400*90L)));
        db.notify(4,"Chào mừng đến SmartBus","Bạn đang sử dụng dữ liệu demo. Thanh toán, hoàn tiền và vé tháng được mô phỏng; vị trí GPS chỉ có khi tài xế gửi dữ liệu.","welcome:4");
        db.execute("INSERT INTO settings(key,value) VALUES('demoSeed',?)",now());return null;});}
}
