import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xfgawqugparkwkapoopk.supabase.co';
const supabaseAnonKey = 'sb_publishable_IhOONNlVz5BjGsBl9MAEww_qpnzg304';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
