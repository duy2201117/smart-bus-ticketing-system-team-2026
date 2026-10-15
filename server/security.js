import { scrypt as cryptoScrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { fail, safeUser, nowISO, id, textField, audit } from './domain.js';
import rateLimit from 'express-rate-limit';
const scrypt = promisify(cryptoScrypt);
export async function hashPassword(password) { const salt=randomBytes(16).toString('hex'); return `${salt}:${(await scrypt(password,salt,64)).toString('hex')}`; }
export async function verifyPassword(password, hash) {
  const [salt,key] = String(hash).split(':');
  if (!salt || !key || key.length !== 128) return false;
  const derived = await scrypt(password,salt,64);
  return timingSafeEqual(derived,Buffer.from(key,'hex'));
}
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export function validatePassword(password) { if (typeof password !== 'string' || password.length<10 || password.length>128 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) fail(400,'Mật khẩu cần 10–128 ký tự, gồm chữ và số.'); return password; }
export function validateEmail(value) { const email = textField(value,'Email',3,254).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400,'Email không hợp lệ.'); return email; }

export function installAuth(app, { db, demoMode }) {
  const secure = process.env.NODE_ENV === 'production';
  const cookieOptions = { httpOnly:true, sameSite:'lax', secure, path:'/', maxAge:7*86400000 };
  const requireAuth = async (req,res,next) => {
    const token = req.cookies.smartbus_session;
    if (!token) return next(Object.assign(new Error('Vui lòng đăng nhập để tiếp tục.'),{status:401}));
    const row = (await db.query('SELECT u.* FROM sessions s JOIN users u ON u.id=s."userId" WHERE s."tokenHash"=$1 AND s."expiresAt">$2 AND u.active=1',[tokenHash(token),nowISO()])).rows[0];
    if (!row) return next(Object.assign(new Error('Phiên đăng nhập đã hết hạn.'),{status:401}));
    req.user = safeUser(row); next();
  };
  const allowRoles = (...roles) => (req,res,next) => roles.includes(req.user?.role) ? next() : next(Object.assign(new Error('Bạn không có quyền thực hiện thao tác này.'),{status:403}));
  async function session(res, user) {
    const token = randomBytes(32).toString('hex');
    await db.query('INSERT INTO sessions("tokenHash","userId","expiresAt") VALUES($1,$2,$3)',[tokenHash(token),user.id,new Date(Date.now()+7*86400000).toISOString()]);
    res.cookie('smartbus_session',token,cookieOptions);
  }
  const authLimit = rateLimit({windowMs:15*60000,limit:40,standardHeaders:'draft-8',legacyHeaders:false,message:{message:'Bạn thao tác quá nhiều lần. Vui lòng thử lại sau 15 phút.'}});
  app.post('/api/auth/register', authLimit, async(req,res) => {
    const name=textField(req.body.name,'Họ tên',2,100),email=validateEmail(req.body.email),password=validatePassword(req.body.password),phone=String(req.body.phone||'').trim();
    if (phone && !/^(?:\+84|0)[0-9]{9,10}$/.test(phone)) fail(400,'Số điện thoại không hợp lệ.');
    if ((await db.query('SELECT id FROM users WHERE email=$1',[email])).rows.length) fail(409,'Email này đã được đăng ký.');
    const user=(await db.query('INSERT INTO users(id,name,email,"passwordHash",role,phone,"createdAt") VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[id('user'),name,email,await hashPassword(password),'passenger',phone,nowISO()])).rows[0];
    await session(res,user); await audit(db,user.id,'register','users',user.id); res.status(201).json({user:safeUser(user)});
  });
  app.post('/api/auth/login',authLimit,async(req,res)=>{
    const email=validateEmail(req.body.email),password=typeof req.body.password==='string'?req.body.password:'';
    if(password.length>128) fail(400,'Mật khẩu quá dài.');
    const user=(await db.query('SELECT * FROM users WHERE email=$1',[email])).rows[0];
    if (!user || !await verifyPassword(password,user.passwordHash)) fail(401,'Email hoặc mật khẩu không đúng.');
    if (!user.active) fail(403,'Tài khoản đã bị khóa. Vui lòng liên hệ quản lý.');
    if(req.cookies.smartbus_session) await db.query('DELETE FROM sessions WHERE "tokenHash"=$1',[tokenHash(req.cookies.smartbus_session)]);
    await session(res,user); await audit(db,user.id,'LOGIN','users',user.id); res.json({user:safeUser(user)});
  });
  app.get('/api/auth/me',requireAuth,(req,res)=>res.json({user:req.user}));
  app.post('/api/auth/logout',async(req,res)=>{
    if (req.cookies.smartbus_session) await db.query('DELETE FROM sessions WHERE "tokenHash"=$1',[tokenHash(req.cookies.smartbus_session)]);
    res.clearCookie('smartbus_session',{...cookieOptions,maxAge:undefined}); res.json({ok:true});
  });
  app.patch('/api/profile',requireAuth,async(req,res)=>{
    const name=textField(req.body.name,'Họ tên',2,100),phone=String(req.body.phone||'').trim();
    if (phone&&!/^(?:\+84|0)[0-9]{9,10}$/.test(phone)) fail(400,'Số điện thoại không hợp lệ.');
    const user=(await db.query('UPDATE users SET name=$1,phone=$2 WHERE id=$3 RETURNING *',[name,phone,req.user.id])).rows[0];
    res.json({user:safeUser(user)});
  });
  app.post('/api/profile/password',requireAuth,async(req,res)=>{
    const user=(await db.query('SELECT * FROM users WHERE id=$1',[req.user.id])).rows[0];
    if (!await verifyPassword(String(req.body.currentPassword||''),user.passwordHash)) fail(400,'Mật khẩu hiện tại không đúng.');
    await db.query('UPDATE users SET "passwordHash"=$1 WHERE id=$2',[await hashPassword(validatePassword(req.body.newPassword)),user.id]);
    await db.query('DELETE FROM sessions WHERE "userId"=$1',[user.id]); await session(res,user);
    res.json({message:'Đã cập nhật mật khẩu và đăng xuất các phiên khác.'});
  });
  app.post('/api/auth/forgot-password',authLimit,async(req,res)=>{
    const email=validateEmail(req.body.email);
    if(!demoMode) fail(503,'Dịch vụ gửi email chưa được cấu hình. Vui lòng liên hệ quản trị viên.');
    const user=(await db.query('SELECT * FROM users WHERE email=$1 AND active=1',[email])).rows[0];
    if(user){
      const token=randomBytes(32).toString('hex');
      await db.query('INSERT INTO password_resets("tokenHash","userId","expiresAt") VALUES($1,$2,$3)',[tokenHash(token),user.id,new Date(Date.now()+30*60000).toISOString()]);
      await db.query('INSERT INTO outbox(id,"userId",recipient,subject,body,"createdAt") VALUES($1,$2,$3,$4,$5,$6)',[id('mail'),user.id,email,'Đặt lại mật khẩu SmartBus',`Mở /reset-password?token=${token}. Liên kết hết hạn sau 30 phút.`,nowISO()]);
    }
    res.json({message:'Nếu email tồn tại, liên kết đặt lại đã được ghi vào hộp thư mô phỏng của quản trị viên.'});
  });
  app.post('/api/auth/reset-password',authLimit,async(req,res)=>{
    const token=textField(req.body.token,'Mã đặt lại',30,100),password=validatePassword(req.body.password);
    const passwordHash=await hashPassword(password);
    await db.transaction(async tx=>{
      const reset=(await tx.query('SELECT * FROM password_resets WHERE "tokenHash"=$1 AND "expiresAt">$2 AND "usedAt" IS NULL FOR UPDATE',[tokenHash(token),nowISO()])).rows[0];
      if(!reset) fail(400,'Liên kết không hợp lệ hoặc đã hết hạn.');
      await tx.query('UPDATE users SET "passwordHash"=$1 WHERE id=$2',[passwordHash,reset.userId]);
      await tx.query('UPDATE password_resets SET "usedAt"=$1 WHERE "tokenHash"=$2',[nowISO(),tokenHash(token)]);
      await tx.query('DELETE FROM sessions WHERE "userId"=$1',[reset.userId]);
    }); res.json({message:'Đã đặt lại mật khẩu. Vui lòng đăng nhập.'});
  });
  return { requireAuth, allowRoles };
}
