package vn.smartbus;
import java.time.*;
import java.time.format.*;
import java.util.*;
public final class Util {
    private static final DateTimeFormatter ISO=new DateTimeFormatterBuilder().appendInstant(3).toFormatter();
    public static String now(){return iso(Instant.now());}
    public static String iso(Instant time){return ISO.format(time);}
    public static String dateTime(Object value){try{return iso(Instant.parse(String.valueOf(value)));}catch(Exception e){throw new ApiError(400,"Thời gian không hợp lệ (cần ISO 8601 kèm múi giờ).");}}
    public static String str(Map<String,Object> m,String k){Object v=m.get(k);return v==null?"":v.toString().trim();}
    public static String required(Map<String,Object> m,String k,int max){String s=str(m,k);ApiError.check(!s.isBlank()&&s.length()<=max,400,"Trường "+k+" bắt buộc, tối đa "+max+" ký tự.");return s;}
    public static long num(Object o){try{return Long.parseLong(o.toString());}catch(Exception e){throw new ApiError(400,"Giá trị số nguyên không hợp lệ.");}}
    public static int integer(Map<String,Object> m,String k,int min,int max){long n=num(m.get(k));ApiError.check(n>=min&&n<=max,400,k+" phải từ "+min+" đến "+max+".");return (int)n;}
    public static double coord(Map<String,Object> m,String k,double min,double max){try{double n=Double.parseDouble(str(m,k));ApiError.check(Double.isFinite(n)&&n>=min&&n<=max,400,"Tọa độ không hợp lệ.");return n;}catch(NumberFormatException e){throw new ApiError(400,"Tọa độ không hợp lệ.");}}
    public static String choice(Map<String,Object> m,String k,String... allowed){String s=required(m,k,100);ApiError.check(Arrays.asList(allowed).contains(s),400,k+" không hợp lệ.");return s;}
    public static boolean bool(Object o){return Boolean.TRUE.equals(o)||"1".equals(String.valueOf(o))||"true".equalsIgnoreCase(String.valueOf(o));}
    public static Map<String,Object> map(Object... pairs){Map<String,Object> m=new LinkedHashMap<>();for(int i=0;i<pairs.length;i+=2)m.put(pairs[i].toString(),pairs[i+1]);return m;}
    public static String html(Object x){return String.valueOf(x).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;").replace("\"","&quot;").replace("'","&#39;");}
    public static String code(){return UUID.randomUUID().toString().replace("-","");}
}
