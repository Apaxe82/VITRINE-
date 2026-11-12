# Product Requirements Document (PRD): Vitrine Phase 1

> Purpose: Defines the core product problem, target audience, user journeys, functional constraints, and acceptance criteria for Vitrine Phase 1.

## 1. Problem Statement
Informal and semi-formal retail merchants in Angola conduct virtually all business communication over WhatsApp. Creating web catalogs, listing inventory, managing stock, collecting trusted payments (Multicaixa Express), and fulfilling deliveries requires juggling spreadsheets, manual chats, and unverified bank transfer screenshots. Vitrine automates this workflow directly inside WhatsApp without altering existing merchant habits.

## 2. Target Audience
- **Merchants**: Small-to-medium retail vendors in Luanda and provincial capitals selling physical goods (electronics, apparel, cosmetics, packaged food) primarily via WhatsApp.
- **Buyers**: Angolan consumers accessing storefronts via shared links on mobile devices, paying with local currency (Kwanza - AOA) via Multicaixa Express or bank transfer.

## 3. Core Workflow
1. **Photo Upload**: Merchant sends one or more product photos to the Vitrine WhatsApp number.
2. **AI Listing Generation**: Vision AI parses product image to generate draft title, category, description, and suggested price in Kwanza (AOA).
3. **Merchant Approval**: Merchant receives interactive WhatsApp prompt with draft details and approves/edits price. *AI output never auto-publishes*.
4. **Shareable Link**: On approval, listing transitions to `PUBLISHED` and a lightweight mobile link (`/p/:slug`) is generated.
5. **Buyer Order**: Buyer opens link, selects quantity (single-item checkout only in Phase 1), enters recipient details, and places order.
6. **Payment Verification**: Buyer completes payment via Multicaixa Express reference / transfer and uploads or references proof.
7. **Fulfilment**: Merchant receives WhatsApp notification to accept order, prepare package, and dispatch.
8. **Reconciliation**: System marks order completed and updates merchant daily balance and transaction log.

## 4. Phase 1 Boundaries & Non-Goals
- Single-item checkout only (no multi-item cart).
- Physical goods only (no services or bookings).
- No marketplace discovery portal; each store is accessed via direct merchant links.
- No automated autonomous AI sales agents chatting with buyers.
