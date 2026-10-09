
const {requireAdmin,response}=require('./_common');
exports.handler=async(event)=>{
  if(event.httpMethod!=='POST') return response(405,{error:'Method not allowed'});
  let createdId=null;
  try{
    const {client}=await requireAdmin(event);
    const {employee_id,username,password,permission_set_id}=JSON.parse(event.body||'{}');
    if(!employee_id||!username||!password||!permission_set_id) return response(400,{error:'Thiếu thông tin tạo tài khoản.'});
    if(String(password).length<6) return response(400,{error:'Mật khẩu phải có ít nhất 6 ký tự.'});
    const uname=String(username).trim().toLowerCase().replace(/[^a-z0-9._-]/g,'');
    if(!uname) return response(400,{error:'Tên đăng nhập không hợp lệ.'});
    const [{data:emp},{data:oldEmp},{data:oldName}] = await Promise.all([
      client.from('employees').select('id,full_name,unit_id,is_active').eq('id',employee_id).single(),
      client.from('profiles').select('id').eq('employee_id',employee_id).maybeSingle(),
      client.from('profiles').select('id').ilike('username',uname).maybeSingle()
    ]);
    if(!emp||!emp.is_active) return response(400,{error:'Nhân sự không hợp lệ.'});
    if(oldEmp) return response(409,{error:'Nhân sự này đã có tài khoản.'});
    if(oldName) return response(409,{error:'Tên đăng nhập đã tồn tại.'});
    const auth_email=`${uname}@khsx.local`;
    const {data:created,error:ae}=await client.auth.admin.createUser({email:auth_email,password,email_confirm:true,user_metadata:{employee_id,username:uname}});
    if(ae||!created?.user) throw ae||new Error('Không tạo được Auth user');
    createdId=created.user.id;
    const {error:pe}=await client.from('profiles').insert({
      id:createdId,employee_id,unit_id:emp.unit_id,username:uname,auth_email,
      full_name:emp.full_name,permission_set_id,role:'USER',is_active:true
    });
    if(pe) throw pe;
    return response(200,{success:true,user_id:createdId,username:uname});
  }catch(err){
    try{
      if(createdId){
        const {client}=await requireAdmin(event);
        await client.auth.admin.deleteUser(createdId);
      }
    }catch(_){}
    return response(err.statusCode||500,{error:err.message||'Không tạo được tài khoản'});
  }
};
