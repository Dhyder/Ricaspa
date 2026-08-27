import { json } from "../_lib/voucherCore.js";import { getSession } from "../_lib/dashboardAuth.js";
export async function onRequestGet(c){const u=await getSession(c);if(!u)return json({error:"Not authenticated"},401);return json({user:{id:u.id,name:u.name,email:u.email,role:u.role}})}
