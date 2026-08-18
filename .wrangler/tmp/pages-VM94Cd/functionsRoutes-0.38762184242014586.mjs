import { onRequestPost as __api_create_voucher_js_onRequestPost } from "C:\\Users\\mnmsyk\\Music\\Ricaspa\\functions\\api\\create-voucher.js"
import { onRequestPost as __api_initiate_payment_js_onRequestPost } from "C:\\Users\\mnmsyk\\Music\\Ricaspa\\functions\\api\\initiate-payment.js"
import { onRequestGet as __api_order_status_js_onRequestGet } from "C:\\Users\\mnmsyk\\Music\\Ricaspa\\functions\\api\\order-status.js"
import { onRequestPost as __api_payment_webhook_js_onRequestPost } from "C:\\Users\\mnmsyk\\Music\\Ricaspa\\functions\\api\\payment-webhook.js"

export const routes = [
    {
      routePath: "/api/create-voucher",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_create_voucher_js_onRequestPost],
    },
  {
      routePath: "/api/initiate-payment",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_initiate_payment_js_onRequestPost],
    },
  {
      routePath: "/api/order-status",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_order_status_js_onRequestGet],
    },
  {
      routePath: "/api/payment-webhook",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_payment_webhook_js_onRequestPost],
    },
  ]