# Webhooks and API Specification: Vitrine

> Purpose: Specifies inbound and outbound webhook contracts, security verification, and public API interfaces for Vitrine.

## 1. Webhook Endpoints
- **`GET /webhooks/whatsapp`**: Webhook verification handshake for Meta / WhatsApp Cloud API using `hub.mode`, `hub.verify_token`, and `hub.challenge`.
- **`POST /webhooks/whatsapp`**: Inbound payload ingestion (messages, image attachments, button clicks, list replies). Validates `X-Hub-Signature-256`.
- **`POST /webhooks/payments`**: Inbound payment settlement notification from Angolan payment gateways or Multicaixa Express aggregators. Validated via HMAC signature.

## 2. Public Storefront & Health APIs
- **`GET /health` / `GET /api/health`**: System liveness and readiness check reporting service uptime and component statuses.
- **`GET /api/p/:slug`**: Public metadata and stock status for a published single-item listing.
- **`POST /api/orders`**: Ingests new buyer order for a published listing (single-item checkout only).
- **`POST /api/orders/:id/payment-proof`**: Uploads payment proof image / reference for manual or OCR verification.
