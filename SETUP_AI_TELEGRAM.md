# AI Research & Telegram Notifications Setup Guide

This guide will help you set up the new AI-powered research and Telegram notification features for your business card CRM.

## Overview

Your enhanced business card CRM now includes:
- **AI Research**: Uses Google Gemini to automatically research people and companies from business cards
- **Telegram Notifications**: Sends research summaries directly to your Telegram account
- **Enhanced Database**: Stores research data for future reference

## Prerequisites

1. **Google AI Studio Account** - for Gemini AI research
2. **Telegram Bot** - for notifications
3. **PostgreSQL Database** - already configured

## Step 1: Get Google Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Click "Get API Key" 
4. Create a new API key or use an existing one
5. Copy the API key (starts with `AIza...`)

## Step 2: Create Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Start a chat and send `/newbot`
3. Follow the prompts to create your bot:
   - Choose a name (e.g., "Business Card CRM Bot")
   - Choose a username (e.g., "your_crm_bot")
4. Copy the bot token provided by BotFather
5. **Get your Chat ID**:
   - Send a message to your new bot
   - Visit: `https://api.telegram.org/bot<BOT_TOKEN>/getUpdates`
   - Find your chat ID in the response (usually a positive number)

## Step 3: Configure Environment Variables

Add these new variables to your `.env` file:

```bash
# Existing variables
DATABASE_URL=your_postgresql_url
JWT_SECRET=your_jwt_secret
NODE_ENV=production
PORT=5000

# NEW: AI Research Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# NEW: Telegram Bot Configuration  
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here
```

## Step 4: Install Dependencies & Run Migration

```bash
# Install new dependencies
npm install

# Run database migration to add research_data column
npm run migrate

# Verify the migration worked
npm run check-schema
```

## Step 5: Test the Setup

### Test Telegram Integration
```bash
curl -X POST "https://your-app-url.com/admin/test-telegram" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Test AI Research
```bash
curl -X POST "https://your-app-url.com/admin/test-ai-research" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

## Step 6: Start Your Server

```bash
npm start
```

You should see these startup messages:
```
✅ AI Research Service initialized
✅ Telegram Notification Service initialized
```

## How It Works

### Enhanced Business Card Processing

When you scan a business card with your iPhone shortcut:

1. **Data Processing**: Contact info is cleaned and validated (as before)
2. **AI Research**: Gemini analyzes the person/company and generates insights
3. **Database Storage**: Contact + research data saved to PostgreSQL
4. **Telegram Notification**: Summary sent to your Telegram

### What Gets Researched

The AI will research:
- **Professional Background**: Current role, career history
- **Company Analysis**: Business model, market position, recent news
- **Industry Insights**: Trends, challenges, opportunities  
- **Business Opportunities**: Potential collaborations
- **Communication Strategy**: How to approach this contact
- **Recent Activities**: News, publications, speaking events

### Telegram Notification Format

You'll receive messages like:
```
🔗 New Business Card Scanned

👤 Contact Details:
• Name: John Smith
• Company: Tech Corp
• Industry: Software
• Email: john@techcorp.com

🤖 AI Research Summary:
John Smith is a Senior Director at Tech Corp, specializing in enterprise software solutions...

📊 Research Quality: 🟢 high

💡 Key Insights Available:
• Professional Background ✅
• Company Analysis ✅
• Business Opportunities ✅

⏰ Processed: 2024-01-15 10:30:15
💼 View in CRM for detailed research insights
```

## API Endpoints

### New Research Endpoints

- `GET /contacts/:id/research` - Get research data for a contact
- `POST /contacts/:id/research` - Run AI research for existing contact
- `POST /admin/test-telegram` - Test Telegram integration
- `POST /admin/test-ai-research` - Test AI research

### Enhanced Process Card

Your existing `/process-card` endpoint now automatically:
- Runs AI research
- Sends Telegram notifications
- Stores research data

## Troubleshooting

### Common Issues

1. **AI Research Not Working**
   - Check `GEMINI_API_KEY` is correct
   - Verify you have Gemini API access
   - Check API quotas in Google AI Studio

2. **Telegram Not Working**
   - Verify `TELEGRAM_BOT_TOKEN` is correct
   - Check `TELEGRAM_CHAT_ID` is your actual chat ID
   - Make sure you've started the bot

3. **Database Issues**
   - Run `npm run check-schema` to verify schema
   - Re-run `npm run migrate` if needed

### Error Messages

- "AI Research service not available" → Check GEMINI_API_KEY
- "Telegram service not available" → Check bot token/chat ID
- "research_data column doesn't exist" → Run migration

## Cost Considerations

### Google Gemini API
- Gemini 1.5 Flash is cost-effective for this use case
- Estimate: ~$0.01-0.05 per business card research
- Monitor usage in Google AI Studio

### Telegram Bot
- Free for personal use
- No additional costs

## Privacy & Security

- Research data is stored securely in your PostgreSQL database
- API keys should be kept secure and not shared
- Research uses only publicly available information
- Telegram messages are encrypted

## Next Steps

1. Test with a few business cards to verify everything works
2. Monitor research quality and adjust prompts if needed
3. Consider adding research data to your CRM dashboard
4. Set up monitoring/alerts for API usage

## Support

If you encounter issues:
1. Check the server logs for error messages
2. Test individual components (AI, Telegram) separately
3. Verify all environment variables are set correctly
4. Ensure database migration completed successfully

Your business card CRM is now powered by AI! 🚀 