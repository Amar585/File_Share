import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Special cleanup API for orphaned files
export async function GET() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables')
    }
    
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    
    // First ensure our SQL function exists
    try {
      console.log('Setting up SQL delete function...')
      await fetch('/api/storage/create-delete-function')
    } catch (err) {
      console.log('Could not set up SQL function, but will continue cleanup')
    }
    
    // Track all cleanup operations
    let cleanupResults = []
    
    // STEP 1: Try direct bucket by bucket listing and cleanup
    // Prioritize 'files' bucket since that's where the files are actually stored
    const buckets = ['files', 'avatar', 'public']
    
    console.log('Focusing primarily on the FILES bucket as per user confirmation')
    
    // First try a direct deletion in the files bucket for the exact file
    try {
      const targetFile = '3841ece7-3a0e-4d5c-bdb4-65648ee124a3-BN201(4).png'
      const userPrefix = '3b54fa6b-4b46-4047-b956-084bea02eb9e'
      const fullPath = `${userPrefix}/${targetFile}`
      
      console.log(`Attempting direct deletion of known file: ${fullPath} in files bucket`)
      
      const { error: directError } = await adminSupabase.storage
        .from('files')
        .remove([fullPath])
        
      if (!directError) {
        console.log('SUCCESS: Direct deletion of specific file worked!')
        cleanupResults.push({ 
          bucket: 'files', 
          file: fullPath, 
          success: true, 
          method: 'direct-known-file' 
        })
      } else {
        console.warn(`Direct deletion failed: ${directError.message}`)
      }
    } catch (err: any) {
      console.error('Error during direct file deletion:', err.message)
    }
    
    for (const bucket of buckets) {
      console.log(`Cleaning bucket: ${bucket}`)
      
      try {
        // List all files in the bucket
        const { data: files, error } = await adminSupabase.storage
          .from(bucket)
          .list()
        
        if (error) {
          console.warn(`Error listing files in ${bucket}: ${error.message}`)
          continue
        }
        
        // Find and delete the problematic file
        if (files) {
          for (const file of files) {
            if (file.name.includes('3841ece7-3a0e-4d5c-bdb4-65648ee124a3') || 
                file.name.includes('BN201(4).png')) {
              console.log(`Found problematic file in ${bucket}: ${file.name}`)
              
              try {
                const { error: deleteError } = await adminSupabase.storage
                  .from(bucket)
                  .remove([file.name])
                
                const result = { 
                  bucket, 
                  file: file.name, 
                  success: !deleteError,
                  error: deleteError?.message
                }
                cleanupResults.push(result)
                
                console.log(`Deletion result for ${file.name}: ${!deleteError ? 'SUCCESS' : 'FAILED'}`)
              } catch (err: any) {
                console.error(`Error deleting ${file.name} from ${bucket}: ${err.message}`)
                cleanupResults.push({ 
                  bucket, 
                  file: file.name, 
                  success: false, 
                  error: err.message 
                })
              }
            }
          }
        }
        
        // Now check each user folder
        for (const item of files || []) {
          // Look for folders (items with id set to null are folders)
          if (item.id === null) {
            console.log(`Checking user folder: ${item.name} in ${bucket}`)
            
            try {
              const { data: userFiles, error: userError } = await adminSupabase.storage
                .from(bucket)
                .list(item.name)
              
              if (userError) {
                console.warn(`Error listing files in ${bucket}/${item.name}: ${userError.message}`)
                continue
              }
              
              // Look for the problematic file in this user folder
              if (userFiles) {
                for (const userFile of userFiles) {
                  if (userFile.name.includes('3841ece7-3a0e-4d5c-bdb4-65648ee124a3') || 
                      userFile.name.includes('BN201(4).png')) {
                    console.log(`Found problematic file in ${bucket}/${item.name}: ${userFile.name}`)
                    
                    const fullPath = `${item.name}/${userFile.name}`
                    try {
                      const { error: deleteError } = await adminSupabase.storage
                        .from(bucket)
                        .remove([fullPath])
                      
                      const result = { 
                        bucket, 
                        file: fullPath, 
                        success: !deleteError,
                        error: deleteError?.message
                      }
                      cleanupResults.push(result)
                      
                      console.log(`Deletion result for ${fullPath}: ${!deleteError ? 'SUCCESS' : 'FAILED'}`)
                    } catch (err: any) {
                      console.error(`Error deleting ${fullPath} from ${bucket}: ${err.message}`)
                      cleanupResults.push({ 
                        bucket, 
                        file: fullPath, 
                        success: false, 
                        error: err.message 
                      })
                    }
                  }
                }
              }
            } catch (folderErr: any) {
              console.error(`Error processing folder ${item.name}: ${folderErr.message}`)
            }
          }
        }
      } catch (bucketErr: any) {
        console.error(`Error processing bucket ${bucket}: ${bucketErr.message}`)
      }
    }
    
    // STEP 2: Try direct SQL deletion for the problematic file
    try {
      console.log('Attempting direct SQL deletion of problematic file')
      
      const targetFileName = '3841ece7-3a0e-4d5c-bdb4-65648ee124a3-BN201(4).png'
      
      for (const bucket of buckets) {
        try {
          const { data, error } = await adminSupabase.rpc('delete_storage_object_by_name', {
            bucket_name: bucket,
            object_name: targetFileName
          })
          
          if (error) {
            console.warn(`SQL deletion error for ${bucket}/${targetFileName}: ${error.message}`)
          } else {
            console.log(`SQL deletion result for ${bucket}/${targetFileName}: ${data ? 'SUCCESS' : 'NO ROWS AFFECTED'}`)
            if (data) {
              cleanupResults.push({ bucket, file: targetFileName, success: true, method: 'sql' })
            }
          }
          
          // Also try with user prefix
          const userPath = `3b54fa6b-4b46-4047-b956-084bea02eb9e/${targetFileName}`
          const { data: userData, error: userError } = await adminSupabase.rpc('delete_storage_object_by_name', {
            bucket_name: bucket,
            object_name: userPath
          })
          
          if (userError) {
            console.warn(`SQL deletion error for ${bucket}/${userPath}: ${userError.message}`)
          } else {
            console.log(`SQL deletion result for ${bucket}/${userPath}: ${userData ? 'SUCCESS' : 'NO ROWS AFFECTED'}`)
            if (userData) {
              cleanupResults.push({ bucket, file: userPath, success: true, method: 'sql' })
            }
          }
        } catch (sqlErr: any) {
          console.error(`SQL deletion execution error for ${bucket}: ${sqlErr.message}`)
        }
      }
    } catch (sqlErr: any) {
      console.error(`SQL deletion general error: ${sqlErr.message}`)
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Cleanup process completed',
      results: cleanupResults
    })
    
  } catch (error: any) {
    console.error('Error in cleanup process:', error)
    return NextResponse.json({ 
      success: false, 
      message: `Error in cleanup process: ${error.message}`
    }, { status: 500 })
  }
} 