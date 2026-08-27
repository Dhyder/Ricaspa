import { json } from "../_lib/voucherCore.js";
import { isAuthenticated } from "../_lib/dashboardAuth.js";
import { getStatsSummary } from "../_lib/ledger.js";
import { getBookingStatsSummary } from "../_lib/bookingLedger.js";
export async function onRequestGet(context){const{request,env}=context;if(!(await isAuthenticated(context)))return json({error:"Not authenticated"},401);const url=new URL(request.url),from=url.searchParams.get("from")||undefined,to=url.searchParams.get("to")||undefined;try{const[orders,bookings]=await Promise.all([getStatsSummary(env,{from,to}),getBookingStatsSummary(env,{from,to})]);const pending=Number((bookings.byStatus||[]).find(x=>x.status==='new'||x.status==='pending')?.count||0);return json({orders,bookings,totalBookings:Number(bookings.totalBookings||0),pendingBookings:pending,totalOrders:Number(orders.totalOrders||orders.total||0),revenue:Number(orders.totalRevenue||orders.revenue||0)});}catch(err){return json({error:String(err.message||err)},500)}}
