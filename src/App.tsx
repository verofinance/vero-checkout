import { useEffect, useMemo, useState } from "react";
import { backend, type Mode } from "./backend";
import bourbon from "./images/bourbon.svg";
import catuai from "./images/catuai.svg";
import coldbrew from "./images/coldbrew.svg";
import filters from "./images/filters.svg";
import type { Order } from "./orders";
import { PixCode } from "./PixCode";
import { PRODUCTS } from "./products";
import { TESTNET } from "./vero";
import { VeroEmbed } from "./VeroEmbed";
import "./index.css";

type Flow = "a" | "b";
const FLOWS: Record<Flow, string> = { a: "Your own checkout", b: "Vero's embedded checkout" };

const MODES: Record<Mode, { name: string; hint: string }> = {
  mock: {
    name: "Mock",
    hint: "A simulated Vero API running in this browser. Nothing reaches Vero, and charges pay themselves after a few seconds.",
  },
  key: {
    name: "Testnet key",
    hint: "Calls Vero's testnet from this browser with your key, which stays in this tab. In your own app, keep the key on your server.",
  },
  server: {
    name: "Local server",
    hint: "Calls this app's server, which holds the key from .env. This is how a real integration works.",
  },
};

const IMAGES: Record<string, string> = { bourbon, catuai, coldbrew, filters };
const STEPS = ["Charge created", "PIX received", "Settled, order fulfilled"];
const UNPAID = ["EXPIRED", "FAILED", "CANCELLED"];
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Checkout type and order id live in the URL, so a refresh reuses the charge instead of creating another.
const params = new URLSearchParams(location.search);
const saveUrl = (flow: Flow, orderId?: string) =>
  history.replaceState(null, "", `?flow=${flow}${orderId ? `&order=${orderId}` : ""}`);

// Mode and key are remembered for this tab only. Storage can be blocked, and the page works without it.
const remembered = (name: string) => {
  try {
    return sessionStorage.getItem(name) ?? "";
  } catch {
    return "";
  }
};
const remember = (name: string, value: string) => {
  try {
    sessionStorage.setItem(name, value);
  } catch {}
};

function Tabs<T extends string>(props: { label: string; options: [T, string][]; value: T; onChange: (value: T) => void }) {
  return (
    <nav aria-label={props.label} className="flex gap-1 rounded-lg bg-muted p-1">
      {props.options.map(([value, name]) => (
        <button
          key={value}
          type="button"
          aria-pressed={props.value === value}
          onClick={() => props.onChange(value)}
          className="cursor-pointer rounded-md px-3 py-1.5 text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm"
        >
          {name}
        </button>
      ))}
    </nav>
  );
}

export function App() {
  const [flow, setFlow] = useState<Flow>(params.get("flow") === "b" ? "b" : "a");
  const [mode, setMode] = useState<Mode>(remembered("mode") === "key" ? "key" : "mock");
  const [apiKey, setApiKey] = useState(remembered("key"));
  const [server, setServer] = useState<{ hasKey: boolean; embedHost: string } | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [buying, setBuying] = useState<string>();
  const [error, setError] = useState<string>();

  const api = useMemo(() => backend(mode, apiKey), [mode, apiKey]);

  const refresh = () =>
    order &&
    api
      .getOrder(order.id)
      .then(next => next && setOrder(next))
      .catch(() => {}); // a failed check is retried by the next poll

  // On load: find out whether this app's server is there (it is not on a static host), then restore the order.
  useEffect(() => {
    (async () => {
      const found = await fetch("api/config")
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null);
      setServer(found);
      const restored: Mode = remembered("mode") === "server" && found?.hasKey ? "server" : mode;
      setMode(restored);
      const id = params.get("order");
      if (id) setOrder(await backend(restored, apiKey).getOrder(id).catch(() => null));
    })();
  }, []);

  const unpaid = !!order && UNPAID.includes(order.status);
  const final = !!order && (order.fulfilled || unpaid);
  const settling = order?.status === "PROCESSING";

  useEffect(() => {
    if (!order || final) return;
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [order?.id, final, api]);

  const clearOrder = (nextFlow = flow) => {
    setFlow(nextFlow);
    setOrder(null);
    setError(undefined);
    saveUrl(nextFlow);
  };

  const chooseMode = (next: Mode) => {
    setMode(next);
    remember("mode", next);
    clearOrder();
  };

  const buy = async (productId: string) => {
    if (mode === "key" && !apiKey) return setError("Paste a Vero testnet API key above, or switch to Mock.");
    setBuying(productId);
    setError(undefined);
    try {
      const created = await api.createOrder(productId);
      setOrder(created);
      saveUrl(flow, created.id);
    } catch (e) {
      setError(
        e instanceof TypeError
          ? "The payment service did not answer. Check your connection, then try again."
          : (e as Error).message,
      );
    } finally {
      setBuying(undefined);
    }
  };

  const stepsDone = !order ? 0 : order.fulfilled ? 3 : settling ? 2 : 1;
  const modes = (Object.keys(MODES) as Mode[]).filter(m => m !== "server" || server?.hasKey);

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 md:py-12">
      <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5 border-b pb-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Torra</h1>
          <p className="text-muted-foreground">A demo coffee shop that takes PIX through Vero. No real money moves.</p>
        </div>
        <Tabs label="Checkout type" options={Object.entries(FLOWS) as [Flow, string][]} value={flow} onChange={clearOrder} />
      </header>

      <section aria-label="Payments" className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b py-4">
        <Tabs label="Payments mode" options={modes.map(m => [m, MODES[m].name])} value={mode} onChange={chooseMode} />
        {mode === "key" && (
          <input
            type="password"
            className="input max-w-xs"
            aria-label="Vero testnet API key"
            placeholder="Vero testnet API key"
            autoComplete="off"
            value={apiKey}
            onChange={e => {
              setApiKey(e.target.value.trim());
              remember("key", e.target.value.trim());
            }}
          />
        )}
        <p className="min-w-64 flex-1 text-sm text-muted-foreground">{MODES[mode].hint}</p>
      </section>

      <div className="mt-8 grid items-start gap-10 md:grid-cols-[1fr_26rem]">
        <div className="grid gap-4">
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
          <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
            {PRODUCTS.map(product => (
              <li key={product.id} className="grid overflow-hidden rounded-xl border bg-card">
                <img src={IMAGES[product.id]} alt="" className="aspect-[20/13] w-full object-cover" />
                <div className="grid gap-1 p-4">
                  <h2 className="text-lg font-bold">{product.name}</h2>
                  <p className="text-sm text-muted-foreground">{product.detail}</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-lg font-bold">{brl.format(product.price)}</p>
                    <button type="button" className="btn" disabled={!!buying} onClick={() => buy(product.id)}>
                      {buying === product.id ? "Creating PIX charge…" : "Buy with PIX"}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {order ? (
          <aside className="grid gap-3 max-md:order-first" aria-live="polite">
            <div className="slip">
              <div className="flex items-baseline justify-between gap-4 px-6 pt-5">
                <h2 className="font-bold">{order.description}</h2>
                <p className="text-sm text-muted-foreground">{FLOWS[flow]}</p>
              </div>
              <div
                className={`grid justify-items-center gap-4 text-center ${flow === "b" && mode !== "mock" && !final && !settling ? "p-1" : "p-6"}`}
              >
                {order.fulfilled ? (
                  <>
                    <p className="grid size-14 place-items-center rounded-full bg-pix text-2xl text-white" aria-hidden>
                      ✓
                    </p>
                    <p className="text-2xl font-bold">{brl.format(order.amount)} paid</p>
                    <p className="text-sm text-muted-foreground">
                      {mode === "mock"
                        ? "The mock API reported SETTLED, so the shop fulfilled the order."
                        : "The shop read SETTLED from Vero and fulfilled the order."}
                    </p>
                  </>
                ) : unpaid ? (
                  <>
                    <p className="text-xl font-bold">This charge was not paid</p>
                    <p className="text-sm text-muted-foreground">
                      Vero reports it as {order.status.toLowerCase()}. Buy the product again to get a new charge.
                    </p>
                  </>
                ) : settling ? (
                  <>
                    <p className="text-xl font-bold">PIX received</p>
                    <p className="text-sm text-muted-foreground">The payment is being settled. This takes a few seconds.</p>
                  </>
                ) : flow === "a" ? (
                  <PixCode order={order} mock={mode === "mock"} />
                ) : mode === "mock" ? (
                  <div className="grid w-full gap-2 rounded-lg border-2 border-dashed px-6 py-12">
                    <p className="font-bold">Vero's checkout would load here</p>
                    <p className="text-sm text-muted-foreground">
                      A mock charge has nothing for Vero's iframe to show. It settles by itself in a few seconds.
                    </p>
                  </div>
                ) : (
                  <VeroEmbed order={order} host={(mode === "server" && server?.embedHost) || TESTNET.embed} onUpdate={refresh} />
                )}
              </div>
              <div className="perforation" />
              <ol className="steps p-6">
                {STEPS.map((step, i) => (
                  <li key={step} data-state={i < stepsDone ? "done" : i === stepsDone && !unpaid ? "current" : "todo"}>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
            <button type="button" className="btn btn-outline justify-self-start" onClick={() => clearOrder()}>
              {final ? "Clear order" : "Cancel order"}
            </button>
          </aside>
        ) : (
          <aside className="grid min-h-64 place-items-center rounded-xl border-2 border-dashed p-6 text-center text-muted-foreground">
            <p>Buy a product and the PIX payment appears here.</p>
          </aside>
        )}
      </div>
    </main>
  );
}
