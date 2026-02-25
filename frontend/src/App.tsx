import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = "/api";

interface OrderItem {
  product: string;
  quantity: number;
  price: number;
}

interface EventEntry {
  id: string;
  order_id: string;
  type: string;
  service: string;
  detail: string;
  timestamp: string;
}

const PRODUCTS = [
  { name: "Laptop", price: 999.99 },
  { name: "Phone", price: 699.99 },
  { name: "Tablet", price: 449.99 },
  { name: "Headphones", price: 149.99 },
];

const EVENT_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  "order.created": { label: "Order Created", color: "#3b82f6", icon: "📦" },
  "inventory.reserved": { label: "Inventory Reserved", color: "#f59e0b", icon: "📋" },
  "payment.processed": { label: "Payment Processed", color: "#10b981", icon: "💳" },
  "shipment.created": { label: "Shipment Created", color: "#8b5cf6", icon: "🚚" },
};

function App() {
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [customer, setCustomer] = useState("John Doe");
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [connected, setConnected] = useState(false);
  const eventsEndRef = useRef<HTMLDivElement>(null);
  const eventCounter = useRef(0);

  useEffect(() => {
    const es = new EventSource(`${API_BASE}/events`);
    es.addEventListener("order_event", (e) => {
      const data = JSON.parse(e.data);
      eventCounter.current += 1;
      setEvents((prev) => [
        ...prev,
        { ...data, id: `${eventCounter.current}-${data.order_id}-${data.type}` },
      ]);
    });
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, []);

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const addToCart = useCallback((product: (typeof PRODUCTS)[number]) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product === product.name);
      if (existing) {
        return prev.map((i) =>
          i.product === product.name ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product: product.name, quantity: 1, price: product.price }];
    });
  }, []);

  const removeFromCart = useCallback((productName: string) => {
    setCart((prev) => prev.filter((i) => i.product !== productName));
  }, []);

  const submitOrder = async () => {
    if (cart.length === 0 || !customer.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer, items: cart }),
      });
      if (res.ok) {
        setCart([]);
      }
    } catch (err) {
      console.error("Failed to submit order", err);
    } finally {
      setSubmitting(false);
    }
  };

  const clearEvents = () => setEvents([]);

  const orderGroups = events.reduce<Record<string, EventEntry[]>>((acc, ev) => {
    if (!acc[ev.order_id]) acc[ev.order_id] = [];
    acc[ev.order_id].push(ev);
    return acc;
  }, {});

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Event-Driven Order Processing</h1>
        <p style={styles.subtitle}>Redis Streams &middot; FastAPI &middot; React</p>
        <span style={{ ...styles.badge, backgroundColor: connected ? "#10b981" : "#ef4444" }}>
          {connected ? "SSE Connected" : "Disconnected"}
        </span>
      </header>

      <div style={styles.main}>
        {/* Left: Order Form */}
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>New Order</h2>

          <label style={styles.label}>Customer Name</label>
          <input
            style={styles.input}
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            placeholder="Enter customer name"
          />

          <label style={{ ...styles.label, marginTop: 16 }}>Products</label>
          <div style={styles.productGrid}>
            {PRODUCTS.map((p) => (
              <button
                key={p.name}
                style={styles.productCard}
                onClick={() => addToCart(p)}
              >
                <span style={styles.productName}>{p.name}</span>
                <span style={styles.productPrice}>${p.price}</span>
              </button>
            ))}
          </div>

          {cart.length > 0 && (
            <div style={styles.cart}>
              <h3 style={{ margin: "0 0 8px", fontSize: 14, color: "#94a3b8" }}>Cart</h3>
              {cart.map((item) => (
                <div key={item.product} style={styles.cartItem}>
                  <span>
                    {item.quantity}x {item.product}
                  </span>
                  <div>
                    <span style={{ color: "#94a3b8", marginRight: 8 }}>
                      ${(item.quantity * item.price).toFixed(2)}
                    </span>
                    <button
                      style={styles.removeBtn}
                      onClick={() => removeFromCart(item.product)}
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ))}
              <div style={styles.cartTotal}>
                Total: ${cart.reduce((s, i) => s + i.quantity * i.price, 0).toFixed(2)}
              </div>
            </div>
          )}

          <button
            style={{
              ...styles.submitBtn,
              opacity: cart.length === 0 || submitting ? 0.5 : 1,
            }}
            onClick={submitOrder}
            disabled={cart.length === 0 || submitting}
          >
            {submitting ? "Submitting..." : "Submit Order"}
          </button>
        </div>

        {/* Right: Event Feed */}
        <div style={{ ...styles.panel, flex: 1.2 }}>
          <div style={styles.feedHeader}>
            <h2 style={styles.panelTitle}>Live Event Feed</h2>
            {events.length > 0 && (
              <button style={styles.clearBtn} onClick={clearEvents}>
                Clear
              </button>
            )}
          </div>

          {events.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={{ fontSize: 40, margin: 0 }}>📡</p>
              <p style={{ color: "#64748b" }}>
                Submit an order to see events flow through the system
              </p>
            </div>
          ) : (
            <div style={styles.eventList}>
              {Object.entries(orderGroups).map(([orderId, orderEvents]) => (
                <div key={orderId} style={styles.orderGroup}>
                  <div style={styles.orderGroupHeader}>
                    Order <code style={styles.orderId}>{orderId}</code>
                  </div>
                  <div style={styles.timeline}>
                    {orderEvents.map((ev, idx) => {
                      const cfg = EVENT_CONFIG[ev.type] || {
                        label: ev.type,
                        color: "#64748b",
                        icon: "⚡",
                      };
                      let detail = "";
                      try {
                        const d = JSON.parse(ev.detail);
                        if (ev.type === "order.created")
                          detail = `Customer: ${d.customer}, Items: ${d.item_count}`;
                        else if (ev.type === "inventory.reserved")
                          detail = d.map((i: any) => `${i.quantity}x ${i.product}`).join(", ");
                        else if (ev.type === "payment.processed")
                          detail = `$${d.amount} charged to card ****${d.card_last4}`;
                        else if (ev.type === "shipment.created")
                          detail = `${d.carrier} - ${d.tracking_number}`;
                      } catch {
                        detail = ev.detail;
                      }
                      return (
                        <div key={ev.id} style={styles.timelineItem}>
                          <div style={styles.timelineDot(cfg.color, idx === orderEvents.length - 1)} />
                          {idx < orderEvents.length - 1 && <div style={styles.timelineLine} />}
                          <div style={styles.eventCard}>
                            <div style={styles.eventHeader}>
                              <span style={{ marginRight: 6 }}>{cfg.icon}</span>
                              <span style={{ fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                              <span style={styles.serviceBadge}>{ev.service}</span>
                            </div>
                            {detail && <p style={styles.eventDetail}>{detail}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div ref={eventsEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, any> = {
  container: {
    minHeight: "100vh",
    background: "#0f172a",
    color: "#e2e8f0",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    padding: "24px 32px",
  },
  header: {
    textAlign: "center" as const,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    margin: "0 0 4px",
    background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  subtitle: {
    color: "#64748b",
    fontSize: 14,
    margin: "0 0 12px",
  },
  badge: {
    display: "inline-block",
    padding: "4px 12px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    color: "#fff",
  },
  main: {
    display: "flex",
    gap: 24,
    maxWidth: 1100,
    margin: "0 auto",
    alignItems: "flex-start",
  },
  panel: {
    flex: 1,
    background: "#1e293b",
    borderRadius: 12,
    padding: 24,
    border: "1px solid #334155",
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: 600,
    margin: "0 0 16px",
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 500,
    color: "#94a3b8",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #334155",
    background: "#0f172a",
    color: "#e2e8f0",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box" as const,
  },
  productGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  productCard: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    padding: "14px 8px",
    borderRadius: 8,
    border: "1px solid #334155",
    background: "#0f172a",
    color: "#e2e8f0",
    cursor: "pointer",
    transition: "border-color 0.15s",
  },
  productName: {
    fontWeight: 600,
    fontSize: 14,
  },
  productPrice: {
    color: "#10b981",
    fontSize: 13,
    marginTop: 2,
  },
  cart: {
    marginTop: 16,
    padding: 12,
    background: "#0f172a",
    borderRadius: 8,
    border: "1px solid #334155",
  },
  cartItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 0",
    fontSize: 14,
  },
  cartTotal: {
    marginTop: 8,
    paddingTop: 8,
    borderTop: "1px solid #334155",
    fontWeight: 600,
    textAlign: "right" as const,
    color: "#10b981",
  },
  removeBtn: {
    background: "transparent",
    border: "none",
    color: "#ef4444",
    fontSize: 18,
    cursor: "pointer",
    padding: "0 4px",
  },
  submitBtn: {
    width: "100%",
    marginTop: 16,
    padding: "12px 0",
    borderRadius: 8,
    border: "none",
    background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
    color: "#fff",
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
  },
  feedHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 0,
  },
  clearBtn: {
    background: "transparent",
    border: "1px solid #334155",
    color: "#94a3b8",
    fontSize: 12,
    padding: "4px 12px",
    borderRadius: 6,
    cursor: "pointer",
  },
  emptyState: {
    textAlign: "center" as const,
    padding: "48px 0",
  },
  eventList: {
    maxHeight: "65vh",
    overflowY: "auto" as const,
  },
  orderGroup: {
    marginBottom: 20,
  },
  orderGroupHeader: {
    fontSize: 13,
    fontWeight: 600,
    color: "#94a3b8",
    marginBottom: 8,
  },
  orderId: {
    background: "#334155",
    padding: "2px 8px",
    borderRadius: 4,
    fontSize: 12,
    fontFamily: "monospace",
    color: "#e2e8f0",
  },
  timeline: {
    position: "relative" as const,
    paddingLeft: 24,
  },
  timelineItem: {
    position: "relative" as const,
    marginBottom: 12,
  },
  timelineDot: (color: string, isLast: boolean) => ({
    position: "absolute" as const,
    left: -24,
    top: 8,
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: color,
    border: `2px solid ${isLast ? color : "#1e293b"}`,
    boxShadow: isLast ? `0 0 8px ${color}` : "none",
  }),
  timelineLine: {
    position: "absolute" as const,
    left: -19,
    top: 22,
    bottom: -12,
    width: 2,
    background: "#334155",
  },
  eventCard: {
    background: "#0f172a",
    borderRadius: 8,
    padding: "10px 14px",
    border: "1px solid #334155",
  },
  eventHeader: {
    display: "flex",
    alignItems: "center",
    fontSize: 14,
  },
  serviceBadge: {
    marginLeft: "auto",
    fontSize: 11,
    color: "#64748b",
    background: "#1e293b",
    padding: "2px 8px",
    borderRadius: 4,
    border: "1px solid #334155",
  },
  eventDetail: {
    margin: "6px 0 0",
    fontSize: 13,
    color: "#94a3b8",
  },
};

export default App;
