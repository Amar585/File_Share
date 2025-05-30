import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { filePath, fileId, userId } = await req.json()
    
    if (!filePath) {
      return NextResponse.json({
        success: false,
        message: 'Missing filePath parameter'
      }, { status: 400 })
    }
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables')
    }
    
    // Create admin client with service role key for storage operations
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    
    console.log(`Attempting to delete file with path: ${filePath}`)
    
    // Multi-strategy approach to ensure deletion
    let deleted = false
    const results = []
    
    // Strategy 1: Try direct deletion with exact path
    try {
      const { error } = await adminSupabase.storage
        .from('files')
        .remove([filePath])
        
      if (!error) {
        console.log('SUCCESS: Direct deletion with exact path worked!')
        deleted = true
        results.push({ method: 'direct-exact-path', success: true })
      } else {
        console.warn(`Direct deletion with exact path failed: ${error.message}`)
        results.push({ method: 'direct-exact-path', success: false, error: error.message })
      }
    } catch (err: any) {
      console.error('Error during direct deletion:', err.message)
      results.push({ method: 'direct-exact-path', success: false, error: err.message })
    }

    // Strategy 2: Try with just the filename if full path didn't work
    if (!deleted && filePath.includes('/')) {
      const filename = filePath.split('/').pop() || ''
      
      if (filename) {
        try {
          const { error } = await adminSupabase.storage
            .from('files')
            .remove([filename])
            
          if (!error) {
            console.log('SUCCESS: Deletion with just filename worked!')
            deleted = true
            results.push({ method: 'filename-only', success: true })
          } else {
            console.warn(`Deletion with just filename failed: ${error.message}`)
            results.push({ method: 'filename-only', success: false, error: error.message })
          }
        } catch (err: any) {
          console.error('Error during filename-only deletion:', err.message)
          results.push({ method: 'filename-only', success: false, error: err.message })
        }
      }
    }
    
    // Strategy 3: Try with UUID-based approaches if the path has a UUID pattern
    if (!deleted && filePath.includes('-')) {
      const parts = filePath.split('-')
      const filename = filePath.includes('/') ? filePath.split('/').pop() || '' : filePath
      
      if (parts.length > 1) {
        // Try with just the first part (likely UUID)
        const firstPart = parts[0]
        try {
          const { error } = await adminSupabase.storage
            .from('files')
            .remove([firstPart])
            
          if (!error) {
            console.log('SUCCESS: Deletion with first part worked!')
            deleted = true
            results.push({ method: 'first-part', success: true })
          } else {
            results.push({ method: 'first-part', success: false, error: error.message })
          }
        } catch (err: any) {
          results.push({ method: 'first-part', success: false, error: err.message })
        }
        
        // Try with known user prefix if provided or extracted
        const extractedUserId = userId || (filePath.includes('/') ? filePath.split('/')[0] : null)
        if (extractedUserId && !deleted) {
          // Try various combinations with user ID
          const possiblePaths = [
            `${extractedUserId}/${filename}`,
            `${extractedUserId}/${parts[0]}`,
            `${extractedUserId}/${parts.slice(1).join('-')}`,
          ]
          
          for (const path of possiblePaths) {
            if (deleted) break
            
            try {
              const { error } = await adminSupabase.storage
                .from('files')
                .remove([path])
                
              if (!error) {
                console.log(`SUCCESS: Deletion with user path ${path} worked!`)
                deleted = true
                results.push({ method: `user-path-${path}`, success: true })
                break
              } else {
                results.push({ method: `user-path-${path}`, success: false, error: error.message })
              }
            } catch (err: any) {
              results.push({ method: `user-path-${path}`, success: false, error: err.message })
            }
          }
        }
      }
    }
    
    // Strategy 4: If we have fileId directly, try with it
    if (!deleted && fileId) {
      try {
        const { error } = await adminSupabase.storage
          .from('files')
          .remove([fileId])
          
        if (!error) {
          console.log('SUCCESS: Deletion with provided fileId worked!')
          deleted = true
          results.push({ method: 'direct-fileId', success: true })
        } else {
          results.push({ method: 'direct-fileId', success: false, error: error.message })
        }
      } catch (err: any) {
        results.push({ method: 'direct-fileId', success: false, error: err.message })
      }
      
      // Try fileId with user prefix if available
      if (!deleted && userId) {
        try {
          const path = `${userId}/${fileId}`
          const { error } = await adminSupabase.storage
            .from('files')
            .remove([path])
            
          if (!error) {
            console.log(`SUCCESS: Deletion with user path ${path} worked!`)
            deleted = true
            results.push({ method: 'user-fileId', success: true })
          } else {
            results.push({ method: 'user-fileId', success: false, error: error.message })
          }
        } catch (err: any) {
          results.push({ method: 'user-fileId', success: false, error: err.message })
        }
      }
    }
    
    // Strategy 5: Try using SQL function for direct database access as last resort
    if (!deleted) {
      try {
        // Try to create the SQL function if it doesn't exist
        try {
          await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/api/storage/create-delete-function`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });
        } catch (err) {
          console.warn('Could not ensure SQL function exists, but will try anyway');
        }
        
        // Use the SQL function to delete directly from storage.objects table
        const { data, error } = await adminSupabase.rpc('delete_storage_object_by_name', {
          bucket_name: 'files',
          object_name: filePath
        });
        
        if (!error && data === true) {
          console.log('SUCCESS: Deletion using SQL function worked!');
          deleted = true;
          results.push({ method: 'sql-function', success: true });
        } else {
          console.warn(`SQL function deletion failed: ${error?.message || 'Unknown error'}`);
          results.push({ 
            method: 'sql-function', 
            success: false, 
            error: error?.message || 'Unknown error' 
          });
        }
      } catch (err: any) {
        console.error('Error during SQL function deletion:', err.message);
        results.push({ method: 'sql-function', success: false, error: err.message });
      }
    }
    
    // Return results
    if (deleted) {
      return NextResponse.json({
        success: true,
        message: 'File deleted successfully',
        method: results.find(r => r.success)?.method || 'unknown',
        results
      })
    } else {
      return NextResponse.json({
        success: false,
        message: 'Failed to delete file from storage after multiple attempts',
        results
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('Error in delete-file API:', error)
    return NextResponse.json({
      success: false,
      message: `Error during file deletion: ${error.message}`
    }, { status: 500 })
  }
} 