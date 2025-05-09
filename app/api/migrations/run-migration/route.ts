import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { success: false, message: 'Missing Supabase credentials' },
        { status: 500 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    console.log('Running migration to create file_access_requests table...')
    
    // SQL for creating file_access_requests table
    const sql = `
    -- Create file_access_requests table if it doesn't exist
    CREATE TABLE IF NOT EXISTS public.file_access_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      file_id UUID REFERENCES public.files(id) ON DELETE CASCADE,
      requester_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'pending' NOT NULL,
      message TEXT NOT NULL,
      response_message TEXT,
      responded_at TIMESTAMP WITH TIME ZONE
    );

    -- Set up RLS policies for file_access_requests table
    DO $$ 
    BEGIN
      -- Drop any existing policies
      DROP POLICY IF EXISTS "Users can view their own requests" ON public.file_access_requests;
      DROP POLICY IF EXISTS "Users can view requests for their files" ON public.file_access_requests;
      DROP POLICY IF EXISTS "Users can create requests" ON public.file_access_requests;
      DROP POLICY IF EXISTS "Users can update their own requests" ON public.file_access_requests;
      DROP POLICY IF EXISTS "File owners can update requests" ON public.file_access_requests;
      
      -- Enable RLS on the table
      ALTER TABLE public.file_access_requests ENABLE ROW LEVEL SECURITY;
      
      -- Create policies for file_access_requests
      -- Users can view requests they've made
      CREATE POLICY "Users can view their own requests" 
      ON public.file_access_requests FOR SELECT 
      USING (auth.uid() = requester_id);
      
      -- Users can view requests for files they own
      CREATE POLICY "Users can view requests for their files" 
      ON public.file_access_requests FOR SELECT 
      USING (auth.uid() = owner_id);
      
      -- Users can create new access requests
      CREATE POLICY "Users can create requests" 
      ON public.file_access_requests FOR INSERT 
      WITH CHECK (auth.uid() = requester_id);
      
      -- Users can update their own requests (e.g., cancel them)
      CREATE POLICY "Users can update their own requests" 
      ON public.file_access_requests FOR UPDATE 
      USING (auth.uid() = requester_id AND status = 'pending');
      
      -- File owners can update requests (approve/reject)
      CREATE POLICY "File owners can update requests" 
      ON public.file_access_requests FOR UPDATE 
      USING (auth.uid() = owner_id);
    END $$;
    `
    
    // Execute the SQL using RPC
    const { error } = await supabase.rpc('exec_sql', { query: sql })
    
    if (error) {
      console.error('Error applying migration:', error)
      return NextResponse.json(
        { success: false, message: `Migration failed: ${error.message}` },
        { status: 500 }
      )
    }
    
    // Create notifications table if it doesn't exist
    const notificationsSQL = `
    -- Create notifications table if it doesn't exist
    CREATE TABLE IF NOT EXISTS public.notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      type VARCHAR(50) NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read BOOLEAN DEFAULT FALSE,
      metadata JSONB
    );

    -- Set up RLS policies for notifications table
    DO $$ 
    BEGIN
      -- Drop any existing policies
      DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
      DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
      DROP POLICY IF EXISTS "Users can insert their own notifications" ON public.notifications;
      
      -- Enable RLS on the table
      ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
      
      -- Create policies for notifications
      CREATE POLICY "Users can view their own notifications" 
      ON public.notifications FOR SELECT 
      USING (auth.uid() = user_id);
      
      CREATE POLICY "Users can update their own notifications" 
      ON public.notifications FOR UPDATE 
      USING (auth.uid() = user_id);
      
      -- Add INSERT policy for notifications
      CREATE POLICY "Users can insert their own notifications" 
      ON public.notifications FOR INSERT 
      WITH CHECK (auth.uid() = user_id);
    END $$;
    `
    
    const { error: notificationsError } = await supabase.rpc('exec_sql', { query: notificationsSQL })
    
    if (notificationsError) {
      console.error('Error creating notifications table:', notificationsError)
      // Continue anyway
    }
    
    console.log('Migration completed successfully!')
    
    return NextResponse.json(
      { success: true, message: 'Migration completed successfully' },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error running migration:', error)
    return NextResponse.json(
      { success: false, message: `Error running migration: ${error.message}` },
      { status: 500 }
    )
  }
} 