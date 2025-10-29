# 💳 Shopify Credits System with Draft Order API

A complete solution for applying store credits as dynamic Shopify discounts. Works with **ALL checkout methods** including Google Pay, Apple Pay, and Shop Pay!

---

## ✨ Features

- ✅ **Dynamic Discount Codes** - Created on-the-fly via Shopify Admin API
- ✅ **1:1 Credit Rate** - 1 credit = $1 USD
- ✅ **Real-time Balance Updates** - Stored in Supabase
- ✅ **Auto-clear After Payment** - Credits removed from cart display after checkout
- ✅ **Express Checkout Support** - Works with all Shopify payment methods
- ✅ **Transaction Tracking** - Full audit trail in Supabase
- ✅ **Webhook Integration** - Finalizes credits after successful payment

---

## 🏗️ Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  Shopify Cart   │ ───> │  Backend API     │ ───> │    Supabase     │
│  (Liquid File)  │      │  (Vercel/Railway)│      │   (Database)    │
└─────────────────┘      └──────────────────┘      └─────────────────┘
         │                        │                          │
         │                        ↓                          │
         │               ┌──────────────────┐               │
         └─────────────> │  Shopify Admin   │ <─────────────┘
                         │   (Discounts)    │
                         └──────────────────┘
                                  │
                                  ↓
                         ┌──────────────────┐
                         │  Order Webhook   │
                         │   (Finalize)     │
                         └──────────────────┘
```

---

## 📁 Project Structure

```
shopify/
├── api/
│   ├── apply-credits.js      # Create discount & deduct credits
│   ├── cancel-credits.js     # Restore credits if cancelled
│   └── order-webhook.js      # Finalize after payment
├── New Text Document.liquid  # Shopify cart page template
├── supabase-schema.sql       # Database schema
├── package.json              # Node.js dependencies
├── vercel.json              # Vercel deployment config
├── DEPLOYMENT-GUIDE.md      # Full deployment instructions
└── README.md                # This file
```

---

## 🚀 Quick Start

### 1. **Setup Supabase Database**

Run `supabase-schema.sql` in your Supabase SQL Editor.

### 2. **Deploy Backend API**

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
cd d:/projects/shopify
vercel
```

### 3. **Configure Environment Variables**

In Vercel Dashboard or via CLI:

```bash
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxx
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key
```

### 4. **Update Liquid File**

Change line 433 in `New Text Document.liquid`:
```javascript
const BACKEND_API_URL = 'https://your-domain.vercel.app/api';
```

### 5. **Setup Shopify Webhook**

**Shopify Admin → Settings → Notifications → Webhooks**
- Event: **Order payment**
- URL: `https://your-domain.vercel.app/api/order-webhook`

---

## 📖 Detailed Documentation

See **[DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md)** for:
- ✅ Complete setup instructions
- ✅ Shopify API configuration
- ✅ Environment variables
- ✅ Testing procedures
- ✅ Troubleshooting guide

---

## 🎯 How It Works

### User Flow

1. **User adds items to cart** ($100 total)
2. **User clicks "Use Credits"** button
3. **User logs in** with Supabase credentials
4. **User sees available credits** (e.g., $50)
5. **User enters amount** to use (e.g., $25)
6. **System creates discount code** (`CREDIT-1730123456-abc123`)
7. **Discount applied to cart** ($100 - $25 = $75)
8. **User completes checkout** with any payment method
9. **Webhook finalizes transaction** in database
10. **Credits display cleared** from cart page ✓

### Technical Flow

```javascript
// Frontend (Liquid)
applyCreditsViaAPI(25) 
  → POST /api/apply-credits
  
// Backend API
→ Verify user has 25 credits
→ Create Shopify price rule (-$25)
→ Create discount code (CREDIT-xxx)
→ Deduct 25 from user balance
→ Record transaction (status: pending)
→ Return discount code

// Frontend
→ Apply discount to cart
→ Redirect to cart with discount

// After Payment
→ Shopify sends webhook
→ POST /api/order-webhook
→ Mark transaction as completed
→ Log order details
```

---

## 💰 Environment Variables

Create these in your hosting platform:

| Variable | Description | Example |
|----------|-------------|---------|
| `SHOPIFY_STORE_DOMAIN` | Your Shopify store URL | `mystore.myshopify.com` |
| `SHOPIFY_ACCESS_TOKEN` | Admin API access token | `shpat_xxxxx` |
| `SHOPIFY_WEBHOOK_SECRET` | Webhook signing secret | `your_secret` |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Service role key | `eyJxxx...` |

---

## 🧪 Testing

### Add Credits to Test User

```sql
-- In Supabase SQL Editor
UPDATE profiles 
SET credits = 100.00 
WHERE email = 'test@example.com';
```

### View Transaction History

```sql
SELECT * FROM credit_transactions 
WHERE user_id = 'user-uuid' 
ORDER BY created_at DESC;
```

### Test API Endpoint

```bash
curl -X POST https://your-domain.vercel.app/api/apply-credits \
  -H "Content-Type: application/json" \
  -d '{
    "creditAmount": 10,
    "userId": "test-user-id",
    "cartItems": []
  }'
```

---

## 🔐 Security

- ✅ Webhook signature verification
- ✅ Row-level security (RLS) on Supabase
- ✅ Service role key for backend only
- ✅ CORS enabled for Shopify domain
- ✅ Transaction audit trail

---

## 🌍 Supported Platforms

### Recommended (Free Tier)
- **Vercel** ⭐ (Easiest deployment)
- **Railway** (Great for Node.js)
- **Render** (Good free tier)

### Also Supported
- Netlify Functions
- Cloudflare Workers
- Any Node.js hosting

---

## 🐛 Common Issues

### Discount Not Applying
- Check `BACKEND_API_URL` in Liquid file
- Verify API endpoint is accessible
- Check browser console for errors

### Webhook Not Working
- Verify webhook URL is correct
- Check webhook secret is set
- View delivery logs in Shopify Admin

### Credits Not Deducting
- Verify Supabase service key
- Check user has sufficient credits
- View transaction logs in Supabase

---

## 📊 Database Schema

### `profiles` table
- `id` - User UUID (links to auth.users)
- `email` - User email
- `credits` - Available credits (decimal)
- `created_at` - Account creation
- `updated_at` - Last update

### `credit_transactions` table
- `id` - Transaction UUID
- `user_id` - User reference
- `amount` - Transaction amount
- `type` - 'credit' or 'debit'
- `status` - 'pending', 'completed', 'cancelled'
- `discount_code` - Generated code
- `order_id` - Shopify order ID (after payment)
- `created_at` / `completed_at` / `cancelled_at`

---

## 🎓 API Endpoints

### `POST /api/apply-credits`
Apply credits to cart by creating Shopify discount.

**Request:**
```json
{
  "creditAmount": 25,
  "userId": "uuid",
  "cartItems": []
}
```

**Response:**
```json
{
  "success": true,
  "discountCode": "CREDIT-1730123456-abc",
  "discountAmount": 25,
  "newBalance": 75,
  "priceRuleId": 123456
}
```

### `POST /api/cancel-credits`
Cancel pending transaction and restore credits.

**Request:**
```json
{
  "userId": "uuid",
  "discountCode": "CREDIT-xxx",
  "priceRuleId": "123456"
}
```

### `POST /api/order-webhook`
Shopify webhook to finalize transaction after payment.

**Triggered by:** Order payment event in Shopify

---

## 📝 License

MIT License - Feel free to use and modify!

---

## 🤝 Support

Need help? Check:
1. [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md) - Full setup instructions
2. Vercel logs: `vercel logs`
3. Supabase logs in dashboard
4. Shopify webhook delivery logs

---

## 🎉 Credits

Built with:
- Shopify Admin API
- Supabase (Auth & Database)
- Vercel (Serverless Functions)
- Node.js

---

**Made with ❤️ for Shopify merchants**

