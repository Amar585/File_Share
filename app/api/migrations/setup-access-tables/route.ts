import { NextRequest, NextResponse } from 'next/server';

// API that returns SQL to run to set up access request tables
export async function GET(req: NextRequest) {
  try {
    // We'll simplify by just returning the SQL directly
    return NextResponse.json({
      success: true,
      message: 'Please run this SQL in your Supabase dashboard SQL Editor to set up the necessary tables',
      sqlToRun: getFullMigrationSQL()
    });
  } catch (error: any) {
    console.error('Error in setup tables API:', error);
    return NextResponse.json(
      { 
        error: `Error: ${error.message}`,
        sqlToRun: getFullMigrationSQL()
      },
      { status: 500 }
    );
  }
}

// Helper function to get the full migration SQL
function getFullMigrationSQL() {
  return `
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

-- Create notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB
);

-- Set up RLS for notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;

-- Create policies
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

-- Refresh the schema cache
SELECT pg_notify('supabase_realtime', 'reload_schema');
  `;
} 