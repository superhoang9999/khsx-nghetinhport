
const {requireAdmin,response}=require('./_common');
exports.handler=async(event)=>{
  if(event.httpMethod!=='POST') return response(405,{error:'Method not allowed'});
  try{
    const {client,user}=await requireAdmin(event);
    const {user_id,enabled}=JSON.parse(event.body||'{}');
    if(!user_id||typeof enabled!=='boolean') return response(400,{error:'Thiếu thông tin trạng thái.'});
    if(user_id===user.id && !enabled) return response(400,{error:'Không thể tự khóa tài khoản Admin đang đăng nhập.'});
    const {data:target}=await client.from('profiles').select('role').eq('id',user_id).single();
    if(target?.role==='ADMIN' && !enabled) return response(400,{error:'Không khóa tài khoản ADMIN bằng chức năng này.'});
    const {error:pe}=await client.from('profiles').update({is_active:enabled}).eq('id',user_id);
    if(pe) throw pe;
    const {error:ae}=await client.auth.admin.updateUserById(user_id,{ban_duration: enabled ? 'none' : '876000h'});
    if(ae){
      await client.from('profiles').update({is_active:!enabled}).eq('id',user_id);
      throw ae;
    }
    return response(200,{success:true,enabled});
  }catch(err){return response(err.statusCode||500,{error:err.message||'Không cập nhật được trạng thái'});}
};
