# Event-Driven Order Processing

A live demo of an event-driven microservices architecture using **Redis Streams**, **FastAPI**, and **React**.

## Architecture

```
┌─────────────┐      ┌───────────────┐      ┌─────────────────┐
│  React UI   │─────▶│ FastAPI       │─────▶│ Redis Streams   │
│  (Vite)     │◀─SSE─│ Gateway       │      │ (orders/events) │
└─────────────┘      └───────────────┘      └────────┬────────┘
                                                     │
                                   ┌─────────────────┼─────────────────┐
                                   ▼                 ▼                 ▼
                           ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
                           │  Inventory   │  │   Payment    │  │  Shipment    │
                           │  Service     │──▶  Service     │──▶  Service     │
                           └──────────────┘  └──────────────┘  └──────────────┘
```

### Event Flow

1. User submits an order via the React UI
2. Gateway publishes the order to the `orders` Redis Stream
3. **Inventory Service** consumes the order, reserves stock, publishes `inventory.reserved`
4. **Payment Service** picks up that event, processes payment, publishes `payment.processed`
5. **Shipment Service** picks up that event, creates a shipment, publishes `shipment.created`
6. The React UI receives all events in real time via SSE (Server-Sent Events)

## Tech Stack

| Component     | Technology              |
|---------------|-------------------------|
| Frontend      | React + TypeScript (Vite) |
| Gateway       | Python FastAPI          |
| Broker        | Redis Streams           |
| Microservices | Python (redis-py)       |
| Orchestration | Docker Compose          |

## Quick Start

### Prerequisites

- Docker and Docker Compose installed

### Run

```bash
docker-compose up --build
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

### Stop

```bash
docker-compose down
```

## Project Structure

```
EventBased/
├── docker-compose.yml          # Orchestrates all services
├── gateway/
│   └── main.py                 # FastAPI: POST /orders + SSE /events
├── services/
│   ├── inventory/main.py       # Consumes orders → publishes inventory.reserved
│   ├── payment/main.py         # Consumes inventory.reserved → publishes payment.processed
│   └── shipment/main.py        # Consumes payment.processed → publishes shipment.created
└── frontend/
    └── src/App.tsx             # React UI with order form + live event feed
```

## Demo Script

1. **Show the architecture** - explain the event flow and Redis Streams
2. **Start everything** - `docker-compose up --build`
3. **Submit an order** - open the UI, add products, submit
4. **Watch events flow** - see the timeline update in real time
5. **View logs** - `docker-compose logs -f` to see each service processing
6. **Kill a service** - `docker-compose stop shipment`, submit another order, show it stalls
7. **Bring it back** - `docker-compose start shipment`, watch it pick up the pending event
8. **Inspect Redis** - `docker exec -it eventbased-redis-1 redis-cli XRANGE events - +`

## Key Concepts Demonstrated

- **Event-driven architecture**: Services communicate through events, not direct calls
- **Redis Streams**: Durable message queue with consumer groups for reliable delivery
- **Loose coupling**: Each service only knows about the events it consumes and produces
- **Resilience**: Services can go down and recover without losing messages
- **Real-time visibility**: SSE provides live updates to the frontend
