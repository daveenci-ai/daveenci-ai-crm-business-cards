import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Database connection helper
def get_db_connection():
    """Get database connection using DATABASE_URL"""
    try:
        database_url = os.environ.get('DATABASE_URL')
        if not database_url:
            raise ValueError("DATABASE_URL environment variable is required")
        
        conn = psycopg2.connect(database_url, cursor_factory=RealDictCursor)
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        raise



def initialize_database():
    """Initialize database - just check connection since table already exists"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Just verify the table exists and has expected structure
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'business_cards' 
            ORDER BY ordinal_position;
        """)
        
        columns = cur.fetchall()
        if columns:
            print(f"Database connection verified. Found business_cards table with {len(columns)} columns.")
            for col in columns:
                print(f"  - {col['column_name']}: {col['data_type']}")
        else:
            print("Warning: business_cards table not found!")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"Database initialization error: {e}")

@app.route('/', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'Business Card Processor',
        'timestamp': datetime.utcnow().isoformat()
    })

@app.route('/process-card', methods=['POST'])
def process_business_card():
    """Main endpoint to receive business card data from iPhone shortcut"""
    try:
        # Check if we have JSON data or form data
        if request.is_json:
            data = request.get_json()
        else:
            data = request.form.to_dict()
        
        print(f"Received data: {data}")
        
        # Extract the business card fields
        name = data.get('name', '').strip()
        email = data.get('email', '').strip()
        phone = data.get('phone', '').strip()
        company = data.get('company', '').strip()
        website = data.get('website', '').strip()
        title = data.get('title', '').strip()
        address = data.get('address', '').strip()
        additional_notes = data.get('notes', '').strip()
        
        # Validate that we have at least some data
        if not any([name, email, phone, company]):
            return jsonify({
                'error': 'At least one of name, email, phone, or company is required'
            }), 400
        
        # Combine additional details into notes field
        notes_parts = []
        if title:
            notes_parts.append(f"Title: {title}")
        if address:
            notes_parts.append(f"Address: {address}")
        if additional_notes:
            notes_parts.append(f"Notes: {additional_notes}")
        
        notes = "\n".join(notes_parts)
        
        # Save to database
        conn = get_db_connection()
        cur = conn.cursor()
        
        insert_sql = """
        INSERT INTO business_cards 
        (full_name, email, phone, company_name, website, notes) 
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id;
        """
        
        data_to_save = (
            name,
            email,
            phone,
            company,
            website,
            notes
        )
        
        cur.execute(insert_sql, data_to_save)
        card_id = cur.fetchone()['id']
        
        conn.commit()
        cur.close()
        conn.close()
        
        print(f"Successfully saved business card with ID: {card_id}")
        
        # Return success response
        return jsonify({
            'message': 'Business card saved successfully',
            'id': card_id,
            'data': {
                'name': name,
                'email': email,
                'phone': phone,
                'company': company,
                'website': website,
                'title': title,
                'address': address,
                'notes': additional_notes
            }
        }), 200
        
    except Exception as e:
        print(f"Error saving business card: {str(e)}")
        return jsonify({'error': f'Save failed: {str(e)}'}), 500

@app.route('/cards', methods=['GET'])
def get_cards():
    """Get all processed business cards"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT id, full_name, email, phone, company_name, website, notes, dt 
            FROM business_cards 
            ORDER BY dt DESC
        """)
        
        cards = cur.fetchall()
        cur.close()
        conn.close()
        
        return jsonify({
            'cards': [dict(card) for card in cards],
            'count': len(cards)
        })
        
    except Exception as e:
        print(f"Error fetching cards: {str(e)}")
        return jsonify({'error': f'Failed to fetch cards: {str(e)}'}), 500

@app.route('/cards/<int:card_id>', methods=['GET'])
def get_card(card_id):
    """Get a specific business card by ID"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT * FROM business_cards WHERE id = %s
        """, (card_id,))
        
        card = cur.fetchone()
        cur.close()
        conn.close()
        
        if not card:
            return jsonify({'error': 'Card not found'}), 404
            
        return jsonify({'card': dict(card)})
        
    except Exception as e:
        print(f"Error fetching card: {str(e)}")
        return jsonify({'error': f'Failed to fetch card: {str(e)}'}), 500

# Initialize database on startup
def create_app():
    """Application factory with database initialization"""
    initialize_database()
    return app

if __name__ == '__main__':
    # For local development
    initialize_database()
    app.run(debug=True, host='0.0.0.0', port=5000) 