# File Sharing Platform

A secure file sharing platform built with Next.js and Supabase, featuring user authentication, file encryption, and access control.

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v18 or higher)
- npm (Node Package Manager)
- A Supabase account (for database and authentication)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/Amar585/File_Share.git
cd file-sharing-platform
```

### 2. Supabase Setup

1. Create a new project at [https://supabase.com](https://supabase.com)
2. Once your project is created, go to Project Settings > API to get your:
   - Project URL
   - anon/public key
   - service_role key (for migrations)

### 3. Environment Configuration

1. Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_VERCEL_URL=http://localhost:3000

# Email Configuration (Optional - for email verification)
SMTP_HOST=your_smtp_host
SMTP_PORT=your_smtp_port
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SENDER_EMAIL=your_sender_email
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Database Setup

The project uses Supabase migrations to set up the database schema. Run the following command to execute the migrations:

```bash
node run-migration.js
```

### 6. Start the Development Server

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## Features

- 🔐 Secure user authentication
- 📁 File upload and management
- 🔄 File sharing with access control
- 📧 Email notifications (if configured)
- 🎨 Modern UI with dark/light mode support

## Usage

1. Register a new account or sign in
2. Navigate to "Upload" to add files
3. Manage your files in "My Files"
4. Share files with other users through "Sharing Management"
5. View shared files in "Shared Files"

## Important Notes

1. The application uses Row Level Security (RLS) in Supabase for data protection
2. File access requests must be approved by file owners
3. Email verification is optional but recommended for production use

## Troubleshooting

If you encounter any issues:

1. Ensure all environment variables are correctly set
2. Check if Supabase is properly configured
3. Verify that all migrations have run successfully
4. Clear your browser cache if you experience UI issues

## Security Considerations

- Keep your Supabase keys secure and never expose them
- Regular backups of the database are recommended
- Monitor file storage usage in your Supabase dashboard

For additional help or questions, please contact the project maintainer.
