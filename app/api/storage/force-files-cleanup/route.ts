import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Force cleanup specifically targeting the files bucket
export async function GET(req: Request) {
  try {
    // Extract file ID from query params if available
    const { searchParams } = new URL(req.url)
    const fileId = searchParams.get('fileId')
    const userId = searchParams.get('userId') 
    
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables')
    }
    
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false
        }
      }
    )
    
    let results = []
    
    // Always try default path first
    if (fileId) {
      console.log(`Targeting specific file: ${fileId}`)
      
      const paths = []
      
      // If we have user ID, try with user path
      if (userId) {
        paths.push(`${userId}/${fileId}`)
      }
      
      // Also try just the file ID
      paths.push(fileId)
      
      // Try partial match (if it contains UUID format)
      if (fileId.includes('-')) {
        const parts = fileId.split('-')
        if (parts.length > 1) {
          // Try with just the UUID part
          paths.push(parts[0])
          // Try with the filename part
          paths.push(parts.slice(1).join('-'))
        }
      }
      
      console.log(`Will try these paths in the files bucket: ${paths.join(', ')}`)
      
      for (const path of paths) {
        try {
          const { error: deleteError } = await adminSupabase.storage
            .from('files')
            .remove([path])
            
          if (!deleteError) {
            console.log(`Successfully deleted ${path} from files bucket`)
            results.push({ path, success: true })
          } else {
            console.warn(`Failed to delete ${path}: ${deleteError.message}`)
            results.push({ path, success: false, error: deleteError.message })
          }
        } catch (err: any) {
          console.error(`Error during deletion of ${path}: ${err.message}`)
          results.push({ path, success: false, error: err.message })
        }
      }
    } else {
      // If no specific file ID, do a full scan of the files bucket
      console.log('No specific file targeted, scanning files bucket for cleanup')
      
      // Get list of files in the database that should exist
      const { data: dbFiles, error: dbError } = await adminSupabase
        .from('files')
        .select('path')
      
      if (dbError) {
        console.error('Error fetching database files:', dbError.message)
      }
      
      const dbPaths = new Set((dbFiles || []).map(f => f.path).filter(Boolean))
      console.log(`Found ${dbPaths.size} files in the database`)
      
      // List all files in storage
      try {
        const { data: rootItems, error: rootError } = await adminSupabase.storage
          .from('files')
          .list()
          
        if (rootError) {
          console.error('Error listing files bucket:', rootError.message)
        } else if (rootItems) {
          console.log(`Found ${rootItems.length} items at root of files bucket`)
          
          // Check each item in the root
          for (const item of rootItems) {
            if (item.id === null) {
              // This is a folder, check its contents
              try {
                const { data: folderItems, error: folderError } = await adminSupabase.storage
                  .from('files')
                  .list(item.name)
                  
                if (folderError) {
                  console.warn(`Error listing folder ${item.name}:`, folderError.message)
                } else if (folderItems) {
                  console.log(`Found ${folderItems.length} items in folder ${item.name}`)
                  
                  // Check each file in the folder
                  for (const file of folderItems) {
                    const fullPath = `${item.name}/${file.name}`
                    
                    // If the file doesn't exist in the database, delete it
                    if (!dbPaths.has(fullPath)) {
                      console.log(`Orphaned file found: ${fullPath}`)
                      
                      try {
                        const { error: deleteError } = await adminSupabase.storage
                          .from('files')
                          .remove([fullPath])
                          
                        if (!deleteError) {
                          console.log(`Successfully deleted orphaned file: ${fullPath}`)
                          results.push({ path: fullPath, success: true, orphaned: true })
                        } else {
                          console.warn(`Failed to delete orphaned file ${fullPath}:`, deleteError.message)
                          results.push({ path: fullPath, success: false, error: deleteError.message, orphaned: true })
                        }
                      } catch (err: any) {
                        console.error(`Error deleting orphaned file ${fullPath}:`, err.message)
                        results.push({ path: fullPath, success: false, error: err.message, orphaned: true })
                      }
                    }
                  }
                }
              } catch (err: any) {
                console.error(`Error processing folder ${item.name}:`, err.message)
              }
            } else {
              // This is a file at the root level
              if (!dbPaths.has(item.name)) {
                console.log(`Orphaned root file found: ${item.name}`)
                
                try {
                  const { error: deleteError } = await adminSupabase.storage
                    .from('files')
                    .remove([item.name])
                    
                  if (!deleteError) {
                    console.log(`Successfully deleted orphaned root file: ${item.name}`)
                    results.push({ path: item.name, success: true, orphaned: true })
                  } else {
                    console.warn(`Failed to delete orphaned root file ${item.name}:`, deleteError.message)
                    results.push({ path: item.name, success: false, error: deleteError.message, orphaned: true })
                  }
                } catch (err: any) {
                  console.error(`Error deleting orphaned root file ${item.name}:`, err.message)
                  results.push({ path: item.name, success: false, error: err.message, orphaned: true })
                }
              }
            }
          }
        }
      } catch (err: any) {
        console.error('Error during bucket scan:', err.message)
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Files bucket cleanup completed with ${results.filter(r => r.success).length} successful operations`,
      results
    })
  } catch (error: any) {
    console.error('Error in force-files-cleanup:', error)
    return NextResponse.json({
      success: false,
      message: `Error during cleanup: ${error.message}`
    }, { status: 500 })
  }
} 