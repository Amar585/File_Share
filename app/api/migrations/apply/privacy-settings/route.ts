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
    
    // Create user_settings table if it doesn't exist
    const userSettingsMigration = `
    -- Create user_settings table if it doesn't exist
    CREATE TABLE IF NOT EXISTS public.user_settings (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      two_factor_enabled BOOLEAN DEFAULT FALSE,
      private_files_by_default BOOLEAN DEFAULT TRUE,
      require_approval_for_access BOOLEAN DEFAULT TRUE,
      email_notifications_enabled BOOLEAN DEFAULT TRUE,
      push_notifications_enabled BOOLEAN DEFAULT TRUE,
      language VARCHAR(50) DEFAULT 'english',
      notification_types JSONB DEFAULT '{"file_shared": true, "file_downloaded": true, "access_requested": true}'::jsonb
    );

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

    -- Create RLS policies
    DO $$ 
    BEGIN
      -- Drop any existing policies for user_settings
      DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_settings;
      DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings;
      
      -- Drop any existing policies for notifications
      DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
      DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
      DROP POLICY IF EXISTS "Users can insert their own notifications" ON public.notifications;
      
      -- Enable RLS on the tables
      ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
      
      -- Create policies for user_settings
      CREATE POLICY "Users can view their own settings" 
      ON public.user_settings FOR SELECT 
      USING (auth.uid() = id);
      
      CREATE POLICY "Users can update their own settings" 
      ON public.user_settings FOR UPDATE 
      USING (auth.uid() = id);
      
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
    
    -- Create function to initialize user settings on user creation
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO public.user_settings (id)
      VALUES (NEW.id);
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    
    -- Create trigger for new users (if it doesn't exist)
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
      
    -- Backfill existing users without settings
    INSERT INTO public.user_settings (id)
    SELECT id FROM auth.users
    WHERE id NOT IN (SELECT id FROM public.user_settings);
    `
    
    const { error } = await supabase.rpc('exec_sql', {
      query: userSettingsMigration
    })
    
    if (error) {
      console.error('Error applying migration:', error)
      throw error
    }
    
    return NextResponse.json({
      success: true,
      message: 'Privacy settings and notifications tables created successfully'
    })
  } catch (error: any) {
    console.error('Error applying migrations:', error)
    return NextResponse.json({
      success: false,
      message: `Error applying migrations: ${error.message}`
    }, { status: 500 })
  }
} 