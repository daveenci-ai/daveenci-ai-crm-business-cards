const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { handleBusinessCardWebhook } = require('./serverless-function');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// --- GITHUB WEBHOOK ENDPOINT ---
app.post('/api/github-webhook', async (req, res) => {
  const event = {
    body: req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body),
    rawBody: req.rawBody, // Pass the raw Buffer for signature validation
    headers: req.headers
  };
  try {
    const result = await handleBusinessCardWebhook(event);
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (error) {
    console.error('❌ Webhook handler error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Optional: Alias for /api/webhook
app.post('/api/webhook', async (req, res) => {
  const event = {
    body: req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body),
    rawBody: req.rawBody, // Pass the raw Buffer for signature validation
    headers: req.headers
  };
  try {
    const result = await handleBusinessCardWebhook(event);
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (error) {
    console.error('❌ Webhook handler error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
}
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Business Card CRM API is running',
    timestamp: new Date().toISOString(),
    version: '3.0.0',
    features: ['AI-powered business card processing', 'Webhook integration', 'PostgreSQL storage', 'Telegram notifications']
  });
});

// JWT authentication middleware (for future expansion)
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

// Remove legacy endpoints, test endpoints, and unused utility functions
// Only keep endpoints relevant to the AI-driven pipeline

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
      'POST /api/github-webhook',
      'POST /api/webhook',
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