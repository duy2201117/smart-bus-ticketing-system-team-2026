package vn.smartbus;
import java.sql.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.function.Supplier;
public class Database implements AutoCloseable {
    private final Connection connection;
    public Database(String path){try{if(!path.equals(":memory:")){Path parent=Path.of(path).toAbsolutePath().getParent();Files.createDirectories(parent);}connection=DriverManager.getConnection("jdbc:sqlite:"+path);String schema=new String(Objects.requireNonNull(getClass().getResourceAsStream("/schema.sql")).readAllBytes(),StandardCharsets.UTF_8);for(String sql:schema.split(";")){if(!sql.isBlank())try(Statement st=connection.createStatement()){st.execute(sql);}}}catch(Exception e){throw new RuntimeException(e);}}
    private PreparedStatement statement(String sql,Object... args)throws SQLException {PreparedStatement st=connection.prepareStatement(sql);for(int i=0;i<args.length;i++)st.setObject(i+1,args[i]);return st;}
    public synchronized List<Map<String,Object>> all(String sql,Object... args){try(PreparedStatement st=statement(sql,args);ResultSet rs=st.executeQuery()){List<Map<String,Object>> out=new ArrayList<>();ResultSetMetaData md=rs.getMetaData();while(rs.next()){Map<String,Object> row=new LinkedHashMap<>();for(int i=1;i<=md.getColumnCount();i++)row.put(md.getColumnLabel(i),rs.getObject(i));out.add(row);}return out;}catch(SQLException e){throw failure(e);}}
    public synchronized Map<String,Object> one(String sql,Object... args){List<Map<String,Object>> rows=all(sql,args);return rows.isEmpty()?null:rows.get(0);}
    public synchronized long scalar(String sql,Object... args){Map<String,Object> row=one(sql,args);return row==null||row.values().iterator().next()==null?0:((Number)row.values().iterator().next()).longValue();}
    public synchronized int execute(String sql,Object... args){try(PreparedStatement st=statement(sql,args)){return st.executeUpdate();}catch(SQLException e){throw failure(e);}}
    public synchronized long insert(String sql,Object... args){execute(sql,args);return scalar("SELECT last_insert_rowid()");}
    public synchronized <T>T tx(Supplier<T> action){try{if(!connection.getAutoCommit())return action.get();connection.setAutoCommit(false);try{T result=action.get();connection.commit();return result;}catch(RuntimeException e){connection.rollback();throw e;}finally{connection.setAutoCommit(true);}}catch(SQLException e){throw failure(e);}}
    private RuntimeException failure(SQLException e){if(e.getErrorCode()==19)return new ApiError(409,"Dữ liệu bị trùng, ghế đã có người đặt hoặc đang được sử dụng.");return new RuntimeException(e);}
    public void audit(long userId,String action,String entity,Object entityId,String details){execute("INSERT INTO audit_logs(userId,action,entity,entityId,details,createdAt) VALUES(?,?,?,?,?,?)",userId,action,entity,String.valueOf(entityId),details,Util.now());}
    public void notify(long userId,String title,String message,String dedupe){execute("INSERT OR IGNORE INTO notifications(userId,title,message,createdAt,dedupeKey) VALUES(?,?,?,?,?)",userId,title,message,Util.now(),dedupe);}
    public void close(){try{connection.close();}catch(SQLException e){throw failure(e);}}
}
