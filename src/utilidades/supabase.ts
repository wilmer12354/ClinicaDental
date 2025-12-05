import { createClient } from '@supabase/supabase-js';

// Usar process.env en lugar de import.meta.env para compatibilidad
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';



export const supabase = createClient(supabaseUrl, supabaseKey);

export interface Transaction {
  id: string;
  user_id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  transaction_date: string;
  created_at: string;
}

export const getDailyTransactions = async (date: Date = new Date()) => {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .gte('transaction_date', startOfDay.toISOString())
      .lte('transaction_date', endOfDay.toISOString())
      .order('transaction_date', { ascending: false });

    if (error) {
      throw new Error(`Error fetching transactions: ${error.message}`);
    }

    return data as Transaction[];
  } catch (error) {
    throw new Error(`Error in getDailyTransactions: ${error.message}`);
  }
};
