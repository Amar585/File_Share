# File Sharing Platform

A secure file sharing platform built with Next.js and Supabase, featuring user authentication, file encryption, and access control.

## Setup Options

You can run this project either using Docker (recommended) or local setup.

## Option 1: Docker Setup (Recommended)

### Prerequisites
- Docker
- Docker Compose

### Quick Start

1. Clone the repository:
```bash
git clone https://github.com/Amar585/File_Share.git
cd file-sharing-platform
```

2. Create a `.env` file with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

3. Start the application:
```bash
docker-compose up --build
```

The application will be available at [http://localhost:3000](http://localhost:3000)

### Using Local Supabase (Optional)
The docker-compose configuration includes a local Supabase instance. To use it:

1. Access Supabase Studio at [http://localhost:54322](http://localhost:54322)
2. Run migrations:
```bash
docker-compose exec app node run-migration.js
```

## Option 2: Local Setup

### Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v18 or higher)
- npm (Node Package Manager)
- A Supabase account (for database and authentication)

### Setup Instructions

1. Clone the Repository:
```bash
git clone https://github.com/Amar585/File_Share.git
cd file-sharing-platform
```

2. Supabase Setup:
   - Create a new project at [https://supabase.com](https://supabase.com)
   - Go to Project Settings > API to get your:
     - Project URL
     - anon/public key
     - service_role key (for migrations)

3. Environment Configuration:
   Create a `.env.local` file:
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

4. Install Dependencies:
```bash
npm install
```

5. Database Setup:
```bash
node run-migration.js
```

6. Start the Development Server:
```bash
npm run dev
```

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

### Docker Setup Issues
1. Ensure Docker and Docker Compose are properly installed
2. Check if any services are using the required ports
3. Try rebuilding the containers: `docker-compose up --build --force-recreate`
4. Check container logs: `docker-compose logs -f`

### Local Setup Issues
1. Ensure all environment variables are correctly set
2. Check if Supabase is properly configured
3. Verify that all migrations have run successfully
4. Clear your browser cache if you experience UI issues

## Security Considerations

- Keep your Supabase keys secure and never expose them
- Regular backups of the database are recommended
- Monitor file storage usage in your Supabase dashboard

For additional help or questions, please contact the project maintainer.
