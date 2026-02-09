# ST Eventos - Portal de Inscrições

## Overview
ST Eventos is a Brazilian sports event registration platform specializing in running events (marathons, trail runs, road races). It allows athletes to find events, register for races, manage registrations, and maintain athlete profiles. The platform features a mobile-first, athletic design inspired by Strava and Nike Run Club, adapted for the Brazilian market. The business vision is to become the leading registration platform for running events in Brazil, offering a seamless experience for both athletes and event organizers.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework:** React 18 with TypeScript.
- **Build:** Vite.
- **Routing:** Wouter for client-side routing.
- **UI:** shadcn/ui (New York style) built on Radix UI, styled with Tailwind CSS (custom color palette: Navy Blue primary, Yellow accent, Inter font). Mobile-first responsive design.
- **State Management:** TanStack Query for server state, React Hook Form with Zod for form validation, React hooks for local component state.
- **Design System:** Custom CSS variables, elevation system, consistent spacing, shadow system for depth.

### Backend
- **Server:** Express.js on Node.js (ES modules).
- **Data Layer:** Drizzle ORM, PostgreSQL (Neon serverless), schema-first with Drizzle-Zod.
- **Database Schema:** Includes tables for `admin_users`, `organizers`, `events`, `modalities`, `registrations`, `athletes`, `orders`, and more, with defined relationships.
- **User Roles:** `superadmin`, `admin`, `organizador` with role-based permissions.
- **Business Rules:** Mandatory event capacity (`limiteVagasTotal`), optional modality capacity (`limiteVagas`), order-based checkout supporting multiple registrations, payment at order level, batch auto-switching, and atomic shirt inventory decrement.
- **Batch Status System:** Registration batches use `status` field ('active'/'closed'/'future') for business logic and `ativo` boolean for visibility. Only one batch can have status='active' per event. Status changes are enforced through dedicated routes (/activate, /close, /set-future), not the generic PATCH endpoint. See `docs/lotes-status-e-visibilidade.md` for details.
- **Batch Deletion:** Batches with registrations (quantidadeUtilizada > 0) cannot be deleted. The API returns BATCH_HAS_REGISTRATIONS error code with a user-friendly message suggesting to close or deactivate instead.
- **Event Publishing:** When activating a batch in a non-published event, the API returns eventNeedsPublish flag. The admin UI shows a dialog asking if the user wants to publish the event along with activating the batch.
- **Development Infrastructure:** In-memory storage fallback for development, HMR via Vite, separate build outputs for client and server.

### Timezone Handling
- All operations adhere to São Paulo timezone (America/Sao_Paulo, UTC-3).
- Timestamps stored in UTC in the database, converted to São Paulo local time for API input/output using `date-fns-tz`.

### Key Architectural Decisions
- **Path Aliasing:** `@/*` for client, `@shared/*` for shared types/schemas, `@assets/*` for media.
- **Type Safety:** Shared Drizzle-Zod schemas, TypeScript strict mode, runtime validation.
- **Session Management:** Express sessions with PostgreSQL store, cookie-based authentication.
- **Build Process:** Vite for client, esbuild for server.

## External Dependencies

### Core Libraries
- `@neondatabase/serverless`: Neon PostgreSQL serverless driver.
- `drizzle-orm`, `drizzle-kit`: ORM and schema management.

### UI & Utilities
- `@radix-ui/*`: Accessible UI primitives.
- `@tanstack/react-query`: Server state management.
- `react-hook-form`, `@hookform/resolvers`, `zod`: Form management and validation.
- `date-fns`, `date-fns-tz`: Date formatting and timezone handling.

### Styling
- `tailwindcss`: Utility-first CSS.
- `class-variance-authority`, `tailwind-merge`, `clsx`: Component styling and class merging.

### Development Tools
- `@replit/vite-plugin-*`: Replit-specific enhancements.
- `tsx`: TypeScript execution.
- `esbuild`: Production server bundling.

### Design Assets
- Google Fonts (Inter).
- Generated running/marathon images (`attached_assets/generated_images/`).

## Recent Changes (December 2024)

### Voucher & Coupon System
Complete implementation of the voucher system as documented in `docs/MODALIDADE_VOUCHER.md`:

- **Immediate Voucher Validation**: Voucher codes are validated immediately on the modality selection page with real-time feedback (success/error states)
- **Voucher Audit Trail**: Admin panel shows detailed usage information including user ID, timestamps, and associated registration IDs
- **Batch Validity Updates**: Admins can update validity dates for entire voucher batches at once
- **CSV Export**: One-click export of all vouchers to CSV format with status, batch info, and usage details
- **Search & Filter**: Real-time search by code and filter by status (available, used, expired) for vouchers list
- **Bulk Coupon Creation**: Create multiple discount coupons at once with the same settings, supporting both manual code entry and automatic code generation (1-1000 codes)
- **Global Code Uniqueness**: Voucher and coupon codes are validated to be unique across both systems per event
- **Improved Error Handling**: Frontend now correctly distinguishes HTTP 404/409/422 as business logic errors (showing specific messages from backend) vs network errors
- **Voucher Modality Display**: Voucher-type modalities with zero value correctly show as "Gratuito" and are always selectable (not blocked)

### PIX Payment System (January 2025)
Complete refactoring of PIX payment handling to fix critical issues:

- **PIX Reuse**: When user switches payment method (PIX → Card → PIX), the original PIX code is reused instead of generating a new one. Uses dedicated `pixPaymentId` field to track PIX payment ID separately from `idPagamentoGateway`
- **Synchronized Expiration**: When PIX is created, `dataExpiracao` of the order is updated to match PIX expiration (30 minutes). This ensures the order timer and PIX timer are synchronized
- **Expiration Job Protection**: The order expiration job now checks for valid PIX before canceling. Orders with active PIX are never auto-canceled, and their expiration is extended to match PIX validity
- **Flexible PIX Creation**: If order timer expired but no PIX was created yet, user can still choose PIX and a new deadline will be established based on PIX expiration
- **Change Method Preservation**: Switching payment methods no longer clears PIX data, allowing reuse when returning to PIX
- **Database Field**: New `pix_payment_id` column in orders table stores PIX payment ID independently

### Status Change Audit Logging (January 2025)
Complete audit trail system for all status changes:

- **status_change_logs table**: Records entity type (event/order/registration), old/new status, reason, changed by (system/admin/athlete), timestamp, and JSON metadata
- **logStatusChange utility**: Centralized service in `server/services/status-log-service.ts` for consistent logging across the application
- **Instrumented locations**:
  - `recalculateBatchesForEvent`: Logs when events automatically change to 'esgotado' (capacity full or no valid batches)
  - `order-expiration-job`: Logs when orders expire and registrations are cancelled
  - `confirmPaymentAtomic`: Logs when payments are confirmed and registrations are activated
  - `admin/events.ts`: Logs manual status changes by administrators
- **Debugging benefit**: Full audit trail helps identify why events/orders/registrations changed status unexpectedly

### Shirt Size Price Adjustment (January 2026)
Flexible pricing based on shirt size selection:

- **Price Adjustment Field**: Each shirt size now has an `ajustePreco` field that can be positive (surcharge for special sizes) or negative (discount for "sem camisa")
- **Dynamic UI Display**: Inscription page shows price adjustments next to each size button (green for discounts, orange for surcharges)
- **Real-time Total Calculation**: Total price updates instantly when user selects different sizes
- **Backend Calculation**: `registration-service` applies the size adjustment when calculating the registration unit price, ensuring final value is never negative (Math.max(0, basePrice + adjustment))
- **Use Cases**: 
  - "Sem camisa" with -R$25 discount for athletes who don't want a shirt
  - "GG", "EG", "EGG" with +R$10 surcharge for special sizes
- **Documentation**: Full implementation details in `docs/IMPLEMENTACAO_SEM_CAMISA.md`

### Enhanced Reports System (January 2026)
Comprehensive reports with financial details and export capabilities:

- **Registration Report Enhancements**: Added order number, batch, discount amount, coupon/voucher codes, payment method, order status, and payment date columns
- **New Orders Report**: Dedicated reports for Admin (`/admin/eventos/:id/pedidos`) and Organizer (`/organizadores/evento/:id/pedidos`) with:
  - Filter by status (all/paid/pending/cancelled)
  - Financial summary (bruto, descontos, taxa comodidade, líquido)
  - Excel export with totals row
  - Fields: order number, buyer info, status, dates, subtotal, discount, coupon code, convenience fee, total, net value, payment method, gateway ID
- **Totals Row**: Both reports include a totals row at the end calculated from confirmed/paid records only
- **NaN Protection**: safeNumber() helper prevents NaN in legacy data with null/empty numeric fields
- **Portuguese Accents**: All user-facing text properly accented (inscrição, alteração, histórico, Cartão de Crédito, etc.)