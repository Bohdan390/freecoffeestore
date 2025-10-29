/**
 * SHOPIFY ORDER WEBHOOK - FINALIZE CREDITS
 * 
 * This webhook is triggered when an order is paid.
 * It finalizes the credit transaction and cleans up the discount code.
 * 
 * Setup in Shopify:
 * Admin → Settings → Notifications → Webhooks → Create webhook
 * Event: Order payment
 * Format: JSON
 * URL: https://your-domain.com/api/order-webhook
 */

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// Environment variables
const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Verify Shopify webhook signature
 */
function verifyWebhook(data, hmacHeader) {
  const hash = crypto
    .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
    .update(data, 'utf8')
    .digest('base64');
  
  return hash === hmacHeader;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Step 1: Verify webhook authenticity
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    const rawBody = JSON.stringify(req.body);
    
    if (!verifyWebhook(rawBody, hmacHeader)) {
      console.error('Webhook verification failed');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const order = req.body;

    // Step 2: Check if order used a credit discount code
    const discountCodes = order.discount_codes || [];
    const creditDiscount = discountCodes.find(dc => 
      dc.code && dc.code.startsWith('CREDIT-')
    );

    if (!creditDiscount) {
      // No credit discount used, nothing to do
      return res.status(200).json({ message: 'No credits used' });
    }

    const discountCode = creditDiscount.code;

    // Step 3: Find the transaction in database
    const { data: transaction, error: findError } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('discount_code', discountCode)
      .eq('status', 'pending')
      .single();

    if (findError || !transaction) {
      console.error('Transaction not found:', discountCode);
      // Transaction might already be processed, return success
      return res.status(200).json({ message: 'Transaction already processed' });
    }

    // Step 4: Finalize the transaction (mark as completed)
    const { error: updateError } = await supabase
      .from('credit_transactions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        order_id: order.id.toString(),
        order_number: order.order_number
      })
      .eq('id', transaction.id);

    if (updateError) {
      console.error('Failed to update transaction:', updateError);
      throw new Error('Failed to finalize transaction');
    }

    console.log(`✅ Credits finalized for order #${order.order_number}`);

    return res.status(200).json({
      success: true,
      message: 'Credits finalized',
      orderId: order.id,
      transactionId: transaction.id
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ 
      error: 'Webhook processing failed',
      message: error.message 
    });
  }
};

