import os
import json
import time

import redis

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
STREAM_ORDERS = "orders"
STREAM_EVENTS = "events"
GROUP = "inventory-group"
CONSUMER = "inventory-1"

r = redis.Redis(host=REDIS_HOST, port=6379, decode_responses=True)

STOCK = {
    "Laptop": 100,
    "Phone": 200,
    "Tablet": 150,
    "Headphones": 300,
}


def ensure_group():
    try:
        r.xgroup_create(STREAM_ORDERS, GROUP, id="0", mkstream=True)
    except redis.exceptions.ResponseError as e:
        if "BUSYGROUP" not in str(e):
            raise


def process_order(order_id: str, items: list[dict]):
    reserved = []
    for item in items:
        product = item["product"]
        qty = item["quantity"]
        available = STOCK.get(product, 0)
        if available >= qty:
            STOCK[product] = available - qty
            reserved.append({"product": product, "quantity": qty, "remaining": STOCK[product]})
            print(f"  [OK] Reserved {qty}x {product} (remaining: {STOCK[product]})")
        else:
            print(f"  [WARN] Insufficient stock for {product}: need {qty}, have {available}")
            reserved.append({"product": product, "quantity": qty, "error": "insufficient_stock"})

    r.xadd(
        STREAM_EVENTS,
        {
            "order_id": order_id,
            "type": "inventory.reserved",
            "service": "inventory",
            "detail": json.dumps(reserved),
            "timestamp": str(time.time()),
        },
    )
    print(f"  -> Published inventory.reserved for order {order_id}\n")


def main():
    ensure_group()
    print("=== Inventory Service started ===")
    print(f"Initial stock: {STOCK}\n")

    while True:
        results = r.xreadgroup(GROUP, CONSUMER, {STREAM_ORDERS: ">"}, count=1, block=5000)
        if not results:
            continue
        for stream_name, messages in results:
            for msg_id, data in messages:
                if "init" in data:
                    r.xack(STREAM_ORDERS, GROUP, msg_id)
                    continue
                order_id = data["order_id"]
                items = json.loads(data["items"])
                print(f"[Inventory] Processing order {order_id} ({len(items)} items)")
                process_order(order_id, items)
                r.xack(STREAM_ORDERS, GROUP, msg_id)


if __name__ == "__main__":
    main()
