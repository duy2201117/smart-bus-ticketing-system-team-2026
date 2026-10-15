package vn.smartbus;
public class ApiError extends RuntimeException {
    public final int status;
    public ApiError(int status,String message){super(message);this.status=status;}
    public static void check(boolean condition,int status,String message){if(!condition)throw new ApiError(status,message);}
}
