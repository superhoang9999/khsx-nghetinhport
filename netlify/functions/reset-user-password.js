
const {requireAdmin,response}=require('./_common');
exports.handler=async(event)=>{
  if(event.httpMethod!=='POST') return response(405,{error:'Method not allowed'});
  try{
    const {client}=await requireAdmin(event);
    const {user_id,password}=JSON.parse(event.body||'{}');
    if(!user_id||!password||String(password).length<6) return response(400,{error:'Mật khẩu phải có ít nhất 6 ký tự.'});
    const {error}=await client.auth.admin.updateUserById(user_id,{password});
    if(error) throw error;
    return response(200,{success:true});
  }catch(err){return response(err.statusCode||500,{error:err.message||'Không đặt lại được mật khẩu'});}
};
