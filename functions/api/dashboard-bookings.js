import { json } from "../_lib/voucherCore.js";
import { isAuthenticated } from "../_lib/dashboardAuth.js";
import { listBookingsByDate, listUpcomingBookings } from "../_lib/bookingLedger.js";
export async function onRequestGet(context){const{request,env}=context;if(!(await isAuthenticated(context)))return json({error:"Not authenticated"},401);const url=new URL(request.url),date=url.searchParams.get("date"),upcoming=url.searchParams.get("upcoming");try{const today=new Date().toISOString().split("T")[0];if(upcoming||!date)return json({bookings:await listUpcomingBookings(env,today,200)});return json({bookings:await listBookingsByDate(env,date)});}catch(err){return json({error:String(err.message||err)},500)}}
