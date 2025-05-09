require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  // Create Supabase client with service role key
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    }
  );

  try {
    console.log('Running migration to create file_access_requests table...');
    
    // Read the SQL migration file
    const sql = fs.readFileSync(path.join(__dirname, '../migrations/create-access-requests-table.sql'), 'utf8');
    
    // Execute the SQL using RPC
    const { error } = await supabase.rpc('exec_sql', { query: sql });
    
    if (error) {
      console.error('Error applying migration:', error);
      process.exit(1);
    }
    
    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error running migration:', error);
    process.exit(1);
  }
}

runMigration(); 