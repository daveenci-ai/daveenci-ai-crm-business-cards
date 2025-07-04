#!/usr/bin/env node
/**
 * Enhanced Features Test Script
 * Tests AI Research, Telegram notifications, and GitHub webhook functionality
 */

const axios = require('axios');
require('dotenv').config();

// Test configuration
const config = {
  baseUrl: process.env.API_BASE_URL || 'http://localhost:5000',
  jwt: process.env.TEST_JWT_TOKEN || null,
  timeout: 30000
};

// Test data
const testBusinessCard = {
  name: 'Elon Musk',
  company: 'Tesla',
  email: 'elon@tesla.com',
  phone: '555-123-4567',
  industry: 'Automotive',
  website: 'tesla.com',
  source: 'Test Business Card'
};

const testGithubWebhook = {
  ref: 'refs/heads/main',
  commits: [
    {
      added: ['business-cards/test-card.jpg', 'other-file.txt'],
      modified: [],
      removed: []
    }
  ]
};

// Helper function to make authenticated requests
async function makeRequest(endpoint, data = null, method = 'GET') {
  const options = {
    method,
    url: `${config.baseUrl}${endpoint}`,
    timeout: config.timeout,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (config.jwt) {
    options.headers['Authorization'] = `Bearer ${config.jwt}`;
  }

  if (data && (method === 'POST' || method === 'PUT')) {
    options.data = data;
  }

  try {
    const response = await axios(options);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    };
  }
}

// Test functions
async function testServerHealth() {
  console.log('\n🏥 Testing server health...');
  
  const result = await makeRequest('/');
  if (result.success) {
    console.log('✅ Server is running');
    return true;
  } else {
    console.log('❌ Server health check failed:', result.error);
    return false;
  }
}

async function testAIResearch() {
  console.log('\n🤖 Testing AI Research Service...');
  
  if (!config.jwt) {
    console.log('⚠️  No JWT token provided - skipping AI research test');
    return false;
  }

  const result = await makeRequest('/admin/test-ai-research', null, 'POST');
  
  if (result.success) {
    console.log('✅ AI Research service is working');
    console.log('📊 Test result:', JSON.stringify(result.data.research_result?.research_summary?.substring(0, 100) + '...', null, 2));
    return true;
  } else {
    console.log('❌ AI Research test failed:', result.error);
    console.log('📄 Response:', result.data);
    return false;
  }
}

async function testTelegramNotification() {
  console.log('\n📱 Testing Telegram Notification Service...');
  
  if (!config.jwt) {
    console.log('⚠️  No JWT token provided - skipping Telegram test');
    return false;
  }

  const result = await makeRequest('/admin/test-telegram', null, 'POST');
  
  if (result.success) {
    console.log('✅ Telegram notification service is working');
    console.log('📤 Check your Telegram for the test message');
    return true;
  } else {
    console.log('❌ Telegram test failed:', result.error);
    console.log('📄 Response:', result.data);
    return false;
  }
}

async function testEnhancedProcessCard() {
  console.log('\n🔍 Testing Enhanced Process-Card Endpoint...');
  
  if (!config.jwt) {
    console.log('⚠️  No JWT token provided - skipping process-card test');
    return false;
  }

  console.log('📤 Sending test business card data...');
  const result = await makeRequest('/process-card', testBusinessCard, 'POST');
  
  if (result.success) {
    console.log('✅ Enhanced process-card endpoint working');
    console.log('📊 Contact ID:', result.data.id);
    console.log('🤖 AI Research enabled:', result.data.ai_research?.enabled);
    console.log('📱 Telegram enabled:', result.data.telegram_notification?.enabled);
    
    if (result.data.ai_research?.success) {
      console.log('🧠 AI Research summary:', result.data.ai_research.summary?.substring(0, 100) + '...');
    }
    
    return { success: true, contactId: result.data.id };
  } else {
    console.log('❌ Process-card test failed:', result.error);
    console.log('📄 Response:', result.data);
    return { success: false };
  }
}

async function testContactResearchRetrieval(contactId) {
  console.log('\n📖 Testing Contact Research Retrieval...');
  
  if (!contactId) {
    console.log('⚠️  No contact ID provided - skipping research retrieval test');
    return false;
  }

  const result = await makeRequest(`/contacts/${contactId}/research`);
  
  if (result.success) {
    console.log('✅ Contact research retrieval working');
    console.log('📊 Has research:', result.data.has_research);
    if (result.data.research_summary) {
      console.log('🧠 Research summary:', result.data.research_summary.substring(0, 100) + '...');
    }
    return true;
  } else {
    console.log('❌ Contact research retrieval failed:', result.error);
    return false;
  }
}

async function testGithubWebhook() {
  console.log('\n🔗 Testing GitHub Webhook Endpoint...');
  
  // Create HMAC signature for webhook verification
  const crypto = require('crypto');
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || 'test-secret';
  const payload = JSON.stringify(testGithubWebhook);
  const signature = 'sha256=' + crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
  
  const options = {
    method: 'POST',
    url: `${config.baseUrl}/api/github-webhook`,
    headers: {
      'Content-Type': 'application/json',
      'X-GitHub-Event': 'push',
      'X-Hub-Signature-256': signature
    },
    data: testGithubWebhook,
    timeout: config.timeout
  };
  
  try {
    const response = await axios(options);
    console.log('✅ GitHub webhook endpoint working');
    console.log('📊 Processed images:', response.data.processed_images);
    return true;
  } catch (error) {
    console.log('❌ GitHub webhook test failed:', error.message);
    if (error.response?.data) {
      console.log('📄 Response:', error.response.data);
    }
    return false;
  }
}

async function testEnvironmentCheck() {
  console.log('\n🔧 Checking Environment Configuration...');
  
  const requiredEnvVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'GEMINI_API_KEY',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID',
    'GITHUB_WEBHOOK_SECRET'
  ];
  
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length === 0) {
    console.log('✅ All environment variables configured');
    return true;
  } else {
    console.log('⚠️  Missing environment variables:', missing.join(', '));
    console.log('💡 Run: npm run setup-env to create .env file template');
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('🧪 === ENHANCED FEATURES TEST SUITE ===');
  console.log(`🌐 Testing against: ${config.baseUrl}`);
  console.log(`🔑 JWT Token: ${config.jwt ? 'Provided' : 'Not provided'}`);
  
  const results = {};
  
  // Environment check
  results.environment = await testEnvironmentCheck();
  
  // Server health
  results.serverHealth = await testServerHealth();
  if (!results.serverHealth) {
    console.log('\n❌ Server is not responding. Please start the server first.');
    return;
  }
  
  // Individual feature tests
  results.aiResearch = await testAIResearch();
  results.telegram = await testTelegramNotification();
  
  // Process card test (creates a contact)
  const processCardResult = await testEnhancedProcessCard();
  results.processCard = processCardResult.success;
  
  // Research retrieval test (uses contact from previous test)
  if (processCardResult.contactId) {
    results.researchRetrieval = await testContactResearchRetrieval(processCardResult.contactId);
  }
  
  // GitHub webhook test
  results.githubWebhook = await testGithubWebhook();
  
  // Summary
  console.log('\n📊 === TEST RESULTS SUMMARY ===');
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, result]) => {
    const icon = result ? '✅' : '❌';
    console.log(`${icon} ${test}: ${result ? 'PASSED' : 'FAILED'}`);
  });
  
  console.log(`\n🎯 Overall: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Your enhanced business card CRM is ready to go!');
  } else {
    console.log('⚠️  Some tests failed. Check the configuration and try again.');
    console.log('💡 Tip: Make sure to configure your .env file with valid API keys');
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log(`
Enhanced Features Test Script

Usage:
  node test-enhanced-features.js [options]

Environment Variables:
  API_BASE_URL          Base URL for the API (default: http://localhost:5000)
  TEST_JWT_TOKEN        JWT token for authenticated endpoints
  GEMINI_API_KEY        Google Gemini API key
  TELEGRAM_BOT_TOKEN    Telegram bot token
  TELEGRAM_CHAT_ID      Telegram chat ID
  GITHUB_WEBHOOK_SECRET GitHub webhook secret

Options:
  --help                Show this help message

Examples:
  npm run test-enhanced
  node test-enhanced-features.js
  API_BASE_URL=https://your-app.onrender.com node test-enhanced-features.js
    `);
    process.exit(0);
  }
  
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  testServerHealth,
  testAIResearch,
  testTelegramNotification,
  testEnhancedProcessCard,
  testGithubWebhook
}; 