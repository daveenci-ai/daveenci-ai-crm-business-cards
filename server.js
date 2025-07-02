const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Database connection helper
async function connectDB() {
  try {
    const client = await pool.connect();
    console.log('Connected to PostgreSQL database');
    
    // Check if tables exist
    const usersCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `);
    
    const contactsCheck = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'contacts' 
      ORDER BY ordinal_position;
    `);
    
    if (usersCheck.rows.length > 0) {
      console.log('Found users table with columns:');
      usersCheck.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log('Warning: users table not found!');
    }
    
    if (contactsCheck.rows.length > 0) {
      console.log('Found contacts table with columns:');
      contactsCheck.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log('Warning: contacts table not found!');
    }
    
    client.release();
  } catch (err) {
    console.error('Database connection error:', err);
  }
}

// Initialize database connection
connectDB();

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// Data validation and cleanup utilities
function removeNumberedPrefixes(text) {
  if (!text) return '';
  
  let cleaned = text.toString().trim();
  
  // Remove numbered prefixes like "1. ", "2. ", "10. ", etc. at the beginning
  cleaned = cleaned.replace(/^\d+\.\s*/, '');
  
  // Remove numbered prefixes with field names (with or without colons)
  // Handles: "9. website:", "3. Company:", "7. Phone", etc.
  cleaned = cleaned.replace(/\d+\.\s*(website|company|name|surname|email|phone|phone2|title|industry|notes|scannedby):?\s*/gi, '');
  
  // Remove common field prefixes (case insensitive) that might appear at start
  const prefixes = ['Name:', 'Surname:', 'Email:', 'Phone:', 'Phone2:', 'Company:', 'Title:', 'Industry:', 'Website:', 'Notes:', 'ScannedBy:'];
  prefixes.forEach(prefix => {
    const regex = new RegExp(`^${prefix}\\s*`, 'i');
    cleaned = cleaned.replace(regex, '');
  });
  
  // Remove field prefixes that might appear anywhere in the string
  prefixes.forEach(prefix => {
    const regex = new RegExp(`\\s+${prefix}\\s*`, 'gi');
    cleaned = cleaned.replace(regex, ' ');
  });
  
  // Clean up cases like "https://9. website:" -> "https://"  
  cleaned = cleaned.replace(/([a-zA-Z0-9@.])\d+\.\s*(website|company|name|surname|email|phone|title|industry|notes):?\s*/gi, '$1');
  
  // Handle cases where the entire string is just a field name like "7. Phone"
  const fieldOnlyPattern = /^\d*\.\s*(website|company|name|surname|email|phone|phone2|title|industry|notes|scannedby):?\s*$/i;
  if (fieldOnlyPattern.test(cleaned)) {
    return ''; // Return empty string if it's just a field name
  }
  
  // Remove trailing commas and extra whitespace
  cleaned = cleaned.replace(/,\s*$/, '').trim();
  
  // Remove quotes if the entire string is wrapped in quotes
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
      (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  
  return cleaned;
}

function cleanName(name) {
  if (!name) return '';
  
  // First remove numbered prefixes and formatting
  const cleaned = removeNumberedPrefixes(name);
  
  return cleaned
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function formatPhoneNumber(phone) {
  if (!phone) return '';
  
  // First remove numbered prefixes and formatting
  const cleaned = removeNumberedPrefixes(phone);
  
  // Extract digits only
  const digits = cleaned.replace(/\D/g, '');
  
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
  
  // First remove numbered prefixes and formatting
  const cleaned = removeNumberedPrefixes(email).trim().toLowerCase();
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(cleaned) ? cleaned : removeNumberedPrefixes(email).trim(); // Return original if invalid format
}

function cleanText(text) {
  if (!text) return '';
  
  const cleaned = removeNumberedPrefixes(text);
  return cleaned
    .trim()
    .replace(/\s+/g, ' '); // Replace multiple spaces with single space
}

function cleanSimpleText(text) {
  if (!text) return '';
  
  return removeNumberedPrefixes(text)
    .trim()
    .replace(/\s+/g, ' '); // Replace multiple spaces with single space
}

function cleanWebsite(website) {
  if (!website) return '';
  
  let cleaned = removeNumberedPrefixes(website).trim().toLowerCase();
  
  // Add https:// if no protocol specified
  if (cleaned && !cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'https://' + cleaned;
  }
  
  return cleaned;
}

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Business Card CRM API is running',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: ['User Authentication', 'Contact Management']
  });
});

// User registration
app.post('/register', async (req, res) => {
  try {
    const { email, name, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const client = await pool.connect();
    
    try {
      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase()]
      );
      
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'User already exists with this email' });
      }
      
      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      // Create user
      const result = await client.query(
        'INSERT INTO users (email, name, password) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
        [email.toLowerCase(), name, hashedPassword]
      );
      
      const user = result.rows[0];
      
      // Generate JWT token (longer expiry for iPhone Shortcuts)
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '90d' } // 3 months for iPhone Shortcuts
      );
      
      res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          created_at: user.created_at
        },
        token
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Failed to register user',
      details: error.message
    });
  }
});

// User login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const client = await pool.connect();
    
    try {
      // Find user
      const result = await client.query(
        'SELECT id, email, name, password FROM users WHERE email = $1',
        [email.toLowerCase()]
      );
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      
      const user = result.rows[0];
      
      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      
      // Generate JWT token (longer expiry for iPhone Shortcuts)
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '90d' } // 3 months for iPhone Shortcuts
      );
      
      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        token
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Failed to login',
      details: error.message
    });
  }
});

// Create contact (updated from process-card)
app.post('/contacts', authenticateToken, async (req, res) => {
  try {
    console.log('\n🔍 === CONTACT CREATION DEBUG LOG ===');
    console.log('📥 Raw request body:', JSON.stringify(req.body, null, 2));
    console.log('👤 User ID from token:', req.user.userId);
    
    // Handle nested data structure from iPhone Shortcut (data might be under empty key "")
    const dataSource = req.body[""] || req.body;
    console.log('📊 Data source after extraction:', JSON.stringify(dataSource, null, 2));
    
    const {
      name, email, phone, company, source, status = 'PROSPECT', notes,
      // Legacy field names for backward compatibility
      Name, Surname, Email, Phone, Company, Notes, Title, Industry, Website
    } = dataSource;

    // Clean and validate data using utility functions
    // Handle Name + Surname combination for legacy compatibility
    const firstName = cleanName(Name || name || '');
    const lastName = cleanName(Surname || '');
    const fullName = `${firstName} ${lastName}`.trim() || cleanName(name || '');
    
    const validatedEmail = validateEmail(email || Email || '');
    const formattedPhone = formatPhoneNumber(phone || Phone || '');
    const cleanedCompany = cleanText(company || Company || '');
    const cleanedSource = cleanText(source || '');
    
    // Handle additional legacy fields in notes
    const additionalNotes = [];
    if (Title) additionalNotes.push(`Title: ${cleanText(Title)}`);
    if (Industry) additionalNotes.push(`Industry: ${cleanText(Industry)}`); 
    if (Website) additionalNotes.push(`Website: ${cleanWebsite(Website)}`);
    if (Notes) additionalNotes.push(`Notes: ${cleanSimpleText(Notes)}`);
    if (notes) additionalNotes.push(cleanSimpleText(notes));
    
    const cleanedNotes = additionalNotes.join('\n');
    const contactStatus = status.toUpperCase();

    console.log('\n✨ CLEANED & VALIDATED DATA:');
    console.log('  Full Name:', JSON.stringify(fullName));
    console.log('  First Name:', JSON.stringify(firstName));
    console.log('  Last Name:', JSON.stringify(lastName));
    console.log('  Email:', JSON.stringify(validatedEmail));
    console.log('  Phone:', JSON.stringify(formattedPhone));
    console.log('  Company:', JSON.stringify(cleanedCompany));
    console.log('  Source:', JSON.stringify(cleanedSource));
    console.log('  Status:', JSON.stringify(contactStatus));
    console.log('  Notes:', JSON.stringify(cleanedNotes));

    // Validate required fields
    if (!fullName && !validatedEmail && !formattedPhone && !cleanedCompany) {
      console.log('❌ VALIDATION FAILED: No name, email, phone, or company provided');
      return res.status(400).json({
        error: 'At least one of name, email, phone, or company is required'
      });
    }

    console.log('✅ VALIDATION PASSED');

    // Validate status enum
    const validStatuses = ['PROSPECT', 'LEAD', 'CUSTOMER', 'INACTIVE'];
    if (!validStatuses.includes(contactStatus)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const client = await pool.connect();
    console.log('✅ DATABASE CONNECTION ESTABLISHED');
    
    try {
      const insertQuery = `
        INSERT INTO contacts 
        (name, email, phone, company, source, status, notes, user_id, updated_at) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id, created_at, updated_at;
      `;

      const finalValues = [
        fullName || '',
        validatedEmail || '',
        formattedPhone || '',
        cleanedCompany || '',
        cleanedSource || '',
        contactStatus,
        cleanedNotes || '',
        req.user.userId
      ];

      console.log('\n📄 FULL SQL QUERY:');
      console.log(insertQuery);
      console.log('\n🔢 QUERY PARAMETERS:');
      finalValues.forEach((value, index) => {
        console.log(`  $${index + 1}: "${value}"`);
      });

      console.log('\n⚡ EXECUTING QUERY...');
      const result = await client.query(insertQuery, finalValues);
      
      const savedContact = result.rows[0];
      console.log('\n🎉 SUCCESS! Database insertion completed');
      console.log('💾 Returned data:', JSON.stringify(savedContact, null, 2));
      console.log(`✅ Successfully saved contact with ID: ${savedContact.id}`);

      const responseData = {
        message: 'Contact saved successfully',
        id: savedContact.id,
        created_at: savedContact.created_at,
        updated_at: savedContact.updated_at,
        data: {
          name: fullName,
          email: validatedEmail,
          phone: formattedPhone,
          company: cleanedCompany,
          source: cleanedSource,
          status: contactStatus,
          notes: cleanedNotes,
          user_id: req.user.userId
        }
      };

      console.log('\n📤 RESPONSE DATA:', JSON.stringify(responseData, null, 2));
      console.log('🔍 === END CONTACT CREATION DEBUG LOG ===\n');

      res.status(201).json(responseData);

    } finally {
      console.log('🔌 RELEASING DATABASE CONNECTION');
      client.release();
    }

  } catch (error) {
    console.error('❌ Contact creation error:', error);
    res.status(500).json({
      error: 'Failed to create contact',
      details: error.message
    });
  }
});

// Legacy endpoint for backward compatibility
app.post('/process-card', authenticateToken, async (req, res) => {
  // Just reuse the contacts logic directly - this is more reliable than internal redirects
  try {
    console.log('\n🔍 === LEGACY PROCESS-CARD ENDPOINT ===');
    console.log('📥 Raw request body:', JSON.stringify(req.body, null, 2));
    console.log('👤 User ID from token:', req.user.userId);
    
    // Handle nested data structure from iPhone Shortcut (data might be under empty key "")
    const dataSource = req.body[""] || req.body;
    console.log('📊 Data source after extraction:', JSON.stringify(dataSource, null, 2));
    
    const {
      name, email, phone, company, source, status = 'PROSPECT', notes,
      // Legacy field names for backward compatibility
      Name, Surname, Email, Phone, Company, Notes, Title, Industry, Website
    } = dataSource;

    // Clean and validate data using utility functions
    // Handle Name + Surname combination for legacy compatibility
    const firstName = cleanName(Name || name || '');
    const lastName = cleanName(Surname || '');
    const fullName = `${firstName} ${lastName}`.trim() || cleanName(name || '');
    
    const validatedEmail = validateEmail(email || Email || '');
    const formattedPhone = formatPhoneNumber(phone || Phone || '');
    const cleanedCompany = cleanText(company || Company || '');
    const cleanedSource = cleanText(source || '');
    
    // Handle additional legacy fields in notes
    const additionalNotes = [];
    if (Title) additionalNotes.push(`Title: ${cleanText(Title)}`);
    if (Industry) additionalNotes.push(`Industry: ${cleanText(Industry)}`); 
    if (Website) additionalNotes.push(`Website: ${cleanWebsite(Website)}`);
    if (Notes) additionalNotes.push(`Notes: ${cleanSimpleText(Notes)}`);
    if (notes) additionalNotes.push(cleanSimpleText(notes));
    
    const cleanedNotes = additionalNotes.join('\n');
    const contactStatus = status.toUpperCase();

    console.log('\n✨ CLEANED & VALIDATED DATA:');
    console.log('  Full Name:', JSON.stringify(fullName));
    console.log('  Email:', JSON.stringify(validatedEmail));
    console.log('  Phone:', JSON.stringify(formattedPhone));
    console.log('  Company:', JSON.stringify(cleanedCompany));

    // Validate required fields
    if (!fullName && !validatedEmail && !formattedPhone && !cleanedCompany) {
      console.log('❌ VALIDATION FAILED: No name, email, phone, or company provided');
      return res.status(400).json({
        error: 'At least one of name, email, phone, or company is required'
      });
    }

    console.log('✅ VALIDATION PASSED');

    // Validate status enum
    const validStatuses = ['PROSPECT', 'LEAD', 'CUSTOMER', 'INACTIVE'];
    if (!validStatuses.includes(contactStatus)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const client = await pool.connect();
    console.log('✅ DATABASE CONNECTION ESTABLISHED');
    
    try {
      const insertQuery = `
        INSERT INTO contacts 
        (name, email, phone, company, source, status, notes, user_id, updated_at) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        RETURNING id, created_at, updated_at;
      `;

      const finalValues = [
        fullName || '',
        validatedEmail || '',
        formattedPhone || '',
        cleanedCompany || '',
        cleanedSource || '',
        contactStatus,
        cleanedNotes || '',
        req.user.userId
      ];

      console.log('\n⚡ EXECUTING QUERY...');
      const result = await client.query(insertQuery, finalValues);
      
      const savedContact = result.rows[0];
      console.log('\n🎉 SUCCESS! Legacy endpoint working');
      console.log(`✅ Successfully saved contact with ID: ${savedContact.id}`);

      res.status(201).json({
        message: 'Business card saved successfully',
        id: savedContact.id,
        created_at: savedContact.created_at,
        updated_at: savedContact.updated_at,
        data: {
          name: fullName,
          email: validatedEmail,
          phone: formattedPhone,
          company: cleanedCompany,
          source: cleanedSource,
          status: contactStatus,
          notes: cleanedNotes,
          user_id: req.user.userId
        }
      });

    } finally {
      console.log('🔌 RELEASING DATABASE CONNECTION');
      client.release();
    }

  } catch (error) {
    console.error('❌ Legacy endpoint error:', error);
    res.status(500).json({
      error: 'Failed to process business card',
      details: error.message
    });
  }
});

// TEMPORARY: Test endpoint without authentication for iPhone Shortcut testing
app.post('/test-card', async (req, res) => {
  try {
    console.log('\n🧪 === TEMPORARY TEST ENDPOINT (NO AUTH) ===');
    console.log('📥 Raw request body:', JSON.stringify(req.body, null, 2));
    
    // For testing, just return success with the data received
    res.json({
      message: 'Test endpoint working! Data received successfully.',
      warning: 'This is a temporary test endpoint without authentication.',
      received_data: req.body,
      timestamp: new Date().toISOString(),
      next_steps: [
        'Your shortcut is reaching the server correctly',
        'Now you need to set up authentication',
        'Use /register to create a user account',
        'Use /login to get a JWT token',
        'Add Authorization header to your shortcut'
      ]
    });
    
  } catch (error) {
    console.error('❌ Test endpoint error:', error);
    res.status(500).json({
      error: 'Test endpoint failed',
      details: error.message
    });
  }
});

// Get all contacts for authenticated user
app.get('/contacts', authenticateToken, async (req, res) => {
  try {
    const { status, search, limit = 50, offset = 0 } = req.query;
    
    const client = await pool.connect();
    try {
      let query = `
        SELECT id, name, email, phone, company, source, status, notes, 
               created_at, updated_at
        FROM contacts 
        WHERE user_id = $1
      `;
      const params = [req.user.userId];
      let paramCount = 1;

      // Add status filter
      if (status) {
        paramCount++;
        query += ` AND status = $${paramCount}`;
        params.push(status.toUpperCase());
      }

      // Add search filter
      if (search) {
        paramCount++;
        query += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR company ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      query += ` ORDER BY updated_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(parseInt(limit), parseInt(offset));

      const result = await client.query(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) FROM contacts WHERE user_id = $1';
      const countParams = [req.user.userId];
      let countParamCount = 1;

      if (status) {
        countParamCount++;
        countQuery += ` AND status = $${countParamCount}`;
        countParams.push(status.toUpperCase());
      }

      if (search) {
        countParamCount++;
        countQuery += ` AND (name ILIKE $${countParamCount} OR email ILIKE $${countParamCount} OR company ILIKE $${countParamCount})`;
        countParams.push(`%${search}%`);
      }

      const countResult = await client.query(countQuery, countParams);

      res.json({
        contacts: result.rows,
        count: result.rows.length,
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset),
        timestamp: new Date().toISOString()
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({
      error: 'Failed to fetch contacts',
      details: error.message
    });
  }
});

// Legacy endpoint for backward compatibility
app.get('/cards', authenticateToken, async (req, res) => {
  // Redirect to new contacts endpoint
  res.redirect(308, '/contacts');
});

// Get single contact by ID for authenticated user
app.get('/contacts/:id', authenticateToken, async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    
    if (isNaN(contactId)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT id, name, email, phone, company, source, status, notes,
               created_at, updated_at
        FROM contacts WHERE id = $1 AND user_id = $2
      `, [contactId, req.user.userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      res.json({
        contact: result.rows[0],
        timestamp: new Date().toISOString()
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({
      error: 'Failed to fetch contact',
      details: error.message
    });
  }
});

// Legacy endpoint for backward compatibility
app.get('/cards/:id', authenticateToken, async (req, res) => {
  // Redirect to new contacts endpoint
  res.redirect(308, `/contacts/${req.params.id}`);
});

// Update contact by ID for authenticated user
app.put('/contacts/:id', authenticateToken, async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    
    if (isNaN(contactId)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }

    const { name, email, phone, company, source, status, notes } = req.body;

    // Clean and validate data
    const cleanedName = cleanName(name || '');
    const validatedEmail = validateEmail(email || '');
    const formattedPhone = formatPhoneNumber(phone || '');
    const cleanedCompany = cleanText(company || '');
    const cleanedSource = cleanText(source || '');
    const cleanedNotes = cleanSimpleText(notes || '');
    const contactStatus = status ? status.toUpperCase() : '';

    // Validate status if provided
    if (contactStatus) {
      const validStatuses = ['PROSPECT', 'LEAD', 'CUSTOMER', 'INACTIVE'];
      if (!validStatuses.includes(contactStatus)) {
        return res.status(400).json({
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }
    }

    const client = await pool.connect();
    try {
      // Build dynamic update query
      const updates = [];
      const values = [];
      let paramCount = 0;

      if (cleanedName) {
        paramCount++;
        updates.push(`name = $${paramCount}`);
        values.push(cleanedName);
      }
      if (validatedEmail) {
        paramCount++;
        updates.push(`email = $${paramCount}`);
        values.push(validatedEmail);
      }
      if (formattedPhone) {
        paramCount++;
        updates.push(`phone = $${paramCount}`);
        values.push(formattedPhone);
      }
      if (cleanedCompany) {
        paramCount++;
        updates.push(`company = $${paramCount}`);
        values.push(cleanedCompany);
      }
      if (cleanedSource) {
        paramCount++;
        updates.push(`source = $${paramCount}`);
        values.push(cleanedSource);
      }
      if (contactStatus) {
        paramCount++;
        updates.push(`status = $${paramCount}`);
        values.push(contactStatus);
      }
      if (cleanedNotes !== undefined) {  // Allow empty string
        paramCount++;
        updates.push(`notes = $${paramCount}`);
        values.push(cleanedNotes);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      // Add updated_at
      paramCount++;
      updates.push(`updated_at = $${paramCount}`);
      values.push(new Date());

      // Add WHERE conditions
      paramCount++;
      values.push(contactId);
      paramCount++;
      values.push(req.user.userId);

      const query = `
        UPDATE contacts 
        SET ${updates.join(', ')}
        WHERE id = $${paramCount - 1} AND user_id = $${paramCount}
        RETURNING id, name, email, phone, company, source, status, notes, created_at, updated_at
      `;

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      res.json({
        message: 'Contact updated successfully',
        contact: result.rows[0],
        timestamp: new Date().toISOString()
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({
      error: 'Failed to update contact',
      details: error.message
    });
  }
});

// Delete contact by ID for authenticated user
app.delete('/contacts/:id', authenticateToken, async (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    
    if (isNaN(contactId)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(`
        DELETE FROM contacts WHERE id = $1 AND user_id = $2 
        RETURNING id, name, email
      `, [contactId, req.user.userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      res.json({
        message: 'Contact deleted successfully',
        deleted: result.rows[0],
        timestamp: new Date().toISOString()
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({
      error: 'Failed to delete contact',
      details: error.message
    });
  }
});

// Legacy endpoint for backward compatibility
app.delete('/cards/:id', authenticateToken, async (req, res) => {
  // Redirect to new contacts endpoint
  res.redirect(308, `/contacts/${req.params.id}`);
});

// Get current user profile
app.get('/profile', authenticateToken, async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT id, email, name, created_at FROM users WHERE id = $1',
        [req.user.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        user: result.rows[0],
        timestamp: new Date().toISOString()
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      error: 'Failed to fetch profile',
      details: error.message
    });
  }
});

// Update user profile
app.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, email } = req.body;
    
    if (!name && !email) {
      return res.status(400).json({ error: 'Name or email is required' });
    }

    const client = await pool.connect();
    try {
      // Build dynamic update query
      const updates = [];
      const values = [];
      let paramCount = 0;

      if (name) {
        paramCount++;
        updates.push(`name = $${paramCount}`);
        values.push(name);
      }
      if (email) {
        paramCount++;
        updates.push(`email = $${paramCount}`);
        values.push(email.toLowerCase());
      }

      paramCount++;
      values.push(req.user.userId);

      const query = `
        UPDATE users 
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, email, name, created_at
      `;

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        message: 'Profile updated successfully',
        user: result.rows[0],
        timestamp: new Date().toISOString()
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error updating profile:', error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({
        error: 'Email already exists',
        details: 'Another user is already registered with this email'
      });
    } else {
      res.status(500).json({
        error: 'Failed to update profile',
        details: error.message
      });
    }
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
    method: req.method,
    available_endpoints: [
      'POST /register',
      'POST /login', 
      'GET /profile',
      'PUT /profile',
      'POST /contacts',
      'GET /contacts',
      'GET /contacts/:id',
      'PUT /contacts/:id',
      'DELETE /contacts/:id',
      'GET /'
    ]
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  await pool.end();
  console.log('✅ Database connection pool closed');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  await pool.end();
  console.log('✅ Database connection pool closed');
  process.exit(0);
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Business Card CRM API running on port ${port}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
  console.log(`🔐 JWT Secret: ${JWT_SECRET !== 'your-secret-key-change-in-production' ? 'Configured' : 'Using default (CHANGE IN PRODUCTION!)'}`);
});

module.exports = app; 