# 🚀 Daveenci AI CRM - Business Card Processing Pipeline

An intelligent, serverless business card processing system that automatically extracts contact information, performs business research, and stores data in a PostgreSQL database with Telegram notifications.

## 🏗️ Architecture

```
📱 iPhone Shortcut → 📂 GitHub Repo → 🚀 Vercel Function → 🧠 Gemini AI → 🐘 PostgreSQL → 📱 Telegram
```

### Key Components

- **📱 iPhone Shortcut**: Captures business card images and uploads to GitHub
- **📂 GitHub Repository**: Stores images and triggers webhooks
- **🚀 Vercel Serverless Function**: Processes images and orchestrates the pipeline
- **🧠 Google Gemini AI**: Extracts data and performs business research
- **🐘 PostgreSQL Database**: Stores contacts and touchpoints
- **📱 Telegram Bot**: Sends research summaries and notifications

## ✨ Features

- **🤖 AI-Powered Extraction**: Uses Gemini Vision to extract contact information from business card images
- **🔍 Business Research**: Automatically researches contacts and companies
- **📱 Telegram Notifications**: Receive research summaries on your phone
- **🔄 Touchpoint Tracking**: Tracks when you meet existing contacts again
- **🔒 Secure**: Webhook signature verification and environment variable protection
- **⚡ Serverless**: Scales automatically with no server management
- **📊 Database Integration**: Seamless integration with existing CRM database

## 🚀 Quick Start

### 1. Prerequisites

- [Vercel Account](https://vercel.com/signup)
- [GitHub Account](https://github.com/signup)
- [Google AI Studio](https://aistudio.google.com/) (for Gemini API)
- [Telegram Account](https://telegram.org/)
- PostgreSQL Database (Neon, Supabase, or your own)

### 2. Clone and Setup

```bash
git clone https://github.com/yourusername/daveenci-ai-crm-business-cards.git
cd daveenci-ai-crm-business-cards
npm install
```

### 3. Environment Setup

```bash
# Copy environment template
cp env_example.txt .env

# Run setup script
npm run setup
```

### 4. Deploy to Vercel

```bash
# Deploy using Vercel CLI
npm i -g vercel
vercel login
vercel

# Or deploy from GitHub
# 1. Push to GitHub
# 2. Connect to Vercel
# 3. Configure environment variables
```

### 5. Configure Services

Follow the detailed setup guides:

- [📱 iPhone Shortcut Setup](./iPhone-Shortcut-Setup.md)
- [🚀 Deployment Guide](./DEPLOYMENT_GUIDE.md)

## 📋 Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# AI Services
GEMINI_API_KEY=your_gemini_api_key

# Telegram
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id

# GitHub
GITHUB_WEBHOOK_SECRET=your_github_webhook_secret
GITHUB_REPO=username/repository-name
```

## 🔧 Development

### Local Development

```bash
# Start development server
npm run dev

# Test components
npm test

# Test specific component
node test-serverless.js validation
node test-serverless.js webhook
node test-serverless.js database
```

### Testing

```bash
# Test API endpoints
npm run test-api

# Test enhanced features
npm run test

# Test serverless function
node test-serverless.js
```

## 📁 Project Structure

```
daveenci-ai-crm-business-cards/
├── api/
│   └── webhook.js              # Vercel serverless function entry point
├── services/
│   ├── ai-research.js          # AI research service
│   └── telegram-notification.js # Telegram notification service
├── serverless-function.js      # Main serverless processing logic
├── server.js                   # Express server (for local development)
├── vercel.json                 # Vercel configuration
├── package.json                # Dependencies and scripts
├── iPhone-Shortcut-Setup.md    # iPhone shortcut configuration guide
├── DEPLOYMENT_GUIDE.md         # Complete deployment instructions
├── test-serverless.js          # Serverless function tests
└── README.md                   # This file
```

## 🔄 Workflow

### 1. Capture Business Card
- Use iPhone Shortcut to take photo
- Image automatically uploaded to GitHub repository

### 2. Process Image
- GitHub webhook triggers Vercel function
- Gemini AI extracts contact information
- Data validated and cleaned

### 3. Database Operations
- Check if contact already exists
- Insert new contact or add touchpoint
- Store research data in notes field

### 4. Research & Notify
- Gemini AI researches contact and company
- Formatted research sent to Telegram
- Includes conversation starters and insights

## 🧪 Testing

### Test Individual Components

```bash
# Test data validation
node test-serverless.js validation

# Test webhook logic
node test-serverless.js webhook

# Test database operations
node test-serverless.js database

# Test AI extraction (requires API key)
node test-serverless.js extraction

# Test business research (requires API key)
node test-serverless.js research
```

### Test Complete Pipeline

1. **Manual Upload Test**
   - Upload image to GitHub repository
   - Check Telegram for notification
   - Verify database entry

2. **iPhone Shortcut Test**
   - Use shortcut to capture business card
   - Verify complete flow works
   - Check all notifications

## 🔧 Configuration

### Database Schema

The system works with your existing database schema:

```sql
-- Contacts table (existing)
CREATE TABLE contacts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  primary_email VARCHAR(255),
  secondary_email VARCHAR(255),
  primary_phone VARCHAR(50),
  secondary_phone VARCHAR(50),
  website VARCHAR(255),
  address TEXT,
  source VARCHAR(100),
  status VARCHAR(50),
  user_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Touchpoints table (auto-created if needed)
CREATE TABLE touchpoints (
  id SERIAL PRIMARY KEY,
  contact_id INTEGER REFERENCES contacts(id),
  note TEXT NOT NULL,
  source VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### AI Research Storage

Research data is stored in the existing `notes` field to avoid schema changes:

```json
{
  "ai_research": {
    "summary": "Research summary...",
    "company_info": "Company details...",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

## 🚀 Deployment Options

### Vercel (Recommended)
- Free tier available
- Automatic scaling
- Global CDN
- Easy GitHub integration

### Other Serverless Platforms
- AWS Lambda
- Google Cloud Functions
- Azure Functions
- Netlify Functions

## 📊 Monitoring

### Vercel Dashboard
- Function execution logs
- Performance metrics
- Error tracking

### GitHub Webhooks
- Delivery status
- Payload inspection
- Retry configuration

### Database Monitoring
- Contact creation tracking
- Touchpoint logging
- Performance metrics

## 🔒 Security

- **Webhook Verification**: GitHub signature validation
- **Environment Variables**: Secure secret management
- **HTTPS Only**: All API calls use HTTPS
- **Input Validation**: Comprehensive data validation
- **Error Handling**: Graceful error handling without exposing internals

## 💰 Cost Optimization

### Free Tier Limits
- **Vercel**: 100GB-hours/month
- **Gemini**: 15 requests/minute
- **Neon**: 0.5GB storage, 10GB transfer
- **GitHub**: Unlimited private repos

### Estimated Monthly Costs
- **Low Usage** (< 100 cards/month): Free
- **Medium Usage** (100-1000 cards/month): ~$5-10
- **High Usage** (> 1000 cards/month): ~$20-50

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📞 Support

- **Documentation**: Check the guides in this repository
- **Issues**: Create an issue on GitHub
- **Discussions**: Use GitHub Discussions for questions

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Google Gemini AI for intelligent processing
- Vercel for serverless hosting
- GitHub for repository and webhook services
- Telegram for notifications

---

**Ready to automate your business card processing?** 🚀

Follow the [Deployment Guide](./DEPLOYMENT_GUIDE.md) to get started!
