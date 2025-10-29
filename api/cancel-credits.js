/**
 * CANCEL CREDITS - RESTORE USER BALANCE
 * 
 * This endpoint is called when user removes credits from cart before checkout.
 * It restores the credits back to the user's balance.
 */

const { createClient } = require('@supabase/supabase-js');

const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, discountCode, priceRuleId } = req.body;

    if (!userId || !discountCode) {
      return res.status(400).json({ error: 'Missing userId or discountCode' });
    }

    // Step 1: Find the pending transaction
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

    // Step 2: Restore credits to user's balance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .single();

    if (profileError) {
      throw new Error('Failed to fetch user profile');
    }

    const restoredBalance = profile.credits + transaction.amount;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ credits: restoredBalance })
      .eq('id', userId);

    if (updateError) {
      throw new Error('Failed to restore credits');
    }

    // Step 3: Cancel the transaction
    const { error: cancelError } = await supabase
      .from('credit_transactions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('id', transaction.id);

    if (cancelError) {
      console.error('Failed to cancel transaction:', cancelError);
    }

    // Step 4: Delete the Shopify discount code (optional cleanup)
    if (priceRuleId) {
      try {
        await fetch(
          `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/price_rules/${priceRuleId}.json`,
          {
            method: 'DELETE',
            headers: {
              'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
            }
          }
        );
      } catch (error) {
        console.error('Failed to delete price rule:', error);
        // Don't fail the request, credits are already restored
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
};

