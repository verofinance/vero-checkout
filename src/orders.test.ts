import { expect, test } from "bun:test";
import { mockVero } from "./mockVero";
import { createOrder, reconcileOrder } from "./orders";
import type { Payment, Vero } from "./vero";

test("fulfils only after reading SETTLED, then stops asking Vero", async () => {
  let status: Payment["status"] = "AWAITING_FUNDS";
  let reads = 0;
  const payment = (): Payment => ({
    id: "pay_1",
    status,
    steps: [{ metadata: { instructions_status: "ready", payment_instructions: { br_code: "000201", expires_at: "2030-01-01T00:00:00Z" } } }],
  });
  const vero: Vero = { createCharge: async () => payment(), getPayment: async () => (reads++, payment()) };

  const order = await createOrder(vero, 10, "test");
  expect(order.fulfilled).toBe(false);
  expect(order.brCode).toBe("000201");

  status = "PROCESSING";
  expect((await reconcileOrder(vero, order.id))!.fulfilled).toBe(false);

  status = "SETTLED";
  expect((await reconcileOrder(vero, order.id))!.fulfilled).toBe(true);

  await reconcileOrder(vero, order.id); // final, so no further call to Vero
  expect(reads).toBe(2);

  expect(await reconcileOrder(vero, "nope")).toBeNull();
});

test("a mock charge starts unpaid and can be read back", async () => {
  const charge = await mockVero.createCharge(10);
  expect(charge.status).toBe("AWAITING_FUNDS");
  expect((await mockVero.getPayment(charge.id)).id).toBe(charge.id);
  expect(mockVero.getPayment("nope")).rejects.toThrow();
});
