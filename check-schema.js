#!/usr/bin/env node
/**
 * Check database schema script
 * Usage: node check-schema.js
 */

const { Pool } = require('pg');
require('dotenv').config();

async function checkSchema() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    const client = await pool.connect();
    
    console.log('🔍 Checking business_cards table schema...\n');
    
    // Check if table exists and get full schema
    const schemaQuery = `
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'business_cards' 
      ORDER BY ordinal_position;
    `;
    
    const result = await client.query(schemaQuery);
    
    if (result.rows.length === 0) {
      console.log('❌ business_cards table NOT FOUND!');
      console.log('\nYou need to create the table first:');
      console.log(getCreateTableSQL());
      return;
    }
    
    console.log('✅ business_cards table found with the following schema:\n');
    
    let hasIssues = false;
    
    result.rows.forEach(col => {
      const { column_name, data_type, is_nullable, column_default } = col;
      let status = '✅';
      let issue = '';
      
      // Check for specific issues
      if (column_name === 'full_name' && data_type !== 'text') {
        status = '❌';
        issue = ` (ISSUE: Should be TEXT, not ${data_type.toUpperCase()})`;
        hasIssues = true;
      }
      
      console.log(`${status} ${column_name.padEnd(15)} | ${data_type.toUpperCase().padEnd(12)} | ${is_nullable === 'YES' ? 'NULLABLE' : 'NOT NULL'} ${issue}`);
    });
    
    if (hasIssues) {
      console.log('\n🚨 SCHEMA ISSUES DETECTED!');
      console.log('\nTo fix the full_name column, run this SQL:');
      console.log('```sql');
      console.log('ALTER TABLE business_cards ALTER COLUMN full_name TYPE TEXT;');
      console.log('```');
      
      console.log('\nOr recreate the entire table with correct schema:');
      console.log(getCreateTableSQL());
    } else {
      console.log('\n✅ Schema looks good!');
      
      // Test a sample insert
      console.log('\n🧪 Testing sample data insert...');
      try {
        const testData = {
          name: 'Test User',
          email: 'test@example.com',
          phone: '1234567890',
          company: 'Test Company',
          website: 'test.com',
          notes: 'Schema test'
        };
        
        const insertResult = await client.query(`
          INSERT INTO business_cards 
          (full_name, email, phone, company_name, website, notes) 
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id;
        `, [testData.name, testData.email, testData.phone, testData.company, testData.website, testData.notes]);
        
        const newId = insertResult.rows[0].id;
        console.log(`✅ Test insert successful! Created record with ID: ${newId}`);
        
        // Clean up test record
        await client.query('DELETE FROM business_cards WHERE id = $1', [newId]);
        console.log('✅ Test record cleaned up');
        
      } catch (error) {
        console.log(`❌ Test insert failed: ${error.message}`);
      }
    }
    
    client.release();
    await pool.end();
    
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
}

function getCreateTableSQL() {
  return `
-- Correct table schema:
CREATE TABLE business_cards (
    id SERIAL PRIMARY KEY,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    company_name TEXT,
    website TEXT,
    notes TEXT,
    dt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dt_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance:
CREATE INDEX idx_business_cards_email ON business_cards(email);
CREATE INDEX idx_business_cards_company ON business_cards(company_name);
CREATE INDEX idx_business_cards_dt ON business_cards(dt);
`;
}

// Run the check
if (require.main === module) {
  checkSchema().catch(error => {
    console.error('Schema check failed:', error);
    process.exit(1);
  });
}

module.exports = { checkSchema }; 