import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false
        }
      }
    )
    
    // Fix the notifications RLS policies to ensure deletion works
    const notificationsRlsPolicy = `
    -- Drop and recreate the notification policies to ensure deletion works
    DO $$ 
    BEGIN
      -- Drop any existing policies
      DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
      DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
      DROP POLICY IF EXISTS "Users can insert their own notifications" ON public.notifications;
      DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
      
      -- Make sure RLS is enabled
      ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
      
      -- Recreate all policies
      CREATE POLICY "Users can view their own notifications" 
      ON public.notifications FOR SELECT 
      USING (auth.uid() = user_id);
      
      CREATE POLICY "Users can update their own notifications" 
      ON public.notifications FOR UPDATE 
      USING (auth.uid() = user_id);
      
      CREATE POLICY "Users can insert their own notifications" 
      ON public.notifications FOR INSERT 
      WITH CHECK (auth.uid() = user_id);
      
      CREATE POLICY "Users can delete their own notifications" 
      ON public.notifications FOR DELETE 
      USING (auth.uid() = user_id);
    END $$;

    -- Verify that all delete policies are properly set up
    SELECT 
      schemaname,
      tablename,
      policyname,
      permissive,
      cmd
    FROM 
      pg_policies
    WHERE 
      tablename = 'notifications';
    `
    
    console.log('Applying notifications RLS policy fixes...')
    
    // Execute the SQL directly to avoid any potential issues with exec_sql function
    const { data, error } = await supabase.rpc('exec_sql', {
      query: notificationsRlsPolicy
    })
    
    if (error) {
      console.error('Error updating notifications RLS policy:', error)
      return NextResponse.json({
        success: false,
        message: `Error updating notifications RLS policy: ${error.message}`
      }, { status: 500 })
    }
    
    console.log('Notifications RLS policy fixes successfully applied!')
    
    return NextResponse.json({
      success: true,
      message: 'Notifications RLS policy fixes successfully applied'
    })
  } catch (error: any) {
    console.error('Error applying notifications RLS fixes:', error)
    return NextResponse.json({
      success: false,
      message: `Error applying notifications RLS fixes: ${error.message}`
    }, { status: 500 })
  }
} 