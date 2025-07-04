# 🚀 Deployment Guide: Serverless Business Card CRM

## Overview
This guide walks you through deploying your enhanced serverless business card processing pipeline to Vercel.

## Architecture Summary

```
📱 iPhone Shortcut → 📂 GitHub Repo → 🚀 Vercel Function → 🧠 Gemini AI → 🐘 PostgreSQL → 📱 Telegram
```

## Prerequisites

### 1. Required Accounts
- [Vercel Account](https://vercel.com/signup) (free tier available)
- [GitHub Account](https://github.com/signup)
- [Google AI Studio](https://aistudio.google.com/) (for Gemini API key)
- [Telegram Account](https://telegram.org/) (for bot setup)
- PostgreSQL Database (Neon, Supabase, or your own)

### 2. Required API Keys & Tokens
- Google Gemini API Key
- Telegram Bot Token
- GitHub Personal Access Token
- Database Connection String

## Step 1: Set Up Your Database

### Option A: Neon (Recommended - Free Tier)
1. Go to [neon.tech](https://neon.tech)
2. Create account and new project
3. Copy the connection string
4. Run the database setup script:

```bash
# Update your .env file with the connection string
DATABASE_URL="postgresql://user:password@host:port/database"

# Run the setup script
node setup-env.js
```

### Option B: Supabase
1. Go to [supabase.com](https://supabase.com)
2. Create account and new project
3. Go to Settings > Database
4. Copy the connection string
5. Run the setup script as above

### Option C: Your Own PostgreSQL
1. Set up PostgreSQL server
2. Create database and user
3. Run the setup script

## Step 2: Set Up Telegram Bot

1. **Create Bot**
   - Message [@BotFather](https://t.me/botfather) on Telegram
   - Send `/newbot`
   - Follow instructions to create bot
   - **Save the bot token**

2. **Get Your Chat ID**
   - Message your bot: `/start`
   - Go to: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Find your `chat_id` in the response
   - **Save the chat ID**

## Step 3: Get Google Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with Google account
3. Click "Get API key"
4. Create new API key
5. **Save the API key**

## Step 4: Create GitHub Repository

1. **Create Repository**
   ```bash
   # Create new repository for business card images
   # Name: daveenci-ai-crm-business-card-images
   # Make it private
   ```

2. **Create Cards Folder**
   - Add a `cards/` folder to your repository
   - This is where images will be uploaded

3. **Set Up Webhook**
   - Go to repository Settings > Webhooks
   - Click "Add webhook"
   - Payload URL: `https://your-vercel-app.vercel.app/api/webhook`
   - Content type: `application/json`
   - Events: Select "Just the push event"
   - **Generate webhook secret** and save it

## Step 5: Deploy to Vercel

### Option A: Deploy from GitHub (Recommended)

1. **Push Code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/your-repo-name.git
   git push -u origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect it's a Node.js project

3. **Configure Environment Variables**
   - In Vercel project settings, go to "Environment Variables"
   - Add these variables:
   ```
   DATABASE_URL=your_database_connection_string
   GEMINI_API_KEY=your_gemini_api_key
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   TELEGRAM_CHAT_ID=your_telegram_chat_id
   GITHUB_WEBHOOK_SECRET=your_github_webhook_secret
   GITHUB_REPO=yourusername/your-repo-name
   ```

4. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete
   - **Save your Vercel URL**

### Option B: Deploy with Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login and Deploy**
   ```bash
   vercel login
   vercel
   ```

3. **Set Environment Variables**
   ```bash
   vercel env add DATABASE_URL
   vercel env add GEMINI_API_KEY
   vercel env add TELEGRAM_BOT_TOKEN
   vercel env add TELEGRAM_CHAT_ID
   vercel env add GITHUB_WEBHOOK_SECRET
   vercel env add GITHUB_REPO
   ```

## Step 6: Update GitHub Webhook

1. Go back to your GitHub repository webhook settings
2. Update the Payload URL with your Vercel URL:
   ```
   https://your-app-name.vercel.app/api/webhook
   ```
3. Save the webhook

## Step 7: Test the Pipeline

### Test 1: Manual Upload
1. Upload a business card image to your GitHub repository
2. Place it in the `cards/` folder
3. Commit and push
4. Check your Telegram for the notification

### Test 2: iPhone Shortcut
1. Follow the [iPhone Shortcut Setup Guide](./iPhone-Shortcut-Setup.md)
2. Test with a real business card
3. Verify the complete flow works

## Step 8: Monitor and Debug

### Vercel Logs
- Go to your Vercel dashboard
- Click on your project
- Go to "Functions" tab
- Click on the webhook function
- View real-time logs

### GitHub Webhook Deliveries
- Go to repository Settings > Webhooks
- Click on your webhook
- View recent deliveries
- Check for any failed deliveries

### Database Monitoring
- Check your database for new contacts
- Verify touchpoints are being created
- Monitor for any errors

## Troubleshooting

### Common Issues

1. **"Invalid webhook signature"**
   - Check your `GITHUB_WEBHOOK_SECRET` matches GitHub
   - Verify webhook is configured correctly

2. **"Database connection failed"**
   - Check your `DATABASE_URL` is correct
   - Ensure database is accessible from Vercel
   - Check SSL settings for production

3. **"Gemini API error"**
   - Verify your `GEMINI_API_KEY` is correct
   - Check API quota and billing
   - Ensure you're using the correct model

4. **"Telegram notification failed"**
   - Check `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`
   - Verify bot has permission to send messages
   - Check message formatting

5. **"Function timeout"**
   - Vercel functions have 10-second timeout on free tier
   - Consider upgrading to Pro for longer timeouts
   - Optimize image processing

### Debugging Steps

1. **Check Environment Variables**
   ```bash
   # In Vercel dashboard, verify all variables are set
   ```

2. **Test Individual Components**
   ```bash
   # Test database connection
   node test-database.js
   
   # Test Gemini API
   node test-gemini.js
   
   # Test Telegram bot
   node test-telegram.js
   ```

3. **Monitor Function Logs**
   - Check Vercel function logs for detailed error messages
   - Look for specific error codes and stack traces

## Production Considerations

### Security
- Use environment variables for all secrets
- Enable GitHub webhook signature verification
- Use HTTPS for all API calls
- Regularly rotate API keys

### Performance
- Consider image compression before upload
- Implement retry logic for failed operations
- Monitor function execution times
- Set up alerts for failures

### Scaling
- Vercel automatically scales with traffic
- Monitor database connection limits
- Consider connection pooling for high traffic
- Set up monitoring and alerting

## Cost Optimization

### Vercel
- Free tier: 100GB-hours/month
- Pro tier: $20/month for unlimited
- Functions: $0.000100 per GB-second

### Gemini API
- Free tier: 15 requests/minute
- Pay-as-you-go: $0.00025 per 1K characters

### Database
- Neon free tier: 0.5GB storage, 10GB transfer
- Supabase free tier: 500MB database, 2GB transfer

## Next Steps

1. **Set up monitoring** with services like Sentry or LogRocket
2. **Create backup procedures** for your database
3. **Implement rate limiting** to prevent abuse
4. **Add analytics** to track usage patterns
5. **Create admin dashboard** for managing contacts

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review Vercel function logs
3. Test individual components
4. Check GitHub webhook deliveries
5. Verify all environment variables

Your serverless business card processing pipeline is now ready for production! 🎉 