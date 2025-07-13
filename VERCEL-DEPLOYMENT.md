# Vercel Deployment Guide

## Prerequisites
- Vercel account (free tier works)
- GitHub account
- Supabase project

## Step 1: Prepare Your Repository

1. **Push your code to GitHub** (if not already done):
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```

## Step 2: Deploy to Vercel

### Option A: Using Vercel CLI (Recommended)

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy from project directory**:
   ```bash
   vercel
   ```

4. **Follow the prompts**:
   - Link to existing project? No
   - Project name: your-file-sharing-platform
   - Directory: ./
   - Want to override settings? No

### Option B: Using Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "Import Project"
3. Connect your GitHub repository
4. Select your repository
5. Configure the project settings

## Step 3: Configure Environment Variables

In your Vercel dashboard:

1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add the following variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
NEXT_PUBLIC_VERCEL_URL=https://your-app.vercel.app
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SENDER_EMAIL=your-email@gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SUPABASE_PROJECT_REF=your_project_ref
SERVER_ENCRYPTION_KEY=your_32_character_key
SERVER_ENCRYPTION_IV=your_16_character_iv
```

## Step 4: Update Supabase Configuration

1. **Update Site URL in Supabase**:
   - Go to your Supabase project
   - Navigate to Authentication > Settings
   - Update "Site URL" to your Vercel deployment URL

2. **Update Redirect URLs**:
   - Add your Vercel URL to "Redirect URLs"
   - Format: `https://your-app.vercel.app/auth/callback`

## Step 5: Database Migration

After deployment, run the database migration:

1. In your Vercel dashboard, go to Functions
2. Or run locally: `node run-migration.js`

## Step 6: Test Your Deployment

1. Visit your Vercel URL
2. Test user registration and login
3. Test file upload and sharing
4. Check email verification (if configured)

## Troubleshooting

### Common Issues:

1. **Build Errors**: Check the build logs in Vercel dashboard
2. **Database Connection**: Verify Supabase environment variables
3. **Email Issues**: Check SMTP configuration
4. **File Upload**: Ensure Supabase storage is configured

### Useful Commands:

```bash
# Check deployment status
vercel --prod

# View logs
vercel logs

# Redeploy
vercel --prod --force
```

## Security Considerations

- Never commit `.env.local` to version control
- Use strong encryption keys
- Enable Row Level Security in Supabase
- Configure proper CORS settings
- Use HTTPS in production

## Performance Optimization

- The project uses Next.js optimizations
- Images are unoptimized (you may want to enable this)
- Consider adding Redis for caching
- Use CDN for static assets

## Monitoring

- Monitor performance in Vercel dashboard
- Set up error tracking (Sentry, etc.)
- Monitor Supabase usage
- Set up alerts for high resource usage
