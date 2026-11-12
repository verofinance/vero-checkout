import { useEffect, useState } from "react";
import type { Order } from "./orders";

type Handle = { destroy(): void };
type VeroCheckout = {
  mountCheckout(options: {
    container: string;
    transactionId: string;
    baseUrl: string;
    origin: string;
    iframe?: { width?: string | number; height?: string | number };
    on?: {
      completed?: () => void;
      failed?: (e: { status: string }) => void;
      error?: (e: { error?: { message?: string } }) => void;
    };
  }): Handle;
};

let sdk: Promise<VeroCheckout> | undefined;
const loadSdk = (host: string) =>
  (sdk ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${host}/checkout-embed.global.js`;
    script.onload = () => resolve((window as unknown as { VeroCheckout: VeroCheckout }).VeroCheckout);
    script.onerror = () => reject(new Error("Vero's checkout script did not load. Check your connection and reload."));
    document.head.append(script);
  }));

// Option B: Vero's iframe is the payment screen. Its events are only hints:
// each one asks for a reconcile, and the reconcile decides what is paid.
export function VeroEmbed({ order, host, onUpdate }: { order: Order; host: string; onUpdate: () => void }) {
  const [error, setError] = useState<string>();

  useEffect(() => {
    let handle: Handle | undefined;
    let unmounted = false;
    loadSdk(host)
      .then(checkout => {
        if (unmounted) return;
        handle = checkout.mountCheckout({
          container: "#vero-checkout",
          transactionId: order.paymentId,
          baseUrl: host,
          origin: location.origin,
          iframe: { width: "100%", height: 660 },
          on: {
            completed: onUpdate,
            failed: onUpdate,
            error: e => setError(e.error?.message ?? "Vero's checkout did not load. Reload to try again."),
          },
        });
      })
      .catch(e => setError(e.message));
    return () => {
      unmounted = true;
      handle?.destroy();
    };
  }, [order.paymentId]);

  return (
    <>
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div id="vero-checkout" className="w-full" />
    </>
  );
}
