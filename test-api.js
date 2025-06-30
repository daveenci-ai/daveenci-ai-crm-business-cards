#!/usr/bin/env node
/**
 * Test script for the Business Card API (Node.js version)
 * Usage: node test-api.js [base_url]
 */

const https = require('https');
const http = require('http');

// Simple HTTP request helper
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = protocol.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({
            statusCode: res.statusCode,
            data: jsonData,
            rawData: data
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            data: {},
            rawData: data
          });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }

    req.end();
  });
}

async function testHealthCheck(baseUrl) {
  console.log('🔍 Testing Health Check...');
  try {
    const response = await makeRequest(`${baseUrl}/`);
    console.log(`   Status: ${response.statusCode}`);
    
    if (response.statusCode === 200) {
      console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
      return true;
    } else {
      console.log(`   Error: ${response.rawData}`);
      return false;
    }
  } catch (error) {
    console.log(`   Failed: ${error.message}`);
    return false;
  }
}

async function testProcessCard(baseUrl) {
  console.log('🔍 Testing Process Card...');
  try {
    // Test data - simulating what iPhone shortcut would send
    const testData = {
      name: 'John Doe',
      email: 'john@techcorp.com',
      phone: '5551234567',
      company: 'Tech Corp',
      title: 'Software Engineer',
      website: 'techcorp.com',
      address: '123 Main St, City, State',
      notes: 'Met at tech conference 2024'
    };

    const response = await makeRequest(`${baseUrl}/process-card`, {
      method: 'POST',
      body: testData
    });

    console.log(`   Status: ${response.statusCode}`);
    
    if (response.statusCode === 200) {
      console.log(`   Success! Card ID: ${response.data.id}`);
      console.log(`   Saved data: ${JSON.stringify(response.data.data, null, 2)}`);
      return response.data.id;
    } else {
      console.log(`   Error: ${response.rawData}`);
      return null;
    }
  } catch (error) {
    console.log(`   Failed: ${error.message}`);
    return null;
  }
}

async function testGetCards(baseUrl) {
  console.log('🔍 Testing Get All Cards...');
  try {
    const response = await makeRequest(`${baseUrl}/cards`);
    console.log(`   Status: ${response.statusCode}`);
    
    if (response.statusCode === 200) {
      console.log(`   Found ${response.data.count || 0} cards`);
      if (response.data.cards && response.data.cards.length > 0) {
        console.log(`   Latest card: ${response.data.cards[0].full_name || 'Unknown'}`);
      }
      return true;
    } else {
      console.log(`   Error: ${response.rawData}`);
      return false;
    }
  } catch (error) {
    console.log(`   Failed: ${error.message}`);
    return false;
  }
}

async function testGetSingleCard(baseUrl, cardId) {
  if (!cardId) {
    console.log('🔍 Skipping Get Single Card - no card ID available');
    return true;
  }

  console.log('🔍 Testing Get Single Card...');
  try {
    const response = await makeRequest(`${baseUrl}/cards/${cardId}`);
    console.log(`   Status: ${response.statusCode}`);
    
    if (response.statusCode === 200) {
      const card = response.data.card;
      console.log(`   Card details:`);
      console.log(`     Name: ${card.full_name || 'N/A'}`);
      console.log(`     Email: ${card.email || 'N/A'}`); 
      console.log(`     Company: ${card.company_name || 'N/A'}`);
      console.log(`     Created: ${card.dt || 'N/A'}`);
      return true;
    } else {
      console.log(`   Error: ${response.rawData}`);
      return false;
    }
  } catch (error) {
    console.log(`   Failed: ${error.message}`);
    return false;
  }
}

async function main() {
  const baseUrl = process.argv[2] || 'http://localhost:5000';
  
  console.log('🚀 Testing Business Card API (Node.js version)');
  console.log(`📍 URL: ${baseUrl}`);
  console.log('=' * 60);
  
  let testsRunning = 0;
  let testsPassed = 0;
  const totalTests = 4;

  // Test 1: Health check
  testsRunning++;
  if (await testHealthCheck(baseUrl)) {
    testsPassed++;
  }
  console.log('');

  // Test 2: Process card  
  testsRunning++;
  const cardId = await testProcessCard(baseUrl);
  if (cardId !== null) {
    testsPassed++;
  }
  console.log('');

  // Test 3: Get all cards
  testsRunning++;
  if (await testGetCards(baseUrl)) {
    testsPassed++;
  }
  console.log('');

  // Test 4: Get single card
  testsRunning++;
  if (await testGetSingleCard(baseUrl, cardId)) {
    testsPassed++;
  }
  console.log('');

  // Results
  console.log('=' * 60);
  console.log(`📊 Tests Results: ${testsPassed}/${totalTests} passed`);
  
  if (testsPassed === totalTests) {
    console.log('✅ All tests passed! Your Node.js API is working correctly.');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed. Check your configuration and logs.');
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  main().catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = { testHealthCheck, testProcessCard, testGetCards, testGetSingleCard }; 