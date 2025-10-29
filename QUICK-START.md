# 🚀 Quick Start Guide (5 Minutes)

Follow these steps to get your credits system running ASAP!

---

## Step 1: Setup Supabase (2 min)

1. Go to [supabase.com](https://supabase.com) → Create project
2. Open **SQL Editor**
3. Copy & paste contents of `supabase-schema.sql`
4. Click **RUN**
5. Go to **Settings → API** → Copy:
   - Project URL
   - Service role key

✅ Done!

---

## Step 2: Setup Shopify API (2 min)

1. **Shopify Admin → Settings → Apps and sales channels**
2. Click **"Develop apps"** → **"Create an app"**
3. Name: **"Credits System"**
4. **Configuration** → Enable these scopes:
   - ✅ `write_price_rules`
   - ✅ `write_discounts`
   - ✅ `read_orders`
5. Click **"Install app"**
6. **Copy the Admin API access token** (starts with `shpat_`)

✅ Done!

---

## Step 3: Deploy Backend (1 min)

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Go to project
cd d:/projects/shopify

# Deploy
vercel
```

When prompted:
- **Link to existing project?** No
- **Project name:** shopify-credits-api
- Press Enter for everything else

After deployment, your URL will be: `https://shopify-credits-api.vercel.app`

✅ Done!

---

## Step 4: Add Environment Variables (1 min)

In your terminal:

```bash
vercel env add SHOPIFY_STORE_DOMAIN
# Enter: your-store.myshopify.com

vercel env add SHOPIFY_ACCESS_TOKEN
# Paste the shpat_xxx token from Step 2

vercel env add SUPABASE_URL
# Paste from Supabase Settings → API

vercel env add SUPABASE_SERVICE_KEY
# Paste service_role key from Supabase

vercel env add SHOPIFY_WEBHOOK_SECRET
# Enter anything for now, we'll update in Step 6
```

For each, select: **All environments** (press `a` then Enter)

Redeploy:
```bash
vercel --prod
```

✅ Done!

---

## Step 5: Update Liquid File (1 min)

1. Open `New Text Document.liquid`
2. Find line 433:
```javascript
const BACKEND_API_URL = 'https://your-domain.vercel.app/api';
```
3. Replace `your-domain` with your actual Vercel URL
4. Save and upload to Shopify theme

✅ Done!

---

## Step 6: Setup Webhook (1 min)

1. **Shopify Admin → Settings → Notifications**
2. Scroll to **Webhooks** → **Create webhook**
3. Configure:
   - **Event:** Order payment
   - **Format:** JSON
   - **URL:** `https://your-domain.vercel.app/api/order-webhook`
   - **API version:** Latest
4. Save → **Copy the webhook signing secret**
5. Update in Vercel:
```bash
vercel env add SHOPIFY_WEBHOOK_SECRET
# Paste the secret
# Select: All environments

vercel --prod
```

✅ Done!

---

## Step 7: Test It! (1 min)

### Add credits to test user

1. Go to Supabase → **SQL Editor**
2. Run:
```sql
-- First, sign up a user in your Shopify store or via Supabase Auth
-- Then add credits:
UPDATE profiles 
SET credits = 50.00 
WHERE email = 'your-test-email@example.com';
```

### Test on Shopify

1. Add items to cart
2. Click **"Use Credits"**
3. Login with test user
4. Enter $10
5. Verify cart total reduced by $10! 🎉

---

## 🎉 You're Live!

**Total time:** ~8 minutes

**Your credit system is now working with:**
- ✅ Dynamic discount codes
- ✅ Real-time balance updates
- ✅ All Shopify checkout methods
- ✅ Automatic cleanup after purchase

---

## 🆘 Need Help?

**Problem:** API not working
- Check: `vercel logs` to see errors
- Verify: All 5 environment variables are set

**Problem:** Discount not applying
- Check: Browser console for errors
- Verify: `BACKEND_API_URL` in Liquid file is correct

**Problem:** Webhook not firing
- Check: Shopify Admin → Webhooks → Recent deliveries
- Verify: Webhook secret matches in Vercel

---

## 📚 Next Steps

- Read [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md) for advanced setup
- Read [README.md](README.md) for full documentation
- Check `supabase-schema.sql` for database structure

---

**That's it! You're ready to go! 🚀**

