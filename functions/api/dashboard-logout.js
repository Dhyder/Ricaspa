import { json } from "../_lib/voucherCore.js";import { clearSessionCookie,destroySession,getSession,audit } from "../_lib/dashboardAuth.js";
export async function onRequestPost(c){const u=await getSession(c);if(u)await audit(c.env,u,"logout");await destroySession(c);return new Response(JSON.stringify({ok:true}),{headers:{"Content-Type":"application/json","Set-Cookie":clearSessionCookie()}})}
