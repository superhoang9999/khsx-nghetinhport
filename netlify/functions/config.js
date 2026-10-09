
const {env,response}=require('./_common');
exports.handler=async()=>{
  try{const e=env();return response(200,{supabaseUrl:e.url,supabasePublishableKey:e.publishable});}
  catch(err){return response(500,{error:err.message});}
};
