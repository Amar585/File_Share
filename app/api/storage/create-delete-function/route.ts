import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Create a SQL function to directly delete storage objects by name
export async function GET() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables')
    }
    
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    
    // Define the SQL function to delete objects directly in the storage schema
    const createFunctionSQL = `
CREATE OR REPLACE FUNCTION delete_storage_object_by_name(bucket_name text, object_name text)
RETURNS bool AS $$
DECLARE
  success boolean := false;
BEGIN
  -- Delete from storage.objects table directly
  DELETE FROM storage.objects 
  WHERE bucket_id = bucket_name 
    AND (name = object_name OR name LIKE '%' || split_part(object_name, '/', array_length(string_to_array(object_name, '/'), 1)));
  
  -- Check if deletion was successful
  GET DIAGNOSTICS success = ROW_COUNT;
  
  -- Return true if at least one row was deleted
  RETURN success > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
    `;
    
    const { error } = await adminSupabase.rpc('pgbouncer_exec', {
      query: createFunctionSQL
    });
    
    if (error) {
      // Try alternative method if pgbouncer_exec isn't available
      const { error: sqlError } = await adminSupabase.from('_exec_sql').select('*').limit(1);
      
      if (sqlError) {
        throw new Error(`Failed to create SQL function: ${error.message}`);
      }
      
      // If we can query _exec_sql, use direct SQL execution
      const { error: directError } = await adminSupabase.rpc('exec_sql', {
        sql: createFunctionSQL
      });
      
      if (directError) {
        throw new Error(`Failed to create SQL function using exec_sql: ${directError.message}`);
      }
    }
    
    // Also fix permissions to ensure the delete-file API can access all buckets
    const fixPermissionSQL = `
      -- Grant admin user access to all storage buckets
      GRANT ALL PRIVILEGES ON SCHEMA storage TO service_role;
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA storage TO service_role;
      GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA storage TO service_role;
      GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA storage TO service_role;
      
      -- Ensure the public table permissions
      ALTER TABLE storage.objects DROP POLICY IF EXISTS admin_all;
      CREATE POLICY admin_all ON storage.objects FOR ALL TO service_role USING (true);
    `;
    
    try {
      await adminSupabase.rpc('pgbouncer_exec', {
        query: fixPermissionSQL
      });
    } catch (permError) {
      console.warn('Permission fix error (non-critical):', permError);
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Created SQL function for direct storage object deletion' 
    });
    
  } catch (error: any) {
    console.error('Error creating SQL function:', error);
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 });
  }
} 