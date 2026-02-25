import os
import json
import time
import random
import string

import redis

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
STREAM_EVENTS = "events"
GROUP = "shipment-group"
CONSUMER = "shipment-1"

r = redis.Redis(host=REDIS_HOST, port=6379, decode_responses=True)


def ensure_group():
    try:
        r.xgroup_create(STREAM_EVENTS, GROUP, id="0", mkstream=True)
    except redis.exceptions.ResponseError as e:
        if "BUSYGROUP" not in str(e):
            raise


def process_shipment(order_id: str, payment_detail: dict):
    tracking = "TRK-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
    carrier = random.choice(["FedEx", "UPS", "DHL", "USPS"])
    print(f"  Shipment created: {carrier} tracking {tracking}")

    time.sleep(0.3)

    shipment_info = {
        "tracking_number": tracking,
        "carrier": carrier,
        "status": "label_created",
        "amount_charged": payment_detail.get("amount", "0.00"),
    }

    r.xadd(
        STREAM_EVENTS,
        {
            "order_id": order_id,
            "type": "shipment.created",
            "service": "shipment",
            "detail": json.dumps(shipment_info),
            "timestamp": str(time.time()),
        },
    )
    print(f"  -> Published shipment.created for order {order_id}\n")


def main():
    ensure_group()
    print("=== Shipment Service started ===\n")

    while True:
        results = r.xreadgroup(GROUP, CONSUMER, {STREAM_EVENTS: ">"}, count=1, block=5000)
        if not results:
            continue
        for stream_name, messages in results:
            for msg_id, data in messages:
                r.xack(STREAM_EVENTS, GROUP, msg_id)
                if data.get("type") != "payment.processed":
                    continue
                order_id = data["order_id"]
                detail = json.loads(data.get("detail", "{}"))
                print(f"[Shipment] Creating shipment for order {order_id}")
                process_shipment(order_id, detail)


if __name__ == "__main__":
    main()
