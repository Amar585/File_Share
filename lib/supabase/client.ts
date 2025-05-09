"use client"

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/lib/supabase/database.types"

// Generate a unique key for this tab (only in browser)
const tabId = typeof window !== 'undefined' ? `tab-${Math.random().toString(36).substr(2, 9)}` : 'default';

export const supabase = createClientComponentClient<Database>({
  options: {
    auth: {
      persistSession: true,
      storageKey: `supabase.auth.token.${tabId}`,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    }
  }
});
