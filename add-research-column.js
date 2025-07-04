#!/usr/bin/env node
/**
 * Database Migration: Add research_data column to contacts table
 * Usage: node add-research-column.js
 */

const { Pool } = require('pg');
require('dotenv').config();

async function addResearchColumn() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    const client = await pool.connect();
    
    console.log('🔍 Checking if research_data column exists...\n');
    
    // Check if research_data column already exists
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'contacts' AND column_name = 'research_data';
    `;
    
    const checkResult = await client.query(checkColumnQuery);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ research_data column already exists in contacts table.');
      console.log('No migration needed.');
    } else {
      console.log('➕ Adding research_data column to contacts table...');
      
      // Add the research_data column
      const addColumnQuery = `
        ALTER TABLE contacts 
        ADD COLUMN research_data JSONB;
      `;
      
      await client.query(addColumnQuery);
      
      console.log('✅ Successfully added research_data column to contacts table.');
      console.log('📊 Column type: JSONB (allows storing structured research data)');
    }
    
    // Verify the column was added successfully
    console.log('\n🔍 Verifying contacts table schema...\n');
    
    const schemaQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'contacts' 
      ORDER BY ordinal_position;
    `;
    
    const schemaResult = await client.query(schemaQuery);
    
    console.log('Current contacts table schema:');
    schemaResult.rows.forEach(col => {
      const icon = col.column_name === 'research_data' ? '🆕' : '✅';
      console.log(`${icon} ${col.column_name.padEnd(15)} | ${col.data_type.toUpperCase().padEnd(12)} | ${col.is_nullable === 'YES' ? 'NULLABLE' : 'NOT NULL'}`);
    });
    
    client.release();
    await pool.end();
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('📝 The research_data column can now store AI research results in JSON format.');
    
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  addResearchColumn();
}

module.exports = { addResearchColumn }; 