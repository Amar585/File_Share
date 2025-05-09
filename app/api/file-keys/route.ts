import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

// Secret key for encrypting file keys
// In production, this should be stored securely in environment variables
const SERVER_ENCRYPTION_KEY = process.env.SERVER_ENCRYPTION_KEY || 'your-server-master-key-at-least-32-chars';
const SERVER_ENCRYPTION_IV = process.env.SERVER_ENCRYPTION_IV || 'your-server-iv16';

// Encrypt a file key with the server's master key
function encryptFileKey(fileKey: string): string {
  const cipher = crypto.createCipheriv(
    'aes-256-gcm', 
    Buffer.from(SERVER_ENCRYPTION_KEY), 
    Buffer.from(SERVER_ENCRYPTION_IV, 'utf8').slice(0, 16)
  );
  
  let encrypted = cipher.update(fileKey, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  return encrypted;
}

// Decrypt a file key with the server's master key
function decryptFileKey(encryptedFileKey: string): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(SERVER_ENCRYPTION_KEY),
    Buffer.from(SERVER_ENCRYPTION_IV, 'utf8').slice(0, 16)
  );
  
  let decrypted = decipher.update(encryptedFileKey, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Store a file key in the database
export async function POST(request: NextRequest) {
  try {
    // Get the admin client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Get the user's session
    const cookieStore = cookies();
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
        }
      }
    );
    
    // Manually pass the session cookie if needed
    const sessionCookie = cookieStore.get('sb-session');
    if (sessionCookie) {
      // Set the session manually if needed
      await supabaseClient.auth.setSession({
        access_token: sessionCookie.value,
        refresh_token: '',
      });
    }
    
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized'
      }, { status: 401 });
    }
    
    // Parse the request body
    const { fileId, fileKey } = await request.json();
    
    if (!fileId || !fileKey) {
      return NextResponse.json({
        success: false,
        message: 'Missing required parameters'
      }, { status: 400 });
    }
    
    // Encrypt the file key
    const encryptedKey = encryptFileKey(fileKey);
    
    // Store the encrypted key in the database
    const { data, error } = await supabase
      .from('file_keys')
      .insert({
        file_id: fileId,
        encrypted_key: encryptedKey
      });
    
    if (error) {
      console.error('Error storing file key:', error);
      return NextResponse.json({
        success: false,
        message: `Failed to store file key: ${error.message}`
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
export async function GET(request: NextRequest) {
  try {
    // Get URL parameters
    const url = new URL(request.url);
    const fileId = url.searchParams.get('fileId');
    
    if (!fileId) {
      return NextResponse.json({
        success: false,
        message: 'Missing fileId parameter'
      }, { status: 400 });
    }
    
    // Get the admin client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Get the user's session
    const cookieStore = cookies();
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
    }
  }
);

// Manually pass the session cookie if needed
const sessionCookie = cookieStore.get('sb-session');
if (sessionCookie) {
  // Set the session manually if needed
  await supabaseClient.auth.setSession({
    access_token: sessionCookie.value,
    refresh_token: '',
  });
}
    
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized'
      }, { status: 401 });
    }
    
    // First check if the user has access to the file
    const { data: fileData, error: fileError } = await supabase
      .from('files')
      .select('user_id, shared')
      .eq('id', fileId)
      .single();
    
    if (fileError) {
      console.error('Error checking file access:', fileError);
      return NextResponse.json({
        success: false,
        message: `Failed to check file access: ${fileError.message}`
      }, { status: 500 });
    }
    
    const userId = session.user.id;
    
    // Check if the user owns the file or if it's shared
    if (fileData.user_id !== userId && !fileData.shared) {
      return NextResponse.json({
        success: false,
        message: 'Access denied'
      }, { status: 403 });
    }
    
    // Retrieve the encrypted key
    const { data, error } = await supabase
      .from('file_keys')
      .select('encrypted_key')
      .eq('file_id', fileId)
      .single();
    
    if (error) {
      console.error('Error retrieving file key:', error);
      return NextResponse.json({
        success: false,
        message: `Failed to retrieve file key: ${error.message}`
      }, { status: 500 });
    }
    
    // Decrypt the file key
    const decryptedKey = decryptFileKey(data.encrypted_key);
    
    return NextResponse.json({
      success: true,
      fileKey: decryptedKey
    });
  } catch (error: any) {
    console.error('Server error:', error);
    return NextResponse.json({
      success: false,
      message: `Server error: ${error.message}`
    }, { status: 500 });
  }
}
