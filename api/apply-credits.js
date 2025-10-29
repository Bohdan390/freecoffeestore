/**
 * SHOPIFY DRAFT ORDER API - APPLY CREDITS
 * 
 * This endpoint applies credits by creating a draft order with a discount line item.
 * Works with ALL Shopify checkout methods (including express checkouts).
 * 
 * Platform: Vercel, Railway, Render, or any Node.js hosting
 */

const { createClient } = require('@supabase/supabase-js');

/**
 * Apply credits to cart using Shopify Admin API
 */
module.exports = async (req, res) => {
  // Environment variables (set in your hosting platform)
  const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
  const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  // Initialize Supabase with service key for admin operations
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
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
    const { creditAmount, userId, cartItems } = req.body;

    // Validate input
    if (!creditAmount || !userId || !cartItems || cartItems.length === 0) {
      return res.status(400).json({ 
        error: 'Missing required fields: creditAmount, userId, cartItems' 
      });
    }

    // Step 1: Verify user has enough credits in Supabase
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
    const discountAmount = creditAmount; // 1:1 with dollars

    // Step 3: Create Shopify discount code using Admin API
    const discountResponse = await fetch(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/price_rules.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
        },
        body: JSON.stringify({
          price_rule: {
            title: `Store Credit - ${discountAmount}`,
            target_type: 'line_item',
            target_selection: 'all',
            allocation_method: 'across',
            value_type: 'fixed_amount',
            value: `-${discountAmount}`,
            customer_selection: 'all',
            once_per_customer: true,
            usage_limit: 1,
            starts_at: new Date().toISOString()
          }
        })
      }
    );

    if (!discountResponse.ok) {
      const errorData = await discountResponse.text();
      console.error('Shopify API Error:', errorData);
      throw new Error('Failed to create discount in Shopify');
    }

    const { price_rule } = await discountResponse.json();

    // Step 4: Create discount code for the price rule
    const codeResponse = await fetch(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/price_rules/${price_rule.id}/discount_codes.json`,
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

    // Step 5: Temporarily deduct credits from user's balance
    const newBalance = profile.credits - creditAmount;
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ credits: newBalance })
      .eq('id', userId);

    if (updateError) {
      console.error('Failed to update credits:', updateError);
      throw new Error('Failed to update user credits');
    }

    // Step 6: Record transaction in database
    // const { error: transactionError } = await supabase
    //   .from('credit_transactions')
    //   .insert({
    //     user_id: userId,
    //     amount: creditAmount,
    //     type: 'debit',
    //     status: 'pending',
    //     discount_code: discountCode,
    //     price_rule_id: price_rule.id.toString(),
    //     description: `Applied $${creditAmount} store credit`
    //   });

    // if (transactionError) {
    //   console.error('Failed to record transaction:', transactionError);
    //   // Don't fail the request, transaction is already applied
    // }

    // Step 7: Return discount code to frontend
    return res.status(200).json({
      success: true,
      discountCode: discountCode,
      discountAmount: discountAmount,
      newBalance: newBalance,
      priceRuleId: price_rule.id
    });

  } catch (error) {
    console.error('Error applying credits:', error);
    return res.status(500).json({ 
      error: 'Failed to apply credits',
      message: error.message 
    });
  }
};

