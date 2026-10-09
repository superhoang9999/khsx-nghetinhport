
const { createClient } = require('@supabase/supabase-js');

function env(){
  const url=process.env.SUPABASE_URL;
  const publishable=process.env.SUPABASE_PUBLISHABLE_KEY;
  const secret=process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if(!url || !publishable || !secret) throw new Error('Thiếu biến môi trường Supabase trên Netlify.');
  return {url,publishable,secret};
}
function adminClient(){
  const e=env();
  return createClient(e.url,e.secret,{auth:{persistSession:false,autoRefreshToken:false}});
}
async function requireAdmin(event){
  const token=(event.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!token) throw Object.assign(new Error('Chưa đăng nhập.'),{statusCode:401});
  const client=adminClient();
  const {data:{user},error}=await client.auth.getUser(token);
  if(error||!user) throw Object.assign(new Error('Phiên đăng nhập không hợp lệ.'),{statusCode:401});
  const {data:p,error:pe}=await client.from('profiles').select('id,role,is_active').eq('id',user.id).single();
  if(pe||!p||p.role!=='ADMIN'||!p.is_active) throw Object.assign(new Error('Bạn không có quyền quản trị.'),{statusCode:403});
  return {client,user};
}
function response(statusCode,obj){
  return {statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify(obj)};
}
module.exports={env,adminClient,requireAdmin,response,createClient};
