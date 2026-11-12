import { serve } from "bun";
import index from "./index.html";
import { createOrder, reconcileOrder } from "./orders";
import { PRODUCTS } from "./products";
import { TESTNET, VeroError, veroClient } from "./vero";

// The reference integration: the key lives here, on the server, and the browser never sees it.
// Without a key the server still starts, and the page runs in mock mode.
const apiKey = process.env.VERO_API_KEY;
const vero = apiKey ? veroClient(apiKey, process.env.VERO_API_URL) : null;

const noKey = () =>
  Response.json({ error: "api_key.missing", message: "Set VERO_API_KEY in .env to use the local server." }, { status: 503 });

function onError(err: unknown) {
  if (err instanceof VeroError) {
    return Response.json({ error: err.body.error, message: err.message }, { status: err.status });
  }
  console.error(err);
  return Response.json({ error: "internal", message: "The server hit an error. Check its log." }, { status: 500 });
}

const server = serve({
  routes: {
    "/*": index,

    "/api/config": () =>
      Response.json({ hasKey: !!vero, embedHost: process.env.VERO_EMBED_HOST ?? TESTNET.embed }),

    "/api/orders": {
      async POST(req) {
        if (!vero) return noKey();
        const { productId } = (await req.json().catch(() => ({}))) as { productId?: unknown };
        // The price comes from our catalogue, never from the browser.
        const product = PRODUCTS.find(p => p.id === productId);
        if (!product) {
          return Response.json({ error: "validation_error", message: "That product is not in the shop." }, { status: 422 });
        }
        return createOrder(vero, product.price, product.name).then(Response.json, onError);
      },
    },

    "/api/orders/:id": {
      // Reconcile: the server reads the payment from Vero and fulfils only on SETTLED.
      async GET(req) {
        if (!vero) return noKey();
        return reconcileOrder(vero, req.params.id)
          .then(o => (o ? Response.json(o) : Response.json({ error: "not_found" }, { status: 404 })))
          .catch(onError);
      },
    },
  },

  development: process.env.NODE_ENV !== "production" && { hmr: true, console: true },
});

console.log(`🚀 Server running at ${server.url}`);
