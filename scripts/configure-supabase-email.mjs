#!/usr/bin/env node

// This script configures Supabase SMTP settings using the Supabase Management API
// You'll need to install the supabase-management-js package:
// npm install supabase-management-js

import { createClient } from 'supabase-management-js'
import dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load environment variables from .env.local
try {
  const envPath = resolve(__dirname, '../.env.local')
  const envConfig = dotenv.parse(readFileSync(envPath))
  
  for (const key in envConfig) {
    process.env[key] = envConfig[key]
  }
} catch (err) {
  console.error('Error loading .env.local file:', err)
  process.exit(1)
}

async function configureSupabaseEmail() {
  // Check for required environment variables
  const requiredVars = [
    'SUPABASE_ACCESS_TOKEN',
    'SUPABASE_PROJECT_REF',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'SENDER_EMAIL'
  ]
  
  const missingVars = requiredVars.filter(name => !process.env[name])
  
  if (missingVars.length > 0) {
    console.error(`Missing required environment variables: ${missingVars.join(', ')}`)
    console.error('Please add these to your .env.local file')
    process.exit(1)
  }
  
  try {
    // Create Supabase Management client
    const supabase = createClient(process.env.SUPABASE_ACCESS_TOKEN)
    
    // Get project reference ID from your project URL
    const projectRef = process.env.SUPABASE_PROJECT_REF
    
    // Configure SMTP settings
    const { error } = await supabase.auth.updateConfig(
      projectRef,
      {
        SMTP_ADMIN_EMAIL: process.env.SENDER_EMAIL,
        SMTP_HOST: process.env.SMTP_HOST,
        SMTP_PORT: process.env.SMTP_PORT,
        SMTP_USER: process.env.SMTP_USER,
        SMTP_PASS: process.env.SMTP_PASS,
        SMTP_SENDER_NAME: 'FileShare Platform',
      }
    )
    
    if (error) {
      throw error
    }
    
    console.log('✅ Supabase SMTP settings configured successfully!')
    console.log('Your email verification system should now work correctly')
    
  } catch (error) {
    console.error('Failed to configure SMTP settings:', error)
    process.exit(1)
  }
}

// Run the configuration function
configureSupabaseEmail() 