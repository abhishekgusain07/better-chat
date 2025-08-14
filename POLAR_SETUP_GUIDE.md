# Polar Payment Integration Setup Guide

This guide will help you configure Polar payments in your Slashy.ai application.

## Prerequisites

1. **Polar Account**: Sign up at [polar.sh](https://polar.sh)
2. **Database**: Ensure your database is connected and migrations are run
3. **Environment**: Development or production environment ready

## Step 1: Create Polar Products

1. Log in to your Polar dashboard
2. Navigate to **Products** 
3. Create two products:
   - **Pro Plan**: $29/month
   - **Team Plan**: $99/month
4. Note down the **Product IDs** for each plan

## Step 2: Get Polar API Credentials

1. Go to **Settings > API Keys** in Polar dashboard
2. Generate an **Access Token**
3. Generate a **Webhook Secret** for secure webhook handling
4. Copy both values - you'll need them for environment variables

## Step 3: Configure Environment Variables

Create a `.env` file in your project root with these variables:

```bash
# Database (required)
DATABASE_URL="your-database-connection-string"

# Better Auth (required)
BETTER_AUTH_SECRET="your-generated-secret-key-here"

# Frontend URL (required)
NEXT_PUBLIC_FRONTEND_BASE_URL="http://localhost:3000"

# Polar Configuration (required for payments)
POLAR_ACCESS_TOKEN="polar_token_your_access_token_here"
POLAR_WEBHOOK_SECRET="whsec_your_webhook_secret_here"
POLAR_PRO_PRODUCT_ID="your_pro_product_id_here"
POLAR_TEAM_PRODUCT_ID="your_team_product_id_here"
POLAR_SUCCESS_URL="http://localhost:3000/api/polar/success"

# Environment
NODE_ENV="development"
```

## Step 4: Configure Polar Webhooks

1. In Polar dashboard, go to **Settings > Webhooks**
2. Add a new webhook endpoint:
   - **URL**: `https://yourapp.com/api/auth/polar/webhooks` (for production)
   - **URL**: `https://your-ngrok-url.ngrok.io/api/auth/polar/webhooks` (for development)
3. Select these events:
   - `customer.created`
   - `subscription.created`
   - `subscription.updated`
   - `subscription.canceled`
   - `subscription.revoked`
4. Use the webhook secret you generated in Step 2

## Step 5: Run Database Migration

Make sure your database schema is up to date:

```bash
npm run db:generate
npm run db:push
```

## Step 6: Test Your Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Visit the debug page (development only):
   ```
   http://localhost:3000/debug
   ```

3. Check that all requirements are met:
   - ✅ Environment variables are set
   - ✅ Polar API is accessible
   - ✅ User authentication works
   - ✅ Product IDs are configured

## Step 7: Test Payment Flow

1. Sign up/Sign in to your application
2. Go to `/billing` or `/pricing`
3. Click "Upgrade" on a plan
4. You should be redirected to Polar's checkout page
5. Complete a test payment
6. Verify you're redirected back with success message
7. Check that subscription appears in `/billing`

## Troubleshooting

### "Checkout failed to initialize"
- Check that `POLAR_ACCESS_TOKEN` is set correctly
- Verify `POLAR_PRO_PRODUCT_ID` and `POLAR_TEAM_PRODUCT_ID` are correct
- Ensure you're signed in (checkout requires authentication)

### "Payment service unavailable"
- Check your internet connection
- Verify Polar API is accessible (check debug page)
- Confirm your access token has correct permissions

### Webhooks not working
- Make sure webhook URL is publicly accessible
- For development, use ngrok or similar tunneling service
- Verify webhook secret matches your environment variable
- Check that all required webhook events are selected

### Database errors
- Ensure database connection is working
- Run `npm run db:push` to apply latest schema
- Check that subscription table exists

## Development vs Production

### Development Setup
- Use `sandbox` mode in Polar
- Use ngrok for webhook testing
- Test with Polar's test cards

### Production Setup
- Use `production` mode in Polar
- Set up proper webhook endpoints
- Use real payment methods
- Enable proper logging and monitoring

## Support

If you encounter issues:

1. Check the debug page: `/debug` (development only)
2. Review console logs for detailed error messages
3. Verify all environment variables are set correctly
4. Test Polar API connectivity
5. Check webhook delivery in Polar dashboard

## Security Notes

- Never commit API keys or secrets to version control
- Use different keys for development and production
- Rotate webhook secrets periodically
- Monitor webhook delivery for suspicious activity
- Enable proper CORS settings for production