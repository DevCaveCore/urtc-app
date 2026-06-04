import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://opyekegukjocooshatgq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9weWVrZWd1a2pvY29vc2hhdGdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk0MDUsImV4cCI6MjA5NjAyNTQwNX0.cWImmftKOvaOQPs85fbZxW1NG_S7b42oqnQOU6kOBu8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
