import QRCode from "qrcode";
import { useEffect, useState } from "react";
import type { Order } from "./orders";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Option A: our own payment screen, drawn from the charge's br_code and expires_at.
export function PixCode({ order, mock }: { order: Order; mock: boolean }) {
  const [qr, setQr] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (order.brCode) QRCode.toDataURL(order.brCode, { width: 480, margin: 0, color: { dark: "#0f231e" } }).then(setQr);
  }, [order.brCode]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Vero may still be preparing the charge; the order poll brings the code when it is ready.
  if (order.instructionsStatus !== "ready" || !order.brCode) {
    return <p className="py-16 text-muted-foreground">Preparing the PIX code…</p>;
  }

  const seconds = order.expiresAt ? Math.max(0, Math.floor((Date.parse(order.expiresAt) - now) / 1000)) : 0;
  const [h, m, s] = [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60];

  const copy = async () => {
    await navigator.clipboard.writeText(order.brCode!);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <p className="text-3xl font-bold">{brl.format(order.amount)}</p>
      {qr && <img src={qr} alt="PIX QR code" className="size-56" />}
      <p className="text-sm text-muted-foreground">
        {mock
          ? "A mock charge: this code cannot be paid. It settles by itself in a few seconds."
          : `Scan with your bank app. Expires in ${h > 0 ? `${h}h ${m}min` : `${m}min ${s}s`}.`}
      </p>
      <code className="w-full truncate rounded-md bg-muted px-3 py-2 text-left font-mono text-xs">
        {order.brCode}
      </code>
      <button type="button" onClick={copy} className="btn w-full">
        {copied ? "PIX code copied" : "Copy PIX code"}
      </button>
    </>
  );
}
