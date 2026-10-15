package vn.smartbus;
import jakarta.servlet.http.*;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import static vn.smartbus.Util.*;
import static vn.smartbus.ApiError.check;
public final class Security {
    private static final SecureRandom RANDOM=new SecureRandom();
    private static final int ITERATIONS=210_000;
    private final Database db;
    private final Map<String,ArrayDeque<Long>> attempts=new ConcurrentHashMap<>();
    public static final String SAFE_USER="id,name,email,role,phone,discountType,discountStatus,discountEvidence,active,createdAt";
    public Security(Database db){this.db=db;}
    public static String hashPassword(String password){byte[] salt=new byte[16];RANDOM.nextBytes(salt);return ITERATIONS+":"+Base64.getEncoder().encodeToString(salt)+":"+Base64.getEncoder().encodeToString(derive(password,salt,ITERATIONS));}
    private static byte[] derive(String password,byte[] salt,int iterations){try{return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(new PBEKeySpec(password.toCharArray(),salt,iterations,256)).getEncoded();}catch(Exception e){throw new IllegalStateException(e);}}
    public static boolean verifyPassword(String password,String hash){try{String[] parts=hash.split(":");return MessageDigest.isEqual(Base64.getDecoder().decode(parts[2]),derive(password,Base64.getDecoder().decode(parts[1]),Integer.parseInt(parts[0])));}catch(Exception e){return false;}}
    public static String sha256(String text){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
    private String token(HttpServletRequest req){if(req.getCookies()!=null)for(Cookie c:req.getCookies())if(c.getName().equals("smartbus_session"))return c.getValue();return "";}
    public Map<String,Object> user(HttpServletRequest req){String tok=token(req);if(tok.isBlank())return null;return db.one("SELECT "+SAFE_USER+" FROM users WHERE active=1 AND id=(SELECT userId FROM sessions WHERE tokenHash=? AND expiresAt>?)",sha256(tok),now());}
    public Map<String,Object> require(HttpServletRequest req){Map<String,Object> u=user(req);check(u!=null,401,"Vui lòng đăng nhập.");return u;}
    public void roles(Map<String,Object> u,String... roles){check(u!=null&&Arrays.asList(roles).contains(str(u,"role")),403,"Bạn không có quyền thực hiện thao tác này.");}
    public void origin(HttpServletRequest req){String origin=req.getHeader("Origin"),site=req.getHeader("Sec-Fetch-Site");check(!"cross-site".equals(site),403,"Yêu cầu không cùng nguồn bị từ chối.");if(origin==null)return;String allowed=System.getenv("SMARTBUS_ORIGIN");String expected=req.getScheme()+"://"+req.getHeader("Host");check(origin.equals(expected)||(allowed!=null&&Arrays.asList(allowed.split(",")).contains(origin)),403,"Nguồn yêu cầu không được cho phép.");}
    public void rateLimit(HttpServletRequest req){long time=System.currentTimeMillis();String key=req.getRemoteAddr();if(attempts.size()>10_000)attempts.entrySet().removeIf(e->{synchronized(e.getValue()){return e.getValue().isEmpty()||e.getValue().peekLast()<time-900_000;}});ArrayDeque<Long> q=attempts.computeIfAbsent(key,k->new ArrayDeque<>());synchronized(q){while(!q.isEmpty()&&q.peekFirst()<time-900_000)q.removeFirst();check(q.size()<30,429,"Quá nhiều lần thử. Vui lòng thử lại sau 15 phút.");q.addLast(time);}}
    public Map<String,Object> register(Map<String,Object> body,String role){String name=required(body,"name",100),email=required(body,"email",254).toLowerCase(Locale.ROOT),pass=required(body,"password",128);check(email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"),400,"Email không hợp lệ.");check(pass.length()>=10,400,"Mật khẩu cần ít nhất 10 ký tự.");String phone=str(body,"phone");check(phone.length()<=30,400,"Số điện thoại quá dài.");long id=db.insert("INSERT INTO users(name,email,passwordHash,role,phone,createdAt) VALUES(?,?,?,?,?,?)",name,email,hashPassword(pass),role,phone,now());return db.one("SELECT "+SAFE_USER+" FROM users WHERE id=?",id);}
    public Map<String,Object> login(HttpServletRequest req,HttpServletResponse res,Map<String,Object> body){rateLimit(req);String email=required(body,"email",254).toLowerCase(Locale.ROOT),password=required(body,"password",128);Map<String,Object> row=db.one("SELECT * FROM users WHERE email=?",email);boolean valid=verifyPassword(password,row==null?DUMMY_HASH:str(row,"passwordHash"));check(row!=null&&valid&&bool(row.get("active")),401,"Email hoặc mật khẩu không đúng.");Map<String,Object> u=db.one("SELECT "+SAFE_USER+" FROM users WHERE id=?",row.get("id"));session(req,res,u);db.audit(num(u.get("id")),"login","user",u.get("id"),"");return map("user",u);}
    private static final String DUMMY_HASH=hashPassword("SmartBus invalid dummy password");
    public void session(HttpServletRequest req,HttpServletResponse res,Map<String,Object> user){byte[] bytes=new byte[32];RANDOM.nextBytes(bytes);String token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);db.execute("DELETE FROM sessions WHERE expiresAt<=? OR tokenHash=?",now(),sha256(token(req)));db.execute("INSERT INTO sessions(tokenHash,userId,expiresAt) VALUES(?,?,?)",sha256(token),user.get("id"),iso(Instant.now().plusSeconds(86400*7)));cookie(req,res,token,604800);}
    public void logout(HttpServletRequest req,HttpServletResponse res){db.execute("DELETE FROM sessions WHERE tokenHash=?",sha256(token(req)));cookie(req,res,"",0);}
    private void cookie(HttpServletRequest req,HttpServletResponse res,String token,int age){res.addHeader("Set-Cookie","smartbus_session="+token+"; Path=/; HttpOnly; SameSite=Lax; Max-Age="+age+(req.isSecure()||"true".equalsIgnoreCase(System.getenv("SMARTBUS_SECURE_COOKIE"))?"; Secure":""));}
}
