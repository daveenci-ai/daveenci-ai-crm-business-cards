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
  try {
    const {
      name = '',
      email = '',
      phone = '',
      company = '',
      title = '',
      website = '',
      address = '',
      notes = ''
    } = req.body;

    console.log('Received business card data:', req.body);

    // Validate required fields
    if (!name && !email && !phone && !company) {
      return res.status(400).json({
        error: 'At least one of name, email, phone, or company is required'
      });
    }

    // Prepare notes field with additional details
    const notesParts = [];
    if (title) notesParts.push(`Title: ${title}`);
    if (address) notesParts.push(`Address: ${address}`);
    if (notes) notesParts.push(`Notes: ${notes}`);
    
    const combinedNotes = notesParts.join('\n');

    // Insert into database
    const client = await pool.connect();
    try {
      const insertQuery = `
        INSERT INTO business_cards 
        (full_name, email, phone, company_name, website, notes) 
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, dt;
      `;

      const result = await client.query(insertQuery, [
        name.trim(),
        email.trim(),
        phone.trim(),
        company.trim(),
        website.trim(),
        combinedNotes
      ]);

      const savedCard = result.rows[0];
      console.log(`Successfully saved business card with ID: ${savedCard.id}`);

      res.status(200).json({
        message: 'Business card saved successfully',
        id: savedCard.id,
        timestamp: savedCard.dt,
        data: {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          company: company.trim(),
          website: website.trim(),
          title: title.trim(),
          address: address.trim(),
          notes: notes.trim()
        }
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error saving business card:', error);
    res.status(500).json({
      error: 'Failed to save business card',
      details: error.message
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