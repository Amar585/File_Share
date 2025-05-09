-- Add shared column to files table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'files' AND column_name = 'shared'
  ) THEN
    ALTER TABLE public.files ADD COLUMN shared BOOLEAN DEFAULT false;
    
    -- Update any existing rows to have shared = false
    UPDATE public.files SET shared = false WHERE shared IS NULL;
  END IF;
END $$; 