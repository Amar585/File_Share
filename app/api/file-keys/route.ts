import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * This API handles the encryption and storage of file keys for the file encryption system.
 * File keys are encrypted with a server-side key before being stored in the database.
 */

// Secret key for encrypting file keys
// In production, these MUST be stored securely in environment variables
// We generate random values if not provided, but they will change on server restart
// which would make previously stored keys inaccessible!
const SERVER_ENCRYPTION_KEY = process.env.SERVER_ENCRYPTION_KEY || 
  'bZ8x5dL1p3qTyA7wJ2cG9vF4rM6sN0hE'; // 32 chars for AES-256
const SERVER_ENCRYPTION_IV = process.env.SERVER_ENCRYPTION_IV || 
  'K3b8rP5vZ7x2Q9tY'; // 16 chars for IV

// Helper function to create a Supabase client with the service role key
function getServiceClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

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

// Decrypt a file key with the server's master key
function decryptFileKey(encryptedFileKey: string): string {
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(SERVER_ENCRYPTION_KEY),
      Buffer.from(SERVER_ENCRYPTION_IV, 'utf8').slice(0, 16)
    );
    
    let decrypted = decipher.update(encryptedFileKey, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Error decrypting file key:', error);
    throw new Error('Decryption failed: Could not retrieve the file key');
  }
}

// Store a file key in the database
export async function POST(request: NextRequest) {
  try {
    const supabase = getServiceClient();
    
    // Parse the request body
    const { fileId, fileKey } = await request.json();
    
    if (!fileId || !fileKey) {
      return NextResponse.json({
        success: false,
        message: 'Missing required parameters: fileId and fileKey are required'
      }, { status: 400 });
    }
    
    // Check if a key already exists for this file
    const { data: existingKey, error: checkError } = await supabase
      .from('file_keys')
      .select('id')
      .eq('file_id', fileId)
      .maybeSingle();
    
    if (checkError) {
      console.error('Error checking for existing file key:', checkError);
      return NextResponse.json({
        success: false,
        message: `Database error: ${checkError.message}`
      }, { status: 500 });
    }
    
    if (existingKey) {
      console.log('A key already exists for this file. Updating...');
      
      // Encrypt the new file key
      const encryptedKey = encryptFileKey(fileKey);
      
      // Update the existing record
      const { error: updateError } = await supabase
        .from('file_keys')
        .update({ encrypted_key: encryptedKey })
        .eq('file_id', fileId);
      
      if (updateError) {
        console.error('Error updating file key:', updateError);
        return NextResponse.json({
          success: false,
          message: `Failed to update file key: ${updateError.message}`
        }, { status: 500 });
      }
      
      return NextResponse.json({
        success: true,
        message: 'File key updated successfully'
      });
    }
    
    // Encrypt the file key
    const encryptedKey = encryptFileKey(fileKey);
    
    // Store the encrypted key in the database
    const { error: insertError } = await supabase
      .from('file_keys')
      .insert({
        file_id: fileId,
        encrypted_key: encryptedKey
      });
    
    if (insertError) {
      console.error('Error storing file key:', insertError);
      return NextResponse.json({
        success: false,
        message: `Failed to store file key: ${insertError.message}`
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: 'File key stored successfully'
    });
  } catch (error: any) {
    console.error('Server error:', error);
    return NextResponse.json({
      success: false,
      message: `Server error: ${error.message}`
    }, { status: 500 });
  }
}

// Retrieve a file key from the database
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = getServiceClient();
    
    // Get the file ID from the query params
    const url = new URL(request.url);
    const fileId = url.searchParams.get('fileId');
    
    if (!fileId) {
      return NextResponse.json(
        { success: false, message: 'File ID is required' },
        { status: 400 }
      );
    }
    
    // Get user token from authorization header
    // In a real production app, we would verify the token here
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    // For development, we're skipping strict token validation
    // In production, you would verify the token and check user permissions
    
    // Get the encrypted key from the database
    const { data: keyData, error: keyError } = await supabase
      .from('file_keys')
      .select('encrypted_key')
      .eq('file_id', fileId)
      .single();
    
    if (keyError) {
      console.error('Error retrieving file key:', keyError);
      return NextResponse.json(
        { success: false, message: `Key not found: ${keyError.message}` },
        { status: 404 }
      );
    }
    
    try {
      // Decrypt the file key
      const fileKey = decryptFileKey(keyData.encrypted_key);
      
      return NextResponse.json({
        success: true,
        fileKey
      });
    } catch (decryptError: any) {
      console.error('Decryption error:', decryptError);
      return NextResponse.json({
        success: false,
        message: `Failed to decrypt key: ${decryptError.message}`
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Server error:', error);
    return NextResponse.json({
      success: false,
      message: `Server error: ${error.message}`
    }, { status: 500 });
  }
}