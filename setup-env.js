#!/usr/bin/env node
/**
 * Environment Setup Script
 * This script helps you create your .env file with the correct configuration
 */

const fs = require('fs');
const path = require('path');

const envTemplate = `# Business Card CRM - Environment Configuration
# Replace the placeholder values with your actual configuration

# Database Configuration (Required)
# Get this from your PostgreSQL provider (e.g., Render, Heroku, etc.)
DATABASE_URL=postgresql://username:password@hostname:port/database_name

# JWT Authentication (Required for production)
# Generate a secure random string for production
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Gemini AI Configuration (Required for AI research)
# Get this from Google AI Studio: https://aistudio.google.com/
GEMINI_API_KEY=your-gemini-api-key-from-google-ai-studio

# Telegram Bot Configuration (Required for notifications)
# Get bot token from @BotFather on Telegram
TELEGRAM_BOT_TOKEN=your-telegram-bot-token-from-botfather
# Get your chat ID by messaging your bot and visiting: https://api.telegram.org/bot<BOT_TOKEN>/getUpdates
TELEGRAM_CHAT_ID=your-telegram-chat-id-or-group-id

# GitHub Webhook Configuration (Required for automatic image processing)
# Generate a secure random string for webhook security
GITHUB_WEBHOOK_SECRET=your-github-webhook-secret-key

# Node.js Configuration
NODE_ENV=development
PORT=5000
`;

function createEnvFile() {
  const envPath = path.join(__dirname, '.env');
  
  // Check if .env already exists
  if (fs.existsSync(envPath)) {
    console.log('⚠️  .env file already exists!');
    console.log('   If you want to recreate it, delete the existing file first.');
    return;
  }
  
  try {
    // Write the template to .env file
    fs.writeFileSync(envPath, envTemplate);
    
    console.log('✅ .env file created successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Edit the .env file and replace placeholder values with your actual configuration');
    console.log('2. Get your database URL from your PostgreSQL provider');
    console.log('3. Get your Gemini API key from Google AI Studio');
    console.log('4. Create a Telegram bot and get the bot token + chat ID');
    console.log('5. Run: npm run migrate');
    console.log('6. Run: npm start');
    console.log('');
    console.log('💡 Need help? Check SETUP_AI_TELEGRAM.md for detailed instructions');
    
  } catch (error) {
    console.error('❌ Error creating .env file:', error.message);
  }
}

function checkEnvFile() {
  const envPath = path.join(__dirname, '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ .env file not found!');
    console.log('   Run this script to create it: node setup-env.js');
    return false;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // Check for placeholder values
  const placeholders = [
    'your-gemini-api-key-from-google-ai-studio',
    'your-telegram-bot-token-from-botfather',
    'your-telegram-chat-id-or-group-id',
    'postgresql://username:password@hostname:port/database_name',
    'your-github-webhook-secret-key'
  ];
  
  const hasPlaceholders = placeholders.some(placeholder => envContent.includes(placeholder));
  
  if (hasPlaceholders) {
    console.log('⚠️  .env file contains placeholder values!');
    console.log('   Please edit the .env file and replace placeholder values with your actual configuration');
    console.log('   Check SETUP_AI_TELEGRAM.md for setup instructions');
    return false;
  }
  
  console.log('✅ .env file looks good!');
  return true;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--check')) {
    checkEnvFile();
  } else {
    createEnvFile();
  }
}

module.exports = { createEnvFile, checkEnvFile }; 