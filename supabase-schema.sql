-- =====================================================
-- SUPABASE DATABASE SCHEMA FOR SHOPIFY CREDITS SYSTEM
-- =====================================================

-- 1. Create profiles table for storing user credits
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  credits DECIMAL(10, 2) DEFAULT 0.00, -- 1 credit = $1.00
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create credit_transactions table for tracking all credit operations
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  discount_code TEXT,
  price_rule_id TEXT,
  order_id TEXT,
  order_number TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE
);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON credit_transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_discount_code ON credit_transactions(discount_code);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON credit_transactions(created_at DESC);

-- 4. Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for profiles table
CREATE POLICY "Users can view own profile" 
  ON profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
  ON profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- 6. RLS Policies for credit_transactions table
CREATE POLICY "Users can view own transactions" 
  ON credit_transactions FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all transactions" 
  ON credit_transactions FOR ALL 
  USING (true);

-- 7. Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger to auto-update updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 9. Create function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, credits)
  VALUES (NEW.id, NEW.email, 0.00);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Add credits to a test user (replace with your actual user ID)
-- UPDATE profiles SET credits = 100.00 WHERE email = 'test@example.com';

-- =====================================================
-- HELPFUL QUERIES
-- =====================================================

-- View all users and their credit balances
-- SELECT id, email, credits, created_at FROM profiles;

-- View all pending transactions
-- SELECT * FROM credit_transactions WHERE status = 'pending' ORDER BY created_at DESC;

-- View user's transaction history
-- SELECT * FROM credit_transactions WHERE user_id = 'user-uuid-here' ORDER BY created_at DESC;

-- Calculate total credits used by a user
-- SELECT user_id, SUM(amount) as total_used 
-- FROM credit_transactions 
-- WHERE status = 'completed' AND type = 'debit'
-- GROUP BY user_id;

