import os
import json
import time
import uuid
import asyncio

import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

app = FastAPI(title="Order Gateway")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
STREAM_ORDERS = "orders"
STREAM_EVENTS = "events"


def get_redis():
    return aioredis.Redis(host=REDIS_HOST, port=6379, decode_responses=True)


class OrderItem(BaseModel):
    product: str
    quantity: int
    price: float


class OrderRequest(BaseModel):
    customer: str
    items: list[OrderItem]


@app.on_event("startup")
async def startup():
    r = get_redis()
    for stream in [STREAM_ORDERS, STREAM_EVENTS]:
        try:
            await r.xinfo_stream(stream)
        except aioredis.ResponseError:
            await r.xadd(stream, {"init": "true"})
    await r.aclose()


@app.post("/orders")
async def create_order(order: OrderRequest):
    r = get_redis()
    order_id = str(uuid.uuid4())[:8]
    payload = {
        "order_id": order_id,
        "customer": order.customer,
        "items": json.dumps([item.model_dump() for item in order.items]),
        "timestamp": str(time.time()),
    }
    await r.xadd(STREAM_ORDERS, payload)

    await r.xadd(
        STREAM_EVENTS,
        {
            "order_id": order_id,
            "type": "order.created",
            "service": "gateway",
            "detail": json.dumps({"customer": order.customer, "item_count": len(order.items)}),
            "timestamp": str(time.time()),
        },
    )
    await r.aclose()
    return {"order_id": order_id, "status": "accepted"}


@app.get("/events")
async def stream_events():
    async def event_generator():
        r = get_redis()
        last_id = "$"
        while True:
            try:
                results = await r.xread({STREAM_EVENTS: last_id}, count=10, block=2000)
                if results:
                    for stream_name, messages in results:
                        for msg_id, data in messages:
                            last_id = msg_id
                            yield {"event": "order_event", "data": json.dumps(data)}
            except asyncio.CancelledError:
                await r.aclose()
                return
            except Exception:
                await asyncio.sleep(1)

    return EventSourceResponse(event_generator())


@app.get("/health")
async def health():
    return {"status": "ok"}
