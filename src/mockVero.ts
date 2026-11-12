import { VeroError, type Payment, type Vero } from "./vero";

// A stand-in for the Vero API. It runs anywhere, calls nothing and moves no money.
// Like testnet, each charge pays itself: received after 9 seconds, settled after 14.
const createdAt = new Map<string, number>();

function payment(id: string): Payment {
  const created = createdAt.get(id);
  if (!created) throw new VeroError(404, { error: "payment.not_found", message: "This mock charge no longer exists." });
  const age = Date.now() - created;
  return {
    id,
    status: age < 9000 ? "AWAITING_FUNDS" : age < 14000 ? "PROCESSING" : "SETTLED",
    steps: [
      {
        metadata: {
          instructions_status: "ready",
          payment_instructions: {
            br_code: `MOCK-PIX-CHARGE-${id}-CANNOT-BE-PAID`,
            expires_at: new Date(created + 72 * 3_600_000).toISOString(),
          },
        },
      },
    ],
  };
}

export const mockVero: Vero = {
  async createCharge() {
    const id = crypto.randomUUID();
    createdAt.set(id, Date.now());
    return payment(id);
  },
  async getPayment(id) {
    return payment(id);
  },
};
