
const {env,adminClient,response,createClient}=require('./_common');
exports.handler=async(event)=>{
  if(event.httpMethod!=='POST') return response(405,{error:'Method not allowed'});
  try{
    const {username,password}=JSON.parse(event.body||'{}');
    if(!username||!password) return response(400,{error:'Nhập tên đăng nhập và mật khẩu.'});
    const admin=adminClient();
    const {data:p,error:pe}=await admin.from('profiles').select('id,username,auth_email,is_active').ilike('username',String(username).trim()).maybeSingle();
    if(pe||!p) return response(401,{error:'Sai tên đăng nhập hoặc mật khẩu.'});
    if(!p.is_active) return response(403,{error:'Tài khoản đã bị khóa.'});
    let email=p.auth_email;
    if(!email){
      const {data,error}=await admin.auth.admin.getUserById(p.id);
      if(error||!data?.user?.email) return response(500,{error:'Tài khoản chưa có email Auth.'});
      email=data.user.email;
      await admin.from('profiles').update({auth_email:email}).eq('id',p.id);
    }
    const e=env();
    const auth=createClient(e.url,e.publishable,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await auth.auth.signInWithPassword({email,password});
    if(error||!data.session) return response(401,{error:'Sai tên đăng nhập hoặc mật khẩu.'});
    return response(200,{access_token:data.session.access_token,refresh_token:data.session.refresh_token});
  }catch(err){return response(500,{error:err.message||'Lỗi đăng nhập'});}
};
