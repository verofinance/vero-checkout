import type { Payment, PaymentStatus, Vero } from "./vero";

export type Order = {
  id: string;
  amount: number;
  description: string;
  paymentId: string;
  status: PaymentStatus;
  fulfilled: boolean;
  instructionsStatus: "preparing" | "ready";
  brCode?: string;
  expiresAt?: string;
};

const FINAL: PaymentStatus[] = ["SETTLED", "EXPIRED", "FAILED", "CANCELLED"];

// ponytail: in-memory store, orders vanish on restart; swap for a database when that matters.
const orders = new Map<string, Order>();

function applyPayment(order: Order, p: Payment) {
  const meta = p.steps[0]?.metadata;
  order.status = p.status;
  order.instructionsStatus = meta?.instructions_status ?? "preparing";
  order.brCode = meta?.payment_instructions?.br_code;
  order.expiresAt = meta?.payment_instructions?.expires_at;
  // The only place an order is fulfilled: we read SETTLED from Vero ourselves.
  if (p.status === "SETTLED" && !order.fulfilled) {
    order.fulfilled = true;
    console.log(`order ${order.id} fulfilled (payment ${p.id})`);
  }
  return order;
}

export async function createOrder(vero: Vero, amount: number, description: string) {
  const payment = await vero.createCharge(amount, description);
  const order: Order = {
    id: crypto.randomUUID(),
    amount,
    description,
    paymentId: payment.id,
    status: payment.status,
    fulfilled: false,
    instructionsStatus: "preparing",
  };
  orders.set(order.id, applyPayment(order, payment));
  return order;
}

export async function reconcileOrder(vero: Vero, id: string) {
  const order = orders.get(id);
  if (!order) return null;
  if (FINAL.includes(order.status)) return order;
  // Always the payment id we saved, never one supplied by the browser.
  return applyPayment(order, await vero.getPayment(order.paymentId));
}
