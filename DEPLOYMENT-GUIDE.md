# 🚀 Deployment Guide - Shopify Credits System

## Overview
This guide will help you deploy the backend API for the Shopify Credits System using **Vercel** (recommended) or other platforms.

---

## 📋 Prerequisites

1. ✅ Shopify store with Admin API access
2. ✅ Supabase account and project
3. ✅ Vercel account (free tier is fine)
4. ✅ Node.js 18+ installed locally (for testing)

---

## 🎯 Step 1: Supabase Setup

### 1.1 Run Database Schema

1. Go to your Supabase project
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase-schema.sql`
4. Run the query
5. Verify tables are created: `profiles` and `credit_transactions`

### 1.2 Get Supabase Credentials

Go to **Settings → API** and copy:
- **Project URL** (e.g., `https://xxxxx.supabase.co`)
- **Service Role Key** (⚠️ Keep this secret!)

---

## 🔑 Step 2: Shopify API Setup

### 2.1 Create Custom App

1. Go to **Shopify Admin → Settings → Apps and sales channels**
2. Click **"Develop apps"**
3. Click **"Create an app"**
4. Name it: **"Credits System API"**

### 2.2 Configure API Scopes

Go to **Configuration → Admin API access scopes** and enable:

✅ `write_price_rules` - Create discount codes
✅ `read_price_rules` - Read discount codes  
✅ `write_discounts` - Manage discount codes
✅ `read_discounts` - Read discount codes
✅ `read_orders` - Read order data (for webhook)
✅ `read_customers` - Read customer data

### 2.3 Install App & Get Token

1. Click **"Install app"**
2. Copy the **Admin API access token** (starts with `shpat_`)
3. ⚠️ **Save this securely** - you won't see it again!

### 2.4 Get Store Domain

Your store domain format: `your-store.myshopify.com`

---

## ☁️ Step 3: Deploy to Vercel (Recommended)

### 3.1 Install Vercel CLI

```bash
npm install -g vercel
```

### 3.2 Login to Vercel

```bash
vercel login
```

### 3.3 Deploy Project

Navigate to your project folder:

```bash
cd d:/projects/shopify
vercel
```

Follow the prompts:
- **Set up and deploy?** Yes
- **Scope:** Your account
- **Link to existing project?** No
- **Project name:** shopify-credits-api
- **Directory:** ./
- **Override settings?** No

### 3.4 Add Environment Variables

After deployment, add environment variables:

```bash
vercel env add SHOPIFY_STORE_DOMAIN
vercel env add SHOPIFY_ACCESS_TOKEN
vercel env add SHOPIFY_WEBHOOK_SECRET
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_KEY
```

For each variable:
1. Enter the value when prompted
2. Select: **Production**, **Preview**, and **Development**

Or add them via Vercel Dashboard:
1. Go to your project on Vercel
2. Navigate to **Settings → Environment Variables**
3. Add all 5 variables

### 3.5 Redeploy

```bash
vercel --prod
```

### 3.6 Get Your API URL

Copy your production URL (e.g., `https://shopify-credits-api.vercel.app`)

---

## 🔔 Step 4: Setup Shopify Webhook

### 4.1 Create Webhook

1. Go to **Shopify Admin → Settings → Notifications**
2. Scroll to **Webhooks**
3. Click **"Create webhook"**

### 4.2 Configure Webhook

- **Event:** Order payment
- **Format:** JSON
- **URL:** `https://your-domain.vercel.app/api/order-webhook`
- **API Version:** Latest

### 4.3 Get Webhook Secret

After creating the webhook, Shopify will show you the webhook signing secret.

**Copy this secret** and add it to Vercel:

```bash
vercel env add SHOPIFY_WEBHOOK_SECRET
```

Then redeploy:

```bash
vercel --prod
```

---

## 🎨 Step 5: Update Liquid File

1. Open your `New Text Document.liquid` file
2. Find line 433:
```javascript
const BACKEND_API_URL = 'https://your-domain.vercel.app/api';
```
3. Replace with your actual Vercel URL
4. Upload the file to your Shopify theme

---

## ✅ Step 6: Test the System

### 6.1 Test Credit Application

1. Create a test user in Supabase
2. Add credits to their account:
```sql
UPDATE profiles 
SET credits = 50.00 
WHERE email = 'test@example.com';
```

3. Add items to your Shopify cart
4. Click **"Use Credits"**
5. Login with test user credentials
6. Apply $10 credit
7. Verify cart total is reduced by $10 ✓

### 6.2 Test Checkout

1. Complete the checkout
2. After payment, check Supabase:
```sql
SELECT * FROM credit_transactions 
WHERE status = 'completed' 
ORDER BY created_at DESC 
LIMIT 1;
```

3. Verify transaction is marked as `completed` ✓

### 6.3 Test Credit Removal

1. Apply credits to cart
2. Click **"Remove"** button
3. Verify credits are restored in Supabase ✓

---

## 🐛 Troubleshooting

### API Not Working

1. Check Vercel logs:
```bash
vercel logs
```

2. Verify environment variables are set:
```bash
vercel env ls
```

### Webhook Not Firing

1. Test webhook in Shopify Admin:
   - Settings → Notifications → Webhooks → Click on your webhook
   - Check recent deliveries

2. Verify webhook URL is correct
3. Check webhook secret is properly set

### Discount Not Applying

1. Check browser console for errors
2. Verify `BACKEND_API_URL` in Liquid file
3. Test API directly:
```bash
curl -X POST https://your-domain.vercel.app/api/apply-credits \
  -H "Content-Type: application/json" \
  -d '{"creditAmount": 10, "userId": "test-id", "cartItems": []}'
```

---

## 🎉 Alternative Platforms

### Railway

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Deploy:
```bash
railway login
railway init
railway up
```

3. Add environment variables in Railway dashboard

### Render

1. Create new **Web Service**
2. Connect your GitHub repo
3. Set build command: `npm install`
4. Set start command: `node api/apply-credits.js`
5. Add environment variables

### Netlify

1. Install Netlify CLI:
```bash
npm install -g netlify-cli
```

2. Deploy:
```bash
netlify deploy --prod
```

3. Add environment variables in Netlify dashboard

---

## 📊 Monitoring

### Check Credit Balances

```sql
SELECT email, credits, updated_at 
FROM profiles 
ORDER BY updated_at DESC;
```

### View Transaction History

```sql
SELECT 
  p.email,
  ct.amount,
  ct.status,
  ct.discount_code,
  ct.order_number,
  ct.created_at
FROM credit_transactions ct
JOIN profiles p ON p.id = ct.user_id
ORDER BY ct.created_at DESC
LIMIT 20;
```

### Calculate Total Credits Used

```sql
SELECT 
  COUNT(*) as total_transactions,
  SUM(amount) as total_credits_used,
  AVG(amount) as avg_transaction
FROM credit_transactions
WHERE status = 'completed' AND type = 'debit';
```

---

## 🔐 Security Notes

1. ⚠️ **Never commit** `.env` file to git
2. ⚠️ Use **service role key** (not anon key) for backend
3. ⚠️ Always verify webhook signatures
4. ⚠️ Keep Shopify access token secure
5. ✅ RLS policies are enabled on Supabase tables

---

## 🎯 Done!

Your Shopify Credits System is now live! 🚀

**Support:** If you encounter issues, check:
- Vercel logs
- Browser console
- Supabase logs
- Shopify webhook delivery logs

