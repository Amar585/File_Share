import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'

// Secret key for encrypting file keys
// In production, this should be stored securely in environment variables
const SERVER_ENCRYPTION_KEY = process.env.SERVER_ENCRYPTION_KEY || 
  'bZ8x5dL1p3qTyA7wJ2cG9vF4rM6sN0hE'; // 32 chars for AES-256
const SERVER_ENCRYPTION_IV = process.env.SERVER_ENCRYPTION_IV || 
  'K3b8rP5vZ7x2Q9tY'; // 16 chars for IV

// Encrypt a file key with the server's master key
function encryptFileKey(fileKey: string): string {
  try {
    // Use AES-256-CBC for better compatibility
    const cipher = crypto.createCipheriv(
      'aes-256-cbc', 
      Buffer.from(SERVER_ENCRYPTION_KEY), 
      Buffer.from(SERVER_ENCRYPTION_IV, 'utf8').slice(0, 16)
    );
    
    let encrypted = cipher.update(fileKey, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    return encrypted;
  } catch (error) {
    console.error('Error encrypting file key:', error);
    throw new Error('Encryption failed: Could not secure the file key');
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables')
    }

    // Create admin client with service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    
    // Parse the form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const userId = formData.get('userId') as string
    
    if (!file || !userId) {
      return NextResponse.json({
        success: false,
        message: 'File and userId are required'
      }, { status: 400 })
    }
    
    // Check for encryption metadata
    const isEncrypted = formData.get('isEncrypted') === 'true'
    const fileKey = formData.get('fileKey') as string || null
    const iv = formData.get('iv') as string || null
    const originalType = formData.get('originalType') as string || file.type
    
    console.log('File upload received with encryption status:', isEncrypted ? 'ENCRYPTED' : 'NOT ENCRYPTED')
    if (isEncrypted) {
      console.log('Encryption metadata received: IV present:', !!iv, ', FileKey present:', !!fileKey)
    }
    
    // Generate a unique file path
    const filePath = `${userId}/${uuidv4()}-${file.name}`
    
    // Ensure the storage bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    
    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError)
      throw bucketsError
    }
    
    if (!buckets?.some(bucket => bucket.name === 'files')) {
      // Create the bucket if it doesn't exist
      const { error: createError } = await supabase.storage.createBucket('files', {
        public: false,
        fileSizeLimit: 50 * 1024 * 1024 // 50MB
      })
      
      if (createError) {
        console.error('Error creating bucket:', createError)
        throw createError
      }
    }
    
    // Upload the file using service role (bypassing RLS)
    const { data, error: uploadError } = await supabase.storage
      .from('files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })
    
    if (uploadError) {
      console.error('Error uploading file:', uploadError)
      throw uploadError
    }
    
    // Add the file to the database with encryption information if available
    try {
      // Create a unique ID for the file
      const fileId = uuidv4();
      
      // Prepare the record with proper handling of encryption metadata
      const encryptionMetadata = isEncrypted ? { iv } : null
      const fileRecord = {
        id: fileId,
        name: file.name,
        path: data?.path,
        size: file.size,
        type: file.type,
        user_id: userId,
        shared: false,
        is_encrypted: isEncrypted,
        original_type: originalType,
        encryption_metadata: encryptionMetadata
      }

      console.log('Inserting file record with encryption data:', { 
        isEncrypted, 
        hasMetadata: !!encryptionMetadata,
        originalType
      });

      const { data: dbData, error: dbError } = await supabase.from('files').insert(fileRecord).select('id')

      if (dbError) {
        console.error('Error inserting file record:', dbError)
        throw new Error(`Database error: ${dbError.message}`);
      }
      
      // Store the encryption key if the file is encrypted
      if (isEncrypted && fileKey) {
        console.log(`Storing encryption key for file: ${fileId}`);
        
        try {
          // Encrypt the file key with the server's key
          const encryptedKey = encryptFileKey(fileKey)
          
          // First check if a key already exists for this file
          const { data: existingKey } = await supabase
            .from('file_keys')
            .select('id')
            .eq('file_id', fileId)
            .maybeSingle();
            
          if (existingKey) {
            // Update the existing key
            const { error: updateError } = await supabase
              .from('file_keys')
              .update({ encrypted_key: encryptedKey })
              .eq('file_id', fileId);
              
            if (updateError) {
              console.error('Error updating file key:', updateError);
              throw updateError;
            }
          } else {
            // Insert a new key
            const { error: insertError } = await supabase
              .from('file_keys')
              .insert({
                file_id: fileId,
                encrypted_key: encryptedKey
              });
              
            if (insertError) {
              console.error('Error storing file key:', insertError);
              throw insertError;
            }
          }
          
          console.log('File key stored successfully');
        } catch (keyError: any) {
          console.error('Error processing file key:', keyError);
          // In production, you should consider rolling back the file upload
          // if the key storage fails, as the file won't be decryptable
        }
      }
      
      return NextResponse.json({
        success: true,
        message: 'File uploaded successfully',
        path: filePath,
        fileId: dbData?.[0]?.id,
        encrypted: isEncrypted
      })
    } catch (e: any) {
      // If it's the missing shared column, try without it
      if (e.message === 'shared_column_missing') {
        // Create a base record with the mandatory fields
        const baseRecord: any = {
          name: file.name,
          size: file.size,
          // Use application/octet-stream for encrypted files
          type: isEncrypted ? 'application/octet-stream' : file.type,
          path: filePath,
          user_id: userId
        }
        
        // Try to add encryption fields if available
        try {
          if (isEncrypted) {
            // First check if the encryption columns exist
            const { data: tableInfo, error: tableInfoError } = await supabase
              .from('files')
              .select('is_encrypted')
              .limit(1)
              
            // If we can query is_encrypted, it exists
            if (!tableInfoError) {
              baseRecord.is_encrypted = true
              baseRecord.original_type = originalType
              if (iv) {
                baseRecord.encryption_metadata = { iv }
              }
              console.log('Adding encryption fields to fallback record')
            } else {
              console.log('Encryption columns not available in fallback mode')
            }
          }
        } catch (encryptionError) {
          console.error('Error checking encryption columns:', encryptionError)
          // Continue without encryption fields
        }
        
        // Now insert the record
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('files')
          .insert(baseRecord)
          .select()
        
        if (fallbackError) {
          throw fallbackError
        }
        
        return NextResponse.json({
          success: true,
          message: 'File uploaded successfully (legacy schema)',
          path: filePath,
          fileId: fallbackData?.[0]?.id,
          needsMigration: true
        })
      } else {
        throw e
      }
    }
  } catch (error: any) {
    console.error('Server upload error:', error)
    return NextResponse.json({
      success: false,
      message: `Upload failed: ${error.message}`
    }, { status: 500 })
  }
} 