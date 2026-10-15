# Modelry

**See what happens inside AI.**

Modelry is an interactive AI laboratory where developers experiment with language models, understand their behavior, and learn how AI-powered software actually works. Built on Next.js App Router, tRPC, Better Auth, Drizzle, and Neon.

## What is implemented

- Public-user auth now defaults new signups to the `customer` role.
- The backend data model now includes:
  - `chat_thread`
  - `chat_message`
  - `chat_attachment`
  - `credit_wallet`
  - `credit_ledger`
  - `usage_event`
  - `subscription_plan`
  - `subscription`
  - `payment_event`
  - `background_job_run`
- tRPC routers now include:
  - `viewer`
  - `chat`
  - `credits`
  - `billing`
  - `attachments`
  - `analytics`
- The `/api/ai/chat` route is now authenticated, thread-aware, credit-aware, and persistence-ready.
- Arcjet protection now covers the AI chat route, upload route, and tRPC mutation surface.
- Starter credits are granted idempotently on first authenticated usage/session hydration.

## Current backend flow

1. User signs in with Better Auth.
2. A wallet is created automatically if it does not exist.
3. Starter credits are granted once through the credit ledger.
4. A chat thread is created on demand or an existing owned thread is reused.
5. The latest user message is persisted.
6. Credits are reserved before the model call starts.
7. The assistant placeholder message is created.
8. The AI route streams a response from Ollama.
9. When the stream finishes, the assistant message is finalized and credit settlement is recorded.
10. Usage analytics are written for chat lifecycle events.

## Routes and API surface

### App routes

- `/chat`
- `/chat/[threadId]`
- `/studio` for internal staff/admin workspace
- `/account` for profile/security and future billing surfaces

### API routes

- `/api/ai/chat`
- `/api/v1/trpc/*` through the app router

### tRPC namespaces

- `viewer.session`
- `chat.list`
- `chat.get`
- `chat.create`
- `chat.rename`
- `chat.delete`
- `credits.wallet`
- `credits.ledger`
- `billing.plans`
- `billing.subscription`
- `billing.payments`
- `attachments.finalize`
- `attachments.byThread`
- `attachments.delete`
- `analytics.summary`

## Environment variables

Copy `.env.example` to `.env.local` and fill in real values.

### Core

- `NODE_ENV`
- `PORT`
- `NEXT_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_API_URL`
- `VERCEL_URL`
- `USE_DEBUG_LOGS`

### Auth

- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

### Database and storage

- `DATABASE_URL`
- `BLOB_READ_WRITE_TOKEN`

### Security

- `ARKJET_API_KEY`

### AI

- `AI_PROVIDER`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`

### Credits

- `STARTER_CREDITS`
- `CHAT_RESERVE_MIN_CREDITS`
- `CHAT_RESERVE_RATIO`
- `SUBSCRIPTION_MONTHLY_CREDITS`

### Uploads

- `MAX_UPLOAD_FILE_SIZE_BYTES`
- `MAX_UPLOAD_FILES_PER_MESSAGE`

### Billing and jobs

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`

## Local development

1. Install dependencies.
2. Start Neon/Postgres and set `DATABASE_URL`.
3. Run Ollama locally and pull the configured model.
4. Generate and run Drizzle migrations for the new schema.
5. Start the Next.js app.
6. Sign in and open `/chat`.

## Important notes

- The schema is implemented in code, but you still need to generate and apply Drizzle migrations for a real database.
- Billing, webhooks, Inngest jobs, and production provider switching are scaffolded at the API/domain level but intentionally not fully integrated yet.
- The current token accounting uses a lightweight estimator so the backend contract is in place before the dedicated tokenizer package is introduced.

## Suggested next backend steps

1. Generate and apply migrations for the new tables.
2. Connect the `/chat` UI to `chat.*` and `viewer.session` instead of mock state.
3. Add real file-upload finalization from the chat composer.
4. Replace token estimation with `gpt-tokenizer`.
5. Implement Razorpay checkout and webhook handling.
6. Add Inngest jobs for refill cycles, recalculation, and aggregation.

