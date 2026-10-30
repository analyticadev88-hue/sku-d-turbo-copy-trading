# Whop hosted card checkout

The app uses Whop's production API to create a hosted checkout configuration for each order and redirects the customer to its `purchase_url`. Only card payments are enabled. A signed `payment.succeeded` webhook is the source of truth for marking orders paid.

## Set up Whop production

1. In the production Whop dashboard, create a product and a **one-time $13 USD** plan. Copy its `plan_...` ID.
2. Create a production Account API key that can create checkout configurations. Keep it server-side.
3. Create a production webhook pointing to `https://<your-public-domain>/api/payments/webhook`. Subscribe it to `payment.succeeded` and `payment.failed`, then copy its `ws_...` signing secret.
4. Add the values to the server environment:

   ```dotenv
   WHOP_API_KEY=whop_...
   WHOP_PLAN_ID=plan_...
   WHOP_WEBHOOK_SECRET=ws_...
   APP_URL=https://<your-public-domain>
   ```

5. Restart/redeploy the app. Test a checkout with a real production payment method only when ready to accept a live charge.

The checkout route always calls `https://api.whop.com/api/v1`; it does not use sandbox keys or sandbox checkout. Keep the API key and webhook secret server-only. Never prefix them with `NEXT_PUBLIC_`.

The webhook endpoint is `/api/payments/webhook`. Configure this same URL in Whop, and do not mark an order paid based on the redirect/return URL alone.
