const axios = require('axios');
require('dotenv').config();

async function testTelegramBot() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  console.log('🤖 Testing Telegram Bot Configuration...');
  console.log('Bot Token configured:', !!botToken);
  console.log('Chat ID configured:', !!chatId);
  console.log('Chat ID value:', chatId);
  
  if (!botToken || !chatId) {
    console.error('❌ Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in environment variables');
    return;
  }
  
  try {
    // Test 1: Simple message without formatting
    console.log('\n📱 Test 1: Sending simple message...');
    const response1 = await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: 'Test message from business card scanner - no formatting'
    });
    console.log('✅ Simple message sent successfully');
    
    // Test 2: Message with basic formatting
    console.log('\n📱 Test 2: Sending formatted message...');
    const testMessage = `✅ John Doe
🏢 Test Company
📧 john@test.com
📞 +1234567890

This is a test message with basic formatting.`;
    
    const response2 = await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text: testMessage
    });
    console.log('✅ Formatted message sent successfully');
    
    // Test 3: Get bot info
    console.log('\n🤖 Test 3: Getting bot info...');
    const botInfo = await axios.get(`https://api.telegram.org/bot${botToken}/getMe`);
    console.log('✅ Bot info:', botInfo.data.result);
    
  } catch (error) {
    console.error('❌ Telegram test failed:', error.message);
    if (error.response) {
      console.error('❌ API response status:', error.response.status);
      console.error('❌ API response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testTelegramBot(); 