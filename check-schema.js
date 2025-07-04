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
    
    console.log('🔍 Checking users and contacts table schemas...\n');
    
    // Check users table
    const usersSchemaQuery = `
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position;
    `;
    
    const usersResult = await client.query(usersSchemaQuery);
    
    if (usersResult.rows.length === 0) {
      console.log('❌ users table NOT FOUND!');
      console.log('\nYou need to create the table first:');
      console.log(getUsersCreateTableSQL());
    } else {
      console.log('✅ users table found with the following schema:\n');
      
      let usersHasIssues = false;
      
      usersResult.rows.forEach(col => {
        const { column_name, data_type, is_nullable, column_default } = col;
        let status = '✅';
        let issue = '';
        
        // Check for specific issues
        if (column_name === 'email' && data_type !== 'text') {
          status = '❌';
          issue = ` (ISSUE: Should be TEXT, not ${data_type.toUpperCase()})`;
          usersHasIssues = true;
        }
        
        if (column_name === 'password' && data_type !== 'text') {
          status = '❌';
          issue = ` (ISSUE: Should be TEXT, not ${data_type.toUpperCase()})`;
          usersHasIssues = true;
        }
        
        console.log(`${status} ${column_name.padEnd(15)} | ${data_type.toUpperCase().padEnd(12)} | ${is_nullable === 'YES' ? 'NULLABLE' : 'NOT NULL'} ${issue}`);
      });
      
      if (usersHasIssues) {
        console.log('\n🚨 USERS TABLE SCHEMA ISSUES DETECTED!');
        console.log('\nTo fix the issues, you may need to recreate the table:');
        console.log(getUsersCreateTableSQL());
      } else {
        console.log('\n✅ Users table schema looks good!');
      }
    }
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Check contacts table
    const contactsSchemaQuery = `
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'contacts' 
      ORDER BY ordinal_position;
    `;
    
    const contactsResult = await client.query(contactsSchemaQuery);
    
    if (contactsResult.rows.length === 0) {
      console.log('❌ contacts table NOT FOUND!');
      console.log('\nYou need to create the table first:');
      console.log(getContactsCreateTableSQL());
    } else {
      console.log('✅ contacts table found with the following schema:\n');
    
      let contactsHasIssues = false;
    
      contactsResult.rows.forEach(col => {
      const { column_name, data_type, is_nullable, column_default } = col;
      let status = '✅';
      let issue = '';
      
      // Check for specific issues
        if (column_name === 'status' && data_type !== 'USER-DEFINED') {
          status = '❌';
          issue = ` (ISSUE: Should be status ENUM, not ${data_type.toUpperCase()})`;
          contactsHasIssues = true;
        }
        
        if (column_name === 'user_id' && data_type !== 'integer') {
        status = '❌';
          issue = ` (ISSUE: Should be INTEGER, not ${data_type.toUpperCase()})`;
          contactsHasIssues = true;
      }
      
      console.log(`${status} ${column_name.padEnd(15)} | ${data_type.toUpperCase().padEnd(12)} | ${is_nullable === 'YES' ? 'NULLABLE' : 'NOT NULL'} ${issue}`);
    });
    
      if (contactsHasIssues) {
        console.log('\n🚨 CONTACTS TABLE SCHEMA ISSUES DETECTED!');
        console.log('\nTo fix the issues, you may need to recreate the table:');
        console.log(getContactsCreateTableSQL());
      } else {
        console.log('\n✅ Contacts table schema looks good!');
      }
    }
    
    // Check if status enum exists
    console.log('\n' + '='.repeat(60) + '\n');
    console.log('🔍 Checking status enum type...\n');
    
    const enumQuery = `
      SELECT enumlabel 
      FROM pg_enum e 
      JOIN pg_type t ON e.enumtypid = t.oid 
      WHERE t.typname = 'status'
      ORDER BY e.enumsortorder;
    `;
    
    const enumResult = await client.query(enumQuery);
    
    if (enumResult.rows.length === 0) {
      console.log('❌ status enum NOT FOUND!');
      console.log('\nYou need to create the enum first:');
      console.log(getStatusEnumSQL());
    } else {
      console.log('✅ status enum found with values:');
      enumResult.rows.forEach(row => {
        console.log(`  - ${row.enumlabel}`);
      });
    }
    
    // Test functionality if both tables exist
    if (usersResult.rows.length > 0 && contactsResult.rows.length > 0) {
      console.log('\n' + '='.repeat(60) + '\n');
      console.log('🧪 Testing sample operations...\n');
      
      try {
        // Test user operations
        console.log('Testing user table operations...');
        
        // Check if any users exist
        const userCountResult = await client.query('SELECT COUNT(*) FROM users');
        console.log(`✅ Users table query successful. Current user count: ${userCountResult.rows[0].count}`);
        
        // Test contact operations
        console.log('Testing contacts table operations...');
        
        // Check if any contacts exist
        const contactCountResult = await client.query('SELECT COUNT(*) FROM contacts');
        console.log(`✅ Contacts table query successful. Current contact count: ${contactCountResult.rows[0].count}`);
        
        // Test foreign key relationship
        const fkResult = await client.query(`
          SELECT COUNT(*) as orphaned_contacts
          FROM contacts c 
          LEFT JOIN users u ON c.user_id = u.id 
          WHERE u.id IS NULL
        `);
        
        if (parseInt(fkResult.rows[0].orphaned_contacts) > 0) {
          console.log(`❌ Found ${fkResult.rows[0].orphaned_contacts} orphaned contacts (no matching user)`);
        } else {
          console.log('✅ All contacts have valid user references');
        }
        
      } catch (error) {
        console.log(`❌ Test operations failed: ${error.message}`);
      }
    }
    
    client.release();
    await pool.end();
    
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
}

function getUsersCreateTableSQL() {
  return `
-- Users table schema:
CREATE TABLE public.users (
    id serial4 NOT NULL,
    email text NOT NULL,
    "name" text NULL,
    "password" text NOT NULL,
    created_at timestamp(3) DEFAULT now() NOT NULL,
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- Add indexes for performance:
CREATE INDEX idx_users_email ON users(email);
`;
}

function getStatusEnumSQL() {
  return `
-- Status enum type:
CREATE TYPE public.status AS ENUM ('PROSPECT', 'LEAD', 'CUSTOMER', 'INACTIVE');
`;
}

function getContactsCreateTableSQL() {
  return `
-- Contacts table schema (requires status enum and users table):
CREATE TABLE public.contacts (
    id serial4 NOT NULL,
    "name" text NOT NULL,
    email text NOT NULL,
    phone text NULL,
    company text NULL,
    "source" text NULL,
    status public.status NOT NULL,
    notes text NULL,
    created_at timestamp(3) DEFAULT now() NOT NULL,
    updated_at timestamp(3) NOT NULL,
    user_id int4 NOT NULL,
    CONSTRAINT contacts_pkey PRIMARY KEY (id),
    CONSTRAINT contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Add indexes for performance:
CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_company ON contacts(company);
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_contacts_updated_at ON contacts(updated_at);
`;
}

checkSchema(); 