/**
 * Test Script for Serverless Business Card Processing
 * 
 * This script tests the serverless function components without
 * requiring a full GitHub webhook setup.
 */

const { 
  extractBusinessCardData, 
  validateExtractedData, 
  performBusinessResearch 
} = require('./serverless-function');

const fs = require('fs');
const path = require('path');

// Mock environment variables for testing
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';
process.env.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'test-token';
process.env.TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || 'test-chat-id';

/**
 * Test data extraction with a sample image
 */
async function testDataExtraction() {
  console.log('🧪 Testing Data Extraction...');
  
  try {
    // Create a mock image data object
    const mockImageData = {
      data: Buffer.from('fake-image-data'),
      contentType: 'image/jpeg',
      size: 1024
    };
    
    const result = await extractBusinessCardData(mockImageData);
    
    if (result.success) {
      console.log('✅ Data extraction successful');
      console.log('📋 Extracted data:', JSON.stringify(result.data, null, 2));
      
      // Test validation
      const validation = validateExtractedData(result.data);
      console.log('🔍 Validation result:', validation);
      
      return result.data;
    } else {
      console.log('❌ Data extraction failed:', result.error);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return null;
  }
}

/**
 * Test business research with sample data
 */
async function testBusinessResearch(contactData) {
  console.log('\n🧪 Testing Business Research...');
  
  try {
    const research = await performBusinessResearch(contactData);
    
    if (research.success) {
      console.log('✅ Research completed successfully');
      console.log('📊 Research summary:');
      console.log(research.research);
      return research;
    } else {
      console.log('❌ Research failed:', research.error);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Research test failed:', error.message);
    return null;
  }
}

/**
 * Test validation with various data scenarios
 */
function testValidation() {
  console.log('\n🧪 Testing Data Validation...');
  
  const testCases = [
    {
      name: 'Valid Data',
      data: {
        name: 'John Doe',
        company: 'Tech Corp',
        title: 'CEO',
        primary_email: 'john@techcorp.com',
        secondary_email: 'john.doe@gmail.com',
        primary_phone: '+1-555-123-4567',
        secondary_phone: '+1-555-987-6543',
        website: 'https://techcorp.com',
        address: '123 Main St, City, State'
      }
    },
    {
      name: 'Missing Required Fields',
      data: {
        name: '',
        company: 'Tech Corp',
        title: 'CEO',
        primary_email: 'invalid-email',
        secondary_email: null,
        primary_phone: null,
        secondary_phone: null,
        website: null,
        address: null
      }
    },
    {
      name: 'Invalid Email',
      data: {
        name: 'John Doe',
        company: 'Tech Corp',
        title: 'CEO',
        primary_email: 'not-an-email',
        secondary_email: 'also-invalid',
        primary_phone: '+1-555-123-4567',
        secondary_phone: null,
        website: 'https://techcorp.com',
        address: null
      }
    }
  ];
  
  testCases.forEach(testCase => {
    console.log(`\n📝 Testing: ${testCase.name}`);
    const validation = validateExtractedData(testCase.data);
    console.log('Result:', validation.valid ? '✅ Valid' : '❌ Invalid');
    if (!validation.valid) {
      console.log('Errors:', validation.errors);
    }
  });
}

/**
 * Test webhook validation logic
 */
function testWebhookValidation() {
  console.log('\n🧪 Testing Webhook Validation Logic...');
  
  const crypto = require('crypto');
  
  // Mock webhook payload
  const mockPayload = {
    ref: 'refs/heads/main',
    commits: [
      {
        added: ['cards/test-image.jpg', 'README.md'],
        modified: [],
        removed: []
      }
    ]
  };
  
  const mockEvent = {
    body: JSON.stringify(mockPayload),
    headers: {
      'x-github-event': 'push',
      'x-hub-signature-256': 'sha256=test-signature'
    }
  };
  
  console.log('📋 Mock webhook event created');
  console.log('🔍 Event type:', mockEvent.headers['x-github-event']);
  console.log('📁 Added files:', mockPayload.commits[0].added);
  
  // Test file filtering
  const imageFiles = mockPayload.commits[0].added.filter(
    file => file.startsWith('cards/') && /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
  );
  
  console.log('🖼️ Image files found:', imageFiles);
  
  return imageFiles.length > 0;
}

/**
 * Test database operations (mock)
 */
async function testDatabaseOperations() {
  console.log('\n🧪 Testing Database Operations Logic...');
  
  const mockContactData = {
    name: 'Jane Smith',
    company: 'Innovation Labs',
    title: 'CTO',
    primary_email: 'jane@innovationlabs.com',
    secondary_email: null,
    primary_phone: '+1-555-999-8888',
    secondary_phone: null,
    website: 'https://innovationlabs.com',
    address: '456 Tech Ave, Silicon Valley, CA'
  };
  
  console.log('📋 Mock contact data prepared');
  console.log('🔍 Would check for existing contact with email:', mockContactData.primary_email);
  console.log('💾 Would insert new contact or add touchpoint');
  
  return true;
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting Serverless Function Tests\n');
  
  // Test 1: Data validation
  testValidation();
  
  // Test 2: Webhook validation logic
  testWebhookValidation();
  
  // Test 3: Database operations logic
  await testDatabaseOperations();
  
  // Test 4: Data extraction (requires real API key)
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'test-key') {
    const extractedData = await testDataExtraction();
    
    if (extractedData) {
      // Test 5: Business research (requires real API key)
      await testBusinessResearch(extractedData);
    }
  } else {
    console.log('\n⚠️ Skipping API tests - no real Gemini API key provided');
    console.log('Set GEMINI_API_KEY environment variable to test AI features');
  }
  
  console.log('\n✅ All tests completed!');
}

/**
 * Test specific component
 */
async function testComponent(component) {
  switch (component) {
    case 'validation':
      testValidation();
      break;
    case 'webhook':
      testWebhookValidation();
      break;
    case 'database':
      await testDatabaseOperations();
      break;
    case 'extraction':
      await testDataExtraction();
      break;
    case 'research':
      const mockData = {
        name: 'Test User',
        company: 'Test Company',
        title: 'Test Title'
      };
      await testBusinessResearch(mockData);
      break;
    default:
      console.log('Available components: validation, webhook, database, extraction, research');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const component = process.argv[2];
  
  if (component) {
    testComponent(component);
  } else {
    runAllTests();
  }
}

module.exports = {
  testDataExtraction,
  testBusinessResearch,
  testValidation,
  testWebhookValidation,
  testDatabaseOperations,
  runAllTests
}; 