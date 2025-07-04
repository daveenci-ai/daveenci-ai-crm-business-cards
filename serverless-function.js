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
  imageRepoPath: '', // Root directory - no subfolder
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
    console.log('🚀 STEP 1: Business Card Processing Pipeline Started');
    console.log('⏰ Timestamp:', new Date().toISOString());
    
    // Step 1: Validate GitHub webhook
    console.log('🔐 STEP 2: Validating GitHub webhook signature...');
    const webhookValidation = await validateGitHubWebhook(event);
    if (!webhookValidation.valid) {
      console.log('❌ STEP 2 FAILED: Webhook validation failed -', webhookValidation.error);
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid webhook signature' })
      };
    }
    console.log('✅ STEP 2 COMPLETE: Webhook signature validated successfully');
    
    const { imagePath, imageData } = webhookValidation;
    console.log(`📸 STEP 3: Image retrieved from GitHub - ${imagePath}`);
    console.log(`📊 Image size: ${imageData.size} bytes, Content-Type: ${imageData.contentType}`);
    
    // Step 2: Extract data using Gemini
    console.log('🤖 STEP 4: Starting Gemini AI data extraction...');
    const extractedData = await extractBusinessCardData(imageData);
    if (!extractedData.success) {
      console.log('❌ STEP 4 FAILED: Data extraction failed -', extractedData.error);
      await sendTelegramError(`❌ Failed to extract data from business card: ${extractedData.error}`);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Data extraction failed', details: extractedData.error })
      };
    }
    
    console.log('✅ STEP 4 COMPLETE: Data extraction successful');
    console.log('👤 Extracted contact:', extractedData.data.name);
    console.log('🏢 Company:', extractedData.data.company);
    console.log('📧 Email:', extractedData.data.primary_email);
    console.log('📱 Phone:', extractedData.data.primary_phone);
    
    // Step 3: Validate extracted data
    console.log('🔍 STEP 5: Validating extracted data...');
    const validation = validateExtractedData(extractedData.data);
    if (!validation.valid) {
      console.log('❌ STEP 5 FAILED: Data validation failed -', validation.errors.join(', '));
      await sendTelegramError(`❌ Invalid data extracted: ${validation.errors.join(', ')}`);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Data validation failed', details: validation.errors })
      };
    }
    console.log('✅ STEP 5 COMPLETE: Data validation passed');
    
    // Step 4: Research using Gemini (do this before database operations for new contacts)
    console.log('🧠 STEP 6: Starting AI research for contact and company...');
    const research = await performBusinessResearch(extractedData.data);
    if (research.success) {
      console.log('✅ STEP 6 COMPLETE: AI research completed successfully');
      console.log('📄 Research length:', research.research.length, 'characters');
    } else {
      console.log('⚠️ STEP 6 WARNING: AI research failed -', research.error);
    }
    
    // Step 5: Database operations (pass research data for new contacts)
    console.log('💾 STEP 7: Starting database operations...');
    const dbResult = await handleDatabaseOperations(extractedData.data, research);
    if (!dbResult.success) {
      console.log('❌ STEP 7 FAILED: Database operation failed -', dbResult.error);
      await sendTelegramError(`❌ Database operation failed: ${dbResult.error}`);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Database operation failed', details: dbResult.error })
      };
    }
    
    console.log(`✅ STEP 7 COMPLETE: Database operation successful`);
    console.log(`📊 Contact status: ${dbResult.isNewContact ? 'NEW CONTACT CREATED' : 'EXISTING CONTACT - TOUCHPOINT ADDED'}`);
    console.log(`🆔 Contact ID: ${dbResult.contactId}`);
    
    // Step 6: Send Telegram notification (only for new contacts)
    if (dbResult.isNewContact) {
      console.log('📱 STEP 8: Sending Telegram notification for new contact...');
      await sendTelegramNotification(extractedData.data, research, dbResult);
      console.log('✅ STEP 8 COMPLETE: Telegram notification sent successfully');
    } else {
      console.log('⏭️ STEP 8 SKIPPED: No Telegram notification for existing contact (touchpoint only)');
    }
    
    console.log('🎉 PIPELINE COMPLETE: All steps finished successfully');
    console.log('⏰ Completion time:', new Date().toISOString());
    
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
    console.error('❌ PIPELINE ERROR: Unexpected error at', new Date().toISOString());
    console.error('❌ Error details:', error.message);
    console.error('❌ Stack trace:', error.stack);
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
    console.log('- Has rawBody:', !!event.rawBody);
    console.log('- Body first 200 chars:', event.body.substring(0, 200));
    console.log('- Body last 200 chars:', event.body.substring(event.body.length - 200));
    
    // Verify webhook signature BEFORE parsing JSON
    if (!config.githubWebhookSecret || !signature) {
      console.log('❌ Missing webhook secret or signature');
      return { valid: false, error: 'Missing webhook secret or signature' };
    }
    
    const hmac = crypto.createHmac('sha256', config.githubWebhookSecret);
    // Use raw Buffer if available, otherwise use string body
    const bodyForSignature = event.rawBody || event.body;
    const digest = 'sha256=' + hmac.update(bodyForSignature).digest('hex');
    
    console.log('- Using raw buffer for signature:', !!event.rawBody);
    console.log('- Calculated digest:', digest);
    console.log('- Received signature:', signature);
    console.log('- Digests match:', digest === signature);
    
    if (!crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))) {
      console.log('❌ Signature validation failed');
      return { valid: false, error: 'Invalid signature' };
    }
    
    console.log('✅ Signature validation passed');
    
    // Now parse the JSON body after signature validation
    let body;
    try {
      // Check if body is URL-encoded form data
      if (event.body.startsWith('payload=')) {
        console.log('📦 Detected URL-encoded webhook payload');
        const urlParams = new URLSearchParams(event.body);
        const payloadJson = urlParams.get('payload');
        if (!payloadJson) {
          throw new Error('No payload found in URL-encoded data');
        }
        body = JSON.parse(payloadJson);
      } else {
        console.log('📦 Detected direct JSON webhook payload');
        body = JSON.parse(event.body);
      }
    } catch (error) {
      console.log('❌ Error parsing webhook body:', error.message);
      return { valid: false, error: 'Invalid JSON payload' };
    }
    
    // Check if it's a push event with new images
    if (event.headers['x-github-event'] !== 'push' || body.ref !== 'refs/heads/main') {
      return { valid: false, error: 'Not a push event to main branch' };
    }
    
    // Find newly added image files
    const allAddedFiles = body.commits.flatMap(commit => commit.added || []);
    console.log('📁 All added files:', allAddedFiles);
    
    const addedFiles = allAddedFiles
      .filter(file => {
        // If imageRepoPath is empty, check all files; otherwise check files that start with the path
        const pathMatch = config.imageRepoPath === '' || file.startsWith(config.imageRepoPath);
        const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file);
        console.log(`🔍 File: ${file}, Path match: ${pathMatch}, Is image: ${isImage}`);
        return pathMatch && isImage;
      });
    
    console.log('📸 Image files found:', addedFiles);
    
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
- If a field is not found or unclear, use these exact fallback values:
  * name: "Unknown Person" (if no name found)
  * company: "Unknown Company" (if no company found)
  * title: "Unknown Title" (if no title found)
  * primary_email: "unknown@unknown.com" (if no email found)
  * secondary_email: null (only if you find a second valid email)
  * primary_phone: "0000000000" (if no phone found)
  * secondary_phone: null (only if you find a second valid phone)
  * website: "https://unknown.com" (if no website found)
  * address: "Unknown Address" (if no address found)

- If you find multiple emails or phones, identify the most likely personal email (e.g., @gmail.com, @yahoo.com) and assign it to primary_email. The corporate email should be secondary_email. If only one is found, use primary_email and set secondary_email to null.
- Clean the data: format phone numbers as digits only (e.g., 5551234567) and ensure websites include 'https://'.
- NEVER leave any field empty or with invalid data - always use the fallback values above.

Here is the JSON structure to follow:
{
  "name": "...",
  "company": "...",
  "title": "...",
  "primary_email": "...",
  "secondary_email": null,
  "primary_phone": "...",
  "secondary_phone": null,
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
    
    // Apply fallback values for any missing or invalid data
    const cleanedData = {
      name: extractedData.name || "Unknown Person",
      company: extractedData.company || "Unknown Company", 
      title: extractedData.title || "Unknown Title",
      primary_email: extractedData.primary_email || "unknown@unknown.com",
      secondary_email: extractedData.secondary_email || null,
      primary_phone: extractedData.primary_phone || "0000000000",
      secondary_phone: extractedData.secondary_phone || null,
      website: extractedData.website || "https://unknown.com",
      address: extractedData.address || "Unknown Address"
    };
    
    // Validate and clean email fields
    const emailRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
    if (!emailRegex.test(cleanedData.primary_email)) {
      cleanedData.primary_email = "unknown@unknown.com";
    }
    if (cleanedData.secondary_email && !emailRegex.test(cleanedData.secondary_email)) {
      cleanedData.secondary_email = null;
    }
    
    // Clean phone numbers (remove all non-digits)
    if (cleanedData.primary_phone) {
      cleanedData.primary_phone = cleanedData.primary_phone.replace(/\D/g, '');
      if (cleanedData.primary_phone.length < 10) {
        cleanedData.primary_phone = "0000000000";
      }
    }
    if (cleanedData.secondary_phone) {
      cleanedData.secondary_phone = cleanedData.secondary_phone.replace(/\D/g, '');
      if (cleanedData.secondary_phone.length < 10) {
        cleanedData.secondary_phone = null;
      }
    }
    
    // Ensure website has protocol
    if (cleanedData.website && !cleanedData.website.startsWith('http')) {
      cleanedData.website = 'https://' + cleanedData.website;
    }
    
    console.log('🧹 Data cleaning: Applied fallback values and validation');
    
    return {
      success: true,
      data: cleanedData
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
async function handleDatabaseOperations(contactData, research) {
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
      // Insert new contact with research data in notes
      const notesWithResearch = research.success ? research.research : 'Research could not be completed at this time.';
      
      const insertResult = await client.query(`
        INSERT INTO contacts (
          name, company, primary_email, secondary_email, primary_phone, secondary_phone,
          website, address, source, status, user_id, notes, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
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
        userId,
        notesWithResearch
      ]);
      
      console.log('✅ New contact created with research data in notes');
      
      return {
        success: true,
        isNewContact: true,
        contactId: insertResult.rows[0].id
      };
      
    } else {
      // Contact already exists - add touchpoint with IN_PERSON source
      const contactId = existingContact.rows[0].id;
      
      await client.query(`
        INSERT INTO touchpoints (
          contact_id, note, source, created_at
        ) VALUES ($1, $2, $3, NOW())
      `, [
        contactId,
        `Business card scanned on ${new Date().toLocaleDateString()}`,
        'IN_PERSON'
      ]);
      
      console.log('✅ Touchpoint added for existing contact');
      
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
 * Perform business research using Gemini
 */
async function performBusinessResearch(contactData) {
  try {
    console.log('🔬 Research: Preparing AI prompt for', contactData.name, 'at', contactData.company);
    
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

    console.log('🤖 Research: Sending request to Gemini AI...');
    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const research = response.text();
    
    console.log('✅ Research: Gemini AI response received');
    console.log('📝 Research: Generated', research.length, 'characters of research data');
    console.log('🔍 Research preview:', research.substring(0, 150) + '...');
    
    return {
      success: true,
      research: research
    };
    
  } catch (error) {
    console.log('❌ Research: Gemini AI request failed -', error.message);
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
    console.log('📱 Telegram: Preparing notification message...');
    console.log('📱 Telegram: Bot token configured:', !!config.telegramBotToken);
    console.log('📱 Telegram: Chat ID configured:', !!config.telegramChatId);
    
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
      console.log('📱 Telegram: Including research data in message');
    } else {
      message += `⚠️ Research could not be completed: ${research.error}`;
      console.log('📱 Telegram: Research failed, including error message');
    }
    
    console.log('📱 Telegram: Message length:', message.length, 'characters');
    
    // Escape special characters for MarkdownV2
    const escapedMessage = message
      .replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
    
    console.log('📱 Telegram: Sending message to chat ID:', config.telegramChatId);
    
    await axios.post(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
      chat_id: config.telegramChatId,
      text: escapedMessage,
      parse_mode: 'MarkdownV2'
    });
    
    console.log('✅ Telegram: Message sent successfully');
    
  } catch (error) {
    console.error('❌ Telegram: Failed to send notification -', error.message);
    if (error.response) {
      console.error('❌ Telegram: API response status:', error.response.status);
      console.error('❌ Telegram: API response data:', error.response.data);
    }
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