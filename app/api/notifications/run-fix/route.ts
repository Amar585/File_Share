import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    // Check if user is authenticated
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return NextResponse.json({ 
        success: false, 
        message: 'Unauthorized' 
      }, { status: 401 })
    }
    
    // Need service role client to apply migrations
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    // Fix notification RLS policies
    const fixSQL = `
    -- Drop and recreate all notification policies
    DO $$ 
    BEGIN
      -- Drop existing policies
      DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
      DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
      DROP POLICY IF EXISTS "Users can insert their own notifications" ON public.notifications;
      DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
      
      -- Enable RLS
      ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
      
      -- Create policies
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
    `
    
    // Execute the fix directly to database
    const { error: fixError } = await serviceClient.rpc('exec_sql', {
      query: fixSQL
    })
    
    if (fixError) {
      console.error('Error applying notification fix:', fixError)
      throw new Error(`Failed to apply fix: ${fixError.message}`)
    }
    
    // Also check if there are any orphan notifications after the fix
    const cleanupSQL = `
    -- Delete any orphaned notifications that don't have a valid user_id
    DELETE FROM public.notifications 
    WHERE user_id NOT IN (SELECT id FROM auth.users);
    `
    
    const { error: cleanupError } = await serviceClient.rpc('exec_sql', {
      query: cleanupSQL
    })
    
    if (cleanupError) {
      console.warn('Warning - error during cleanup:', cleanupError)
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Notification system fixed successfully' 
    })
  } catch (error: any) {
    console.error('Error running notification fix:', error)
    return NextResponse.json({ 
      success: false, 
      message: `Error: ${error.message}` 
    }, { status: 500 })
  }
} 