import { mockVero } from "./mockVero";
import { createOrder, reconcileOrder, type Order } from "./orders";
import { PRODUCTS } from "./products";
import { veroClient, type Vero } from "./vero";

// Where the shop page sends its orders.
//   mock:   a simulated Vero API, in this browser. The default, so the public demo never touches testnet.
//   key:    Vero's testnet, called from this browser with a key the visitor pasted.
//   server: this app's own server (src/index.ts), which holds the key. How a real integration works.
export type Mode = "mock" | "key" | "server";
export type Backend = {
  createOrder(productId: string): Promise<Order>;
  getOrder(id: string): Promise<Order | null>;
};

const inBrowser = (vero: Vero): Backend => ({
  async createOrder(productId) {
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product) throw new Error("That product is not in the shop.");
    return { ...(await createOrder(vero, product.price, product.name)) };
  },
  async getOrder(id) {
    const order = await reconcileOrder(vero, id);
    return order && { ...order };
  },
});

const server: Backend = {
  async createOrder(productId) {
    const res = await fetch("api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.message ?? "The charge could not be created. Try again.");
    return body;
  },
  getOrder: id => fetch(`api/orders/${id}`).then(r => (r.ok ? r.json() : null)),
};

export const backend = (mode: Mode, apiKey: string): Backend =>
  mode === "server" ? server : inBrowser(mode === "key" ? veroClient(apiKey) : mockVero);
