const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Environment variables
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'API is running!',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/apply-credits',
      'POST /api/cancel-credits',
      'POST /api/order-webhook'
    ]
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'API is working!',
    timestamp: new Date().toISOString()
  });
});

// =====================================
// APPLY CREDITS ENDPOINT
// =====================================
app.post('/api/apply-credits', async (req, res) => {
  try {
    const { creditAmount, userId, cartItems } = req.body;

    // Validate input
    if (!creditAmount || !userId || !cartItems) {
      return res.status(400).json({ 
        error: 'Missing required fields: creditAmount, userId, cartItems' 
      });
    }

    // Initialize Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Step 1: Verify user has enough credits
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits, email')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (profile.credits < creditAmount) {
      return res.status(400).json({ 
        error: 'Insufficient credits',
        available: profile.credits,
        requested: creditAmount
      });
    }

    // Step 2: Create unique discount code
    const discountCode = `CREDIT-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Step 3: Create Shopify discount code
    const discountResponse = await fetch(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2025-01/price_rules.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
        },
        body: JSON.stringify({
          price_rule: {
            title: `Store Credit - ${creditAmount}`,
            target_type: 'line_item',
            target_selection: 'all',
            allocation_method: 'across',
            value_type: 'fixed_amount',
            value: `-${creditAmount}`,
            customer_selection: 'all',
            once_per_customer: true,
            usage_limit: 1,
            starts_at: new Date().toISOString()
          }
        })
      }
    );

    if (!discountResponse.ok) {
      const errorText = await discountResponse.text();
      console.error('Shopify API Error:', errorText);
      throw new Error('Failed to create discount in Shopify');
    }

    const { price_rule } = await discountResponse.json();

    // Step 4: Create discount code
    const codeResponse = await fetch(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2025-01/price_rules/${price_rule.id}/discount_codes.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
        },
        body: JSON.stringify({
          discount_code: {
            code: discountCode
          }
        })
      }
    );

    if (!codeResponse.ok) {
      throw new Error('Failed to create discount code');
    }

    // Step 5: Record transaction as "pending" (DON'T deduct credits yet!)
    // Credits will only be deducted after successful payment (webhook)
    await supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: creditAmount,
        type: 'debit',
        status: 'pending',
        discount_code: discountCode,
        price_rule_id: price_rule.id.toString(),
        description: `Reserved $${creditAmount} store credit`
      });

    // Success! (Note: user's balance NOT changed yet)
    return res.status(200).json({
      success: true,
      discountCode: discountCode,
      discountAmount: creditAmount,
      newBalance: profile.credits, // Balance unchanged - credits only reserved
      priceRuleId: price_rule.id
    });

  } catch (error) {
    console.error('Error applying credits:', error);
    return res.status(500).json({ 
      error: 'Failed to apply credits',
      message: error.message 
    });
  }
});

// =====================================
// CANCEL CREDITS ENDPOINT
// =====================================
app.post('/api/cancel-credits', async (req, res) => {
  try {
    const { userId, discountCode, priceRuleId } = req.body;

    if (!userId || !discountCode) {
      return res.status(400).json({ error: 'Missing userId or discountCode' });
    }

    // Initialize Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Find pending transaction
    const { data: transaction, error: findError } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('discount_code', discountCode)
      .eq('status', 'pending')
      .single();

    if (findError || !transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // No need to restore credits - they were never deducted!
    // Credits were only "reserved", not actually taken from balance

    // Cancel transaction
    await supabase
      .from('credit_transactions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('id', transaction.id);

    // Delete Shopify discount (optional cleanup)
    if (priceRuleId) {
      try {
        await fetch(
          `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2025-01/price_rules/${priceRuleId}.json`,
          {
            method: 'DELETE',
            headers: {
              'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
            }
          }
        );
      } catch (error) {
        console.error('Failed to delete price rule:', error);
      }
    }

    return res.status(200).json({
      success: true,
      restoredAmount: transaction.amount,
      newBalance: restoredBalance
    });

  } catch (error) {
    console.error('Error canceling credits:', error);
    return res.status(500).json({ 
      error: 'Failed to cancel credits',
      message: error.message 
    });
  }
});

// =====================================
// ORDER WEBHOOK ENDPOINT
// =====================================
app.post('/api/order-webhook', async (req, res) => {
  try {
    // Verify webhook
    console.warn("order-webhook endpoint hit");
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    const rawBody = JSON.stringify(req.body);
    
    const hash = crypto
      .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
      .update(rawBody, 'utf8')
      .digest('base64');
    
    if (hash !== hmacHeader) {
      console.error('Webhook verification failed');
      console.error('Expected hash:', hash);
      console.error('Received HMAC:', hmacHeader);
      return res.status(401).json({ 
        error: 'Unauthorized',
        debug: {
          receivedHMAC: hmacHeader ? 'present' : 'missing',
          timestamp: new Date().toISOString()
        }
      });
    }

    const order = req.body;

    // Check if order used credit discount
    const discountCodes = order.discount_codes || [];
    const creditDiscount = discountCodes.find(dc => 
      dc.code && dc.code.startsWith('CREDIT-')
    );

    if (!creditDiscount) {
      return res.status(200).json({ message: 'No credits used' });
    }

    const discountCode = creditDiscount.code;

    // Initialize Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Find transaction
    const { data: transaction } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('discount_code', discountCode)
      .eq('status', 'pending')
      .single();

    if (!transaction) {
      return res.status(200).json({ message: 'Transaction already processed' });
    }

    // NOW deduct credits from user's balance (payment confirmed!)
    const { data: profile } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', transaction.user_id)
      .single();

    if (profile) {
      const newBalance = profile.credits - transaction.amount;
      await supabase
        .from('profiles')
        .update({ credits: newBalance })
        .eq('id', transaction.user_id);
    }

    // Finalize transaction
    await supabase
      .from('credit_transactions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        order_id: order.id.toString(),
        order_number: order.order_number
      })
      .eq('id', transaction.id);

    console.log(`✅ Credits finalized for order #${order.order_number}`);

    return res.status(200).json({
      success: true,
      message: 'Credits finalized and deducted',
      orderId: order.id
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ 
      error: 'Webhook processing failed',
      message: error.message 
    });
  }
});

// =====================================
// CLEANUP OLD PENDING TRANSACTIONS
// =====================================
app.post('/api/cleanup-pending', async (req, res) => {
  try {
    // Find all pending transactions older than 24 hours
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: oldTransactions } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('status', 'pending')
      .lt('created_at', twentyFourHoursAgo.toISOString());

    if (oldTransactions && oldTransactions.length > 0) {
      // Cancel old pending transactions
      await supabase
        .from('credit_transactions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString()
        })
        .eq('status', 'pending')
        .lt('created_at', twentyFourHoursAgo.toISOString());

      console.log(`🧹 Cleaned up ${oldTransactions.length} old pending transactions`);

      return res.status(200).json({
        success: true,
        message: `Cancelled ${oldTransactions.length} abandoned reservations`,
        transactions: oldTransactions.length
      });
    }

    return res.status(200).json({
      success: true,
      message: 'No old pending transactions to clean up',
      transactions: 0
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return res.status(500).json({ 
      error: 'Cleanup failed',
      message: error.message 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;

