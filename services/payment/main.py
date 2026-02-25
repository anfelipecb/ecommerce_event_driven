import os
import json
import time
import random

import redis

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
STREAM_EVENTS = "events"
GROUP = "payment-group"
CONSUMER = "payment-1"

r = redis.Redis(host=REDIS_HOST, port=6379, decode_responses=True)


def ensure_group():
    try:
        r.xgroup_create(STREAM_EVENTS, GROUP, id="0", mkstream=True)
    except redis.exceptions.ResponseError as e:
        if "BUSYGROUP" not in str(e):
            raise


def process_payment(order_id: str, inventory_detail: list[dict]):
    total = sum(item.get("quantity", 0) * 29.99 for item in inventory_detail if "error" not in item)
    card_last4 = f"{random.randint(1000, 9999)}"
    print(f"  Charging ${total:.2f} to card ending in {card_last4}")

    time.sleep(0.5)

    payment_info = {
        "amount": f"{total:.2f}",
        "card_last4": card_last4,
        "status": "approved",
    }

    r.xadd(
        STREAM_EVENTS,
        {
            "order_id": order_id,
            "type": "payment.processed",
            "service": "payment",
            "detail": json.dumps(payment_info),
            "timestamp": str(time.time()),
        },
    )
    print(f"  -> Published payment.processed for order {order_id}\n")


def main():
    ensure_group()
    print("=== Payment Service started ===\n")

    while True:
        results = r.xreadgroup(GROUP, CONSUMER, {STREAM_EVENTS: ">"}, count=1, block=5000)
        if not results:
            continue
        for stream_name, messages in results:
            for msg_id, data in messages:
                r.xack(STREAM_EVENTS, GROUP, msg_id)
                if data.get("type") != "inventory.reserved":
                    continue
                order_id = data["order_id"]
                detail = json.loads(data.get("detail", "[]"))
                print(f"[Payment] Processing payment for order {order_id}")
                process_payment(order_id, detail)


if __name__ == "__main__":
    main()
