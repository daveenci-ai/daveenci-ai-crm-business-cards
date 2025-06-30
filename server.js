const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Security and optimization middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Database connection helper
async function connectDB() {
  try {
    const client = await pool.connect();
    console.log('Connected to PostgreSQL database');
    
    // Check if table exists and show structure
    const tableCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'business_cards' 
      ORDER BY ordinal_position;
    `);
    
    if (tableCheck.rows.length > 0) {
      console.log('Found business_cards table with columns:');
      tableCheck.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log('Warning: business_cards table not found!');
    }
    
    client.release();
  } catch (err) {
    console.error('Database connection error:', err);
  }
}

// Initialize database connection
connectDB();

// Data validation and cleanup utilities
function cleanName(name) {
  if (!name) return '';
  return name
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function formatPhoneNumber(phone) {
  if (!phone) return '';
  
  // Extract digits only
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 10) {
    // Format as XXX-XXX-XXXX
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    // Format as +1 XXX-XXX-XXXX
    return `+1 ${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 11) {
    // International format
    return `+${digits.slice(0, 1)} ${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  } else if (digits.length > 11) {
    // Long international number - keep first part separate
    return `+${digits.slice(0, digits.length - 10)} ${digits.slice(-10, -7)}-${digits.slice(-7, -4)}-${digits.slice(-4)}`;
  } else if (digits.length >= 7) {
    // Partial number - format what we have
    return digits.length >= 7 ? 
      `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : 
      digits;
  }
  
  return digits; // Return as-is if too short
}

function validateEmail(email) {
  if (!email) return '';
  
  const cleaned = email.trim().toLowerCase();
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(cleaned) ? cleaned : email.trim(); // Return original if invalid format
}

function cleanWebsite(website) {
  if (!website) return '';
  
  let cleaned = website.trim().toLowerCase();
  
  // Remove trailing slashes
  cleaned = cleaned.replace(/\/+$/, '');
  
  // Add https:// if no protocol
  if (cleaned && !cleaned.match(/^https?:\/\//)) {
    cleaned = `https://${cleaned}`;
  }
  
  return cleaned;
}

function cleanText(text) {
  if (!text) return '';
  return text
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function cleanSimpleText(text) {
  if (!text) return '';
  return text.trim().replace(/\s+/g, ' ');
}

// Routes

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Business Card CRM API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Process business card endpoint
app.post('/process-card', async (req, res) => {
  console.log('\n🔍 === BUSINESS CARD PROCESSING DEBUG LOG ===');
  console.log('📅 Timestamp:', new Date().toISOString());
  console.log('🌐 Request headers:', JSON.stringify(req.headers, null, 2));
  console.log('📦 Raw request body:', JSON.stringify(req.body, null, 2));
  
  try {
    // Handle nested data structure from iPhone Shortcut
    console.log('🔄 Checking data structure...');
    const dataSource = req.body[""] || req.body;
    console.log('📊 Data source:', JSON.stringify(dataSource, null, 2));
    
    const {
      Name = '',
      Surname = '',
      Email = '',
      Phone = '',
      Phone2 = '',
      Company = '',
      Title = '',
      Industry = '',
      Website = '',
      Notes = '',
      // Also support lowercase for backwards compatibility
      name = '',
      surname = '',
      email = '',
      phone = '',
      phone2 = '',
      company = '',
      title = '',
      industry = '',
      website = '',
      notes = ''
    } = dataSource;

    console.log('\n📋 RAW EXTRACTED DATA:');
    console.log('  Name (raw):', JSON.stringify(Name || name || ''));
    console.log('  Surname (raw):', JSON.stringify(Surname || surname || ''));
    console.log('  Email (raw):', JSON.stringify(Email || email || ''));
    console.log('  Phone (raw):', JSON.stringify(Phone || phone || ''));
    console.log('  Phone2 (raw):', JSON.stringify(Phone2 || phone2 || ''));
    console.log('  Company (raw):', JSON.stringify(Company || company || ''));
    console.log('  Title (raw):', JSON.stringify(Title || title || ''));
    console.log('  Industry (raw):', JSON.stringify(Industry || industry || ''));
    console.log('  Website (raw):', JSON.stringify(Website || website || ''));
    console.log('  Notes (raw):', JSON.stringify(Notes || notes || ''));

    // Clean and validate data using utility functions
    const firstName = cleanName(Name || name || '');
    const lastName = cleanName(Surname || surname || '');
    const fullName = `${firstName} ${lastName}`.trim();
    
    const validatedEmail = validateEmail(Email || email || '');
    const formattedPhone = formatPhoneNumber(Phone || phone || '');
    const formattedPhone2 = formatPhoneNumber(Phone2 || phone2 || '');
    const cleanedCompany = cleanText(Company || company || '');
    const cleanedTitle = cleanText(Title || title || '');
    const cleanedIndustry = cleanText(Industry || industry || '');
    const formattedWebsite = cleanWebsite(Website || website || '');
    const cleanedNotes = cleanSimpleText(Notes || notes || '');

    console.log('\n✨ CLEANED & VALIDATED DATA:');
    console.log('  Name (first):', JSON.stringify(firstName));
    console.log('  Surname (last):', JSON.stringify(lastName));
    console.log('  Full Name (combined):', JSON.stringify(fullName));
    console.log('  Email (validated):', JSON.stringify(validatedEmail));
    console.log('  Phone (formatted):', JSON.stringify(formattedPhone));
    console.log('  Phone2 (formatted):', JSON.stringify(formattedPhone2));
    console.log('  Company (cleaned):', JSON.stringify(cleanedCompany));
    console.log('  Title (cleaned):', JSON.stringify(cleanedTitle));
    console.log('  Industry (cleaned):', JSON.stringify(cleanedIndustry));
    console.log('  Website (formatted):', JSON.stringify(formattedWebsite));
    console.log('  Notes (cleaned):', JSON.stringify(cleanedNotes));

    // Validate required fields
    if (!fullName && !validatedEmail && !formattedPhone && !cleanedCompany) {
      console.log('❌ VALIDATION FAILED: No name, email, phone, or company provided');
      return res.status(400).json({
        error: 'At least one of name, email, phone, or company is required'
      });
    }

    console.log('✅ VALIDATION PASSED: At least one required field provided');

    // Additional data quality checks and warnings
    const warnings = [];
    
    if (validatedEmail && !validatedEmail.includes('@')) {
      warnings.push('Email format may be invalid');
    }
    
    if (formattedPhone && formattedPhone.length < 10) {
      warnings.push('Phone number may be too short');
    }
    
    if (formattedWebsite && !formattedWebsite.includes('.')) {
      warnings.push('Website format may be invalid');
    }
    
    if (warnings.length > 0) {
      console.log('⚠️ DATA QUALITY WARNINGS:');
      warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    // Prepare notes field with additional details
    const notesParts = [];
    if (cleanedTitle) notesParts.push(`Title: ${cleanedTitle}`);
    if (cleanedIndustry) notesParts.push(`Industry: ${cleanedIndustry}`);
    if (formattedPhone2) notesParts.push(`Phone2: ${formattedPhone2}`);
    if (cleanedNotes) notesParts.push(`Notes: ${cleanedNotes}`);
    
    const combinedNotes = notesParts.join('\n');
    console.log('\n📝 COMBINED NOTES:', JSON.stringify(combinedNotes));

    // Prepare final values for database with additional validation
    const finalValues = [
      fullName || '', // Ensure never null
      validatedEmail || '',
      formattedPhone || '',
      cleanedCompany || '',
      formattedWebsite || '',
      combinedNotes || ''
    ];

    console.log('\n🎯 FINAL VALUES FOR DATABASE:');
    finalValues.forEach((value, index) => {
      const fields = ['full_name', 'email', 'phone', 'company_name', 'website', 'notes'];
      const status = value ? '✅' : '⭕';
      console.log(`  ${status} $${index + 1} (${fields[index]}): "${value}" (type: ${typeof value}, length: ${value?.length || 0})`);
    });

    // Insert into database
    console.log('\n🔗 CONNECTING TO DATABASE...');
    const client = await pool.connect();
    console.log('✅ DATABASE CONNECTION ESTABLISHED');
    
    try {
      const insertQuery = `
        INSERT INTO business_cards 
        (full_name, email, phone, company_name, website, notes) 
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, dt;
      `;

      console.log('\n📄 FULL SQL QUERY:');
      console.log(insertQuery);
      console.log('\n🔢 QUERY PARAMETERS:');
      finalValues.forEach((value, index) => {
        console.log(`  $${index + 1}: "${value}"`);
      });

      console.log('\n⚡ EXECUTING QUERY...');
      const result = await client.query(insertQuery, finalValues);
      
      const savedCard = result.rows[0];
      console.log('\n🎉 SUCCESS! Database insertion completed');
      console.log('💾 Returned data:', JSON.stringify(savedCard, null, 2));
      console.log(`✅ Successfully saved business card with ID: ${savedCard.id}`);

      const responseData = {
        message: 'Business card saved successfully',
        id: savedCard.id,
        timestamp: savedCard.dt,
        data: {
          fullName: fullName,
          firstName: firstName,
          lastName: lastName,
          email: validatedEmail,
          phone: formattedPhone,
          phone2: formattedPhone2,
          company: cleanedCompany,
          website: formattedWebsite,
          title: cleanedTitle,
          industry: cleanedIndustry,
          notes: cleanedNotes,
          combinedNotes: combinedNotes
        },
        validation: {
          warnings: warnings.length > 0 ? warnings : undefined,
          cleaned: {
            nameFormatted: firstName !== (Name || name || '') || lastName !== (Surname || surname || ''),
            emailValidated: validatedEmail !== (Email || email || ''),
            phoneFormatted: formattedPhone !== (Phone || phone || ''),
            websiteFormatted: formattedWebsite !== (Website || website || ''),
          }
        }
      };

      console.log('\n📤 RESPONSE DATA:', JSON.stringify(responseData, null, 2));
      console.log('🔍 === END BUSINESS CARD PROCESSING DEBUG LOG ===\n');

      res.status(200).json(responseData);

    } finally {
      console.log('🔌 RELEASING DATABASE CONNECTION');
      client.release();
    }

  } catch (error) {
    console.log('\n💥 ERROR OCCURRED:');
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error detail:', error.detail);
    console.error('❌ Error hint:', error.hint);
    console.error('❌ Full error object:', error);
    console.log('🔍 === END BUSINESS CARD PROCESSING DEBUG LOG (ERROR) ===\n');
    
    res.status(500).json({
      error: 'Failed to save business card',
      details: error.message,
      code: error.code
    });
  }
});

// Get all business cards
app.get('/cards', async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT id, full_name, email, phone, company_name, website, notes, dt
        FROM business_cards 
        ORDER BY dt DESC
      `);

      res.json({
        cards: result.rows,
        count: result.rows.length,
        timestamp: new Date().toISOString()
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error fetching cards:', error);
    res.status(500).json({
      error: 'Failed to fetch business cards',
      details: error.message
    });
  }
});

// Get single business card by ID
app.get('/cards/:id', async (req, res) => {
  try {
    const cardId = parseInt(req.params.id);
    
    if (isNaN(cardId)) {
      return res.status(400).json({ error: 'Invalid card ID' });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM business_cards WHERE id = $1
      `, [cardId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Business card not found' });
      }

      res.json({
        card: result.rows[0],
        timestamp: new Date().toISOString()
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error fetching card:', error);
    res.status(500).json({
      error: 'Failed to fetch business card',
      details: error.message
    });
  }
});

// Delete business card by ID
app.delete('/cards/:id', async (req, res) => {
  try {
    const cardId = parseInt(req.params.id);
    
    if (isNaN(cardId)) {
      return res.status(400).json({ error: 'Invalid card ID' });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(`
        DELETE FROM business_cards WHERE id = $1 RETURNING id, full_name
      `, [cardId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Business card not found' });
      }

      res.json({
        message: 'Business card deleted successfully',
        deleted: result.rows[0],
        timestamp: new Date().toISOString()
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error deleting card:', error);
    res.status(500).json({
      error: 'Failed to delete business card',
      details: error.message
    });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Handle 404s
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Business Card CRM API running on port ${port}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
});

module.exports = app; 