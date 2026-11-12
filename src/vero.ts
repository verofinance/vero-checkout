// Vero API client. In your own application this runs on your server, so the key never reaches a browser.
export const TESTNET = { api: "https://api.testnet.vero.finance", embed: "https://testnet.vero.finance" };

export type PaymentStatus =
  | "INITIATED"
  | "AWAITING_FUNDS"
  | "PROCESSING"
  | "SETTLED"
  | "EXPIRED"
  | "FAILED"
  | "CANCELLED";

export type Payment = {
  id: string;
  status: PaymentStatus;
  steps: {
    metadata: {
      instructions_status?: "preparing" | "ready";
      payment_instructions?: { br_code: string; expires_at: string };
    };
  }[];
};

export type Vero = {
  createCharge(amount: number, description?: string): Promise<Payment>;
  getPayment(id: string): Promise<Payment>;
};

export class VeroError extends Error {
  constructor(
    public status: number,
    public body: { error?: string; message?: string; request_id?: string },
  ) {
    super(body.message ?? `Vero answered with status ${status}`);
  }
}

export function veroClient(apiKey: string, apiUrl = TESTNET.api): Vero {
  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(apiUrl + path, {
      ...init,
      headers: { "content-type": "application/json", "x-api-key": apiKey },
    });
    const body = await res.json();
    if (!res.ok) {
      console.error("vero error", res.status, body.error, "request_id:", body.request_id);
      throw new VeroError(res.status, body);
    }
    return body as T;
  }
  return {
    createCharge: (amount, description) =>
      call("/payments/onramp", { method: "POST", body: JSON.stringify({ amount, description }) }),
    getPayment: id => call(`/payments/${id}`),
  };
}
