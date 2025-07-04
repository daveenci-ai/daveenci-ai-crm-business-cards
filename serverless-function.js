/**
 * Serverless Function: Business Card Processing Pipeline
 * 
 * This function implements the complete workflow:
 * 1. Receive GitHub webhook
 * 2. Extract image data
 * 3. Use Gemini for data extraction
 * 4. Validate and store in database
 * 5. Use Gemini for research
 * 6. Send Telegram notification
 */

const { Pool } = require('pg');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const crypto = require('crypto');

// Configuration
const config = {
  // Database
  databaseUrl: process.env.DATABASE_URL,
  
  // Gemini AI
  geminiApiKey: process.env.GEMINI_API_KEY,
  
  // Telegram
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,
  
  // GitHub
  githubWebhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
  githubRepo: process.env.GITHUB_REPO || 'daveenci-ai/daveenci-ai-crm-business-card-images',
  
  // Processing
  imageRepoPath: 'cards/',
  defaultUserId: 1 // Will be overridden by database lookup
};

// Initialize services
const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const genAI = new GoogleGenerativeAI(config.geminiApiKey);
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

/**
 * Main handler function for serverless execution
 */
async function handleBusinessCardWebhook(event, context) {
  try {
    console.log('🚀 Business Card Processing Pipeline Started');
    
    // Step 1: Validate GitHub webhook
    const webhookValidation = await validateGitHubWebhook(event);
    if (!webhookValidation.valid) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid webhook signature' })
      };
    }
    
    const { imagePath, imageData } = webhookValidation;
    console.log(`📸 Processing image: ${imagePath}`);
    
    // Step 2: Extract data using Gemini
    const extractedData = await extractBusinessCardData(imageData);
    if (!extractedData.success) {
      await sendTelegramError(`❌ Failed to extract data from business card: ${extractedData.error}`);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Data extraction failed', details: extractedData.error })
      };
    }
    
    console.log('✅ Data extraction completed:', extractedData.data.name);
    
    // Step 3: Validate extracted data
    const validation = validateExtractedData(extractedData.data);
    if (!validation.valid) {
      await sendTelegramError(`❌ Invalid data extracted: ${validation.errors.join(', ')}`);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Data validation failed', details: validation.errors })
      };
    }
    
    // Step 4: Database operations
    const dbResult = await handleDatabaseOperations(extractedData.data);
    if (!dbResult.success) {
      await sendTelegramError(`❌ Database operation failed: ${dbResult.error}`);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Database operation failed', details: dbResult.error })
      };
    }
    
    console.log(`✅ Database operation completed: ${dbResult.isNewContact ? 'New contact' : 'Touchpoint added'}`);
    
    // Step 5: Research using Gemini
    const research = await performBusinessResearch(extractedData.data);
    
    // Step 6: Send Telegram notification
    await sendTelegramNotification(extractedData.data, research, dbResult);
    
    console.log('🎉 Business card processing completed successfully');
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        contact: extractedData.data.name,
        company: extractedData.data.company,
        isNewContact: dbResult.isNewContact,
        researchCompleted: research.success
      })
    };
    
  } catch (error) {
    console.error('❌ Pipeline error:', error);
    await sendTelegramError(`❌ Business card processing failed: ${error.message}`);
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error', details: error.message })
    };
  }
}

/**
 * Validate GitHub webhook and extract image data
 */
async function validateGitHubWebhook(event) {
  try {
    const signature = event.headers['x-hub-signature-256'] || event.headers['X-Hub-Signature-256'];
    
    // Debug logging
    console.log('🔍 Webhook signature validation:');
    console.log('- All headers:', Object.keys(event.headers));
    console.log('- Has webhook secret:', !!config.githubWebhookSecret);
    console.log('- Has signature:', !!signature);
    console.log('- Signature value:', signature);
    console.log('- Body length:', event.body.length);
    console.log('- Body type:', typeof event.body);
    
    // Verify webhook signature BEFORE parsing JSON
    if (!config.githubWebhookSecret || !signature) {
      console.log('❌ Missing webhook secret or signature');
      return { valid: false, error: 'Missing webhook secret or signature' };
    }
    
    const hmac = crypto.createHmac('sha256', config.githubWebhookSecret);
    const digest = 'sha256=' + hmac.update(event.body).digest('hex');
    
    console.log('- Calculated digest:', digest);
    console.log('- Received signature:', signature);
    console.log('- Digests match:', digest === signature);
    
    if (!crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))) {
      console.log('❌ Signature validation failed');
      return { valid: false, error: 'Invalid signature' };
    }
    
    console.log('✅ Signature validation passed');
    
    // Now parse the JSON body after signature validation
    const body = JSON.parse(event.body);
    
    // Check if it's a push event with new images
    if (event.headers['x-github-event'] !== 'push' || body.ref !== 'refs/heads/main') {
      return { valid: false, error: 'Not a push event to main branch' };
    }
    
    // Find newly added image files
    const addedFiles = body.commits
      .flatMap(commit => commit.added || [])
      .filter(file => file.startsWith(config.imageRepoPath) && /\.(jpg|jpeg|png|gif|webp)$/i.test(file));
    
    if (addedFiles.length === 0) {
      return { valid: false, error: 'No new image files found' };
    }
    
    // Get the first image (process one at a time for now)
    const imagePath = addedFiles[0];
    
    // Fetch image data from GitHub
    const imageData = await fetchImageFromGitHub(imagePath);
    
    return {
      valid: true,
      imagePath,
      imageData
    };
    
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Fetch image data from GitHub
 */
async function fetchImageFromGitHub(imagePath) {
  const rawUrl = `https://raw.githubusercontent.com/${config.githubRepo}/main/${imagePath}`;
  
  const response = await axios.get(rawUrl, {
    responseType: 'arraybuffer',
    timeout: 30000
  });
  
  return {
    data: response.data,
    contentType: response.headers['content-type'],
    size: response.data.length
  };
}

/**
 * Extract business card data using Gemini Vision
 */
async function extractBusinessCardData(imageData) {
  try {
    const prompt = `You are an expert data extraction assistant. Analyze the following business card image and extract the contact information. Provide the output ONLY as a valid JSON object. Do not include any text before or after the JSON.

The JSON object must have these exact keys: name, company, title, primary_email, secondary_email, primary_phone, secondary_phone, website, address.

Follow these rules:
- If a field is not found, its value must be null.
- If you find multiple emails or phones, identify the most likely personal email (e.g., @gmail.com, @yahoo.com) and assign it to primary_email. The corporate email should be secondary_email. If only one is found, use primary_email and set the other to null. Do the same for phone numbers if a distinction is clear.
- Clean the data: format phone numbers consistently (e.g., +1-XXX-XXX-XXXX) and ensure the website includes 'http://' or 'https://'.

Here is the JSON structure to follow:
{
  "name": "...",
  "company": "...",
  "title": "...",
  "primary_email": "...",
  "secondary_email": "...",
  "primary_phone": "...",
  "secondary_phone": "...",
  "website": "...",
  "address": "..."
}`;

    const imagePart = {
      inlineData: {
        data: Buffer.from(imageData.data).toString('base64'),
        mimeType: imageData.contentType
      }
    };

    const result = await geminiModel.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: 'No JSON found in response' };
    }
    
    const extractedData = JSON.parse(jsonMatch[0]);
    
    return {
      success: true,
      data: extractedData
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Validate extracted data
 */
function validateExtractedData(data) {
  const errors = [];
  
  // Email validation regex
  const emailRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
  
  // Required fields
  if (!data.name || data.name.trim().length === 0) {
    errors.push('Name is required');
  }
  
  if (!data.primary_email || !emailRegex.test(data.primary_email)) {
    errors.push('Valid primary email is required');
  }
  
  if (data.secondary_email && !emailRegex.test(data.secondary_email)) {
    errors.push('Secondary email is invalid');
  }
  
  // Phone validation
  if (data.primary_phone) {
    const cleanPhone = data.primary_phone.replace(/[^\d+]/g, '');
    if (cleanPhone.length < 10) {
      errors.push('Primary phone number is too short');
    }
  }
  
  if (data.secondary_phone) {
    const cleanPhone = data.secondary_phone.replace(/[^\d+]/g, '');
    if (cleanPhone.length < 10) {
      errors.push('Secondary phone number is too short');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Handle database operations (check existing, insert contact or touchpoint)
 */
async function handleDatabaseOperations(contactData) {
  const client = await pool.connect();
  
  try {
    // Get Admin user ID
    const userResult = await client.query(
      'SELECT id FROM users WHERE name = $1 LIMIT 1',
      ['Admin']
    );
    
    if (userResult.rows.length === 0) {
      return { success: false, error: 'Admin user not found' };
    }
    
    const userId = userResult.rows[0].id;
    
    // Check if contact exists
    const existingContact = await client.query(
      'SELECT id FROM contacts WHERE primary_email = $1',
      [contactData.primary_email]
    );
    
    if (existingContact.rows.length === 0) {
      // Insert new contact
      const insertResult = await client.query(`
        INSERT INTO contacts (
          name, company, primary_email, secondary_email, primary_phone, secondary_phone,
          website, address, source, status, user_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        RETURNING id
      `, [
        contactData.name,
        contactData.company,
        contactData.primary_email,
        contactData.secondary_email,
        contactData.primary_phone,
        contactData.secondary_phone,
        contactData.website,
        contactData.address,
        'Business Card Scan',
        'PROSPECTS',
        userId
      ]);
      
      return {
        success: true,
        isNewContact: true,
        contactId: insertResult.rows[0].id
      };
      
    } else {
      // Add touchpoint for existing contact
      const contactId = existingContact.rows[0].id;
      
      // Check if touchpoints table exists, if not create it
      await createTouchpointsTableIfNotExists(client);
      
      await client.query(`
        INSERT INTO touchpoints (
          contact_id, note, source, created_at
        ) VALUES ($1, $2, $3, NOW())
      `, [
        contactId,
        `Met again / New business card scanned on ${new Date().toLocaleDateString()}`,
        'BUSINESS_CARD'
      ]);
      
      return {
        success: true,
        isNewContact: false,
        contactId: contactId
      };
    }
    
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

/**
 * Create touchpoints table if it doesn't exist
 */
async function createTouchpointsTableIfNotExists(client) {
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS touchpoints (
        id SERIAL PRIMARY KEY,
        contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
        note TEXT NOT NULL,
        source VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (error) {
    console.log('Touchpoints table creation error (might already exist):', error.message);
  }
}

/**
 * Perform business research using Gemini
 */
async function performBusinessResearch(contactData) {
  try {
    const prompt = `You are a professional business research analyst. I just met a person and need a concise briefing to help me establish a strong connection.

Person: ${contactData.name}
Company: ${contactData.company}
Title: ${contactData.title || 'Not specified'}

Provide a brief report formatted in Markdown with the following sections:

1. 👤 About ${contactData.name}: Briefly summarize their professional role and background based on public information (e.g., LinkedIn).

2. 🏢 About ${contactData.company}: What does the company do? Who are its main competitors?

3. 📈 Opportunities & Challenges: What are 1-2 key strategic challenges the company is likely facing? What are 1-2 recent opportunities or successes they've had?

4. 💬 Conversation Starters / Icebreakers: Based on recent news, company press releases, or the person's public activity, provide 2-3 specific talking points. Example: 'I saw your company just launched a new AI-powered analytics tool. I'm curious to hear how the market is responding to it.'

Keep the entire report concise and easy to read on a mobile phone.`;

    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const research = response.text();
    
    return {
      success: true,
      research: research
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      research: 'Research could not be completed at this time.'
    };
  }
}

/**
 * Send Telegram notification
 */
async function sendTelegramNotification(contactData, research, dbResult) {
  try {
    const status = dbResult.isNewContact ? '✅ New contact added' : '🔄 Touchpoint added for existing contact';
    
    let message = `${status}: *${contactData.name}*\n`;
    message += `🏢 Company: ${contactData.company || 'Not specified'}\n`;
    message += `📧 Email: ${contactData.primary_email}\n`;
    if (contactData.primary_phone) {
      message += `📞 Phone: ${contactData.primary_phone}\n`;
    }
    message += `\n`;
    
    if (research.success) {
      message += research.research;
    } else {
      message += `⚠️ Research could not be completed: ${research.error}`;
    }
    
    // Escape special characters for MarkdownV2
    const escapedMessage = message
      .replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
    
    await axios.post(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
      chat_id: config.telegramChatId,
      text: escapedMessage,
      parse_mode: 'MarkdownV2'
    });
    
    console.log('📱 Telegram notification sent');
    
  } catch (error) {
    console.error('❌ Telegram notification failed:', error.message);
  }
}

/**
 * Send error notification to Telegram
 */
async function sendTelegramError(errorMessage) {
  try {
    const escapedMessage = errorMessage.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
    
    await axios.post(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
      chat_id: config.telegramChatId,
      text: escapedMessage,
      parse_mode: 'MarkdownV2'
    });
  } catch (error) {
    console.error('❌ Error notification failed:', error.message);
  }
}

// Export for serverless platforms
module.exports = {
  handleBusinessCardWebhook,
  // For testing
  extractBusinessCardData,
  validateExtractedData,
  performBusinessResearch
}; 