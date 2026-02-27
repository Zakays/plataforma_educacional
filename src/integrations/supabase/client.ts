import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mvkyapsrzupcmoorgsfg.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12a3lhcHNyenVwY21vb3Jnc2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDY0MjQsImV4cCI6MjA4NzcyMjQyNH0.OIPN-SKS8OybOgodaVajBMTa6O0mRkoZb2unVH3gtfQ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Import the supabase client like this:
// For React:
// import { supabase } from "@/integrations/supabase/client";
// For React Native:
// import { supabase } from "@/src/integrations/supabase/client";
