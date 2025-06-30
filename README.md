# Business Card CRM Processing Service

A simple Flask-based web service that receives business card contact information and stores it in a PostgreSQL database. Designed to work with iPhone Shortcuts for seamless business card data collection.

## Features

- 📝 **Simple Data Input**: Accepts structured business card data via HTTP POST
- 🗄️ **Database Storage**: PostgreSQL database with structured contact data
- 📱 **iPhone Integration**: Compatible with iOS Shortcuts for mobile use
- 🔒 **Secure Configuration**: Environment-based configuration for sensitive data
- 🚀 **Cloud Ready**: Optimized for deployment on Render.com
- ⚡ **Lightweight**: Minimal dependencies for fast deployment

## API Endpoints

### POST `/process-card`
Save business card contact information to the database.

**Request:**
- Method: `POST`
- Content-Type: `application/json` or `application/x-www-form-urlencoded`
- Fields:
  - `name` (string): Full name of the person
  - `email` (string): Email address
  - `phone` (string): Phone number
  - `company` (string): Company name
  - `title` (optional, string): Job title/position
  - `website` (optional, string): Website URL
  - `address` (optional, string): Physical address
  - `notes` (optional, string): Additional notes

**Example JSON Request:**
```json
{
  "name": "John Doe",
  "email": "john@company.com",
  "phone": "5551234567",
  "company": "Tech Corp",
  "title": "Software Engineer",
  "website": "techcorp.com",
  "address": "123 Main St, City, State",
  "notes": "Met at tech conference"
}
```

**Response:**
```json
{
  "message": "Business card saved successfully",
  "id": 123,
  "data": {
    "name": "John Doe",
    "email": "john@company.com",
    "phone": "5551234567",
    "company": "Tech Corp",
    "title": "Software Engineer",
    "website": "techcorp.com",
    "address": "123 Main St, City, State",
    "notes": "Met at tech conference"
  }
}
```

### GET `/cards`
Retrieve all processed business cards.

### GET `/cards/{id}`
Retrieve a specific business card by ID.

### GET `/`
Health check endpoint.

## Setup Instructions

### 1. Environment Configuration

Create environment variables based on `env_example.txt`:

**Required Variables:**
- `DATABASE_URL`: PostgreSQL connection string (format: `postgresql://username:password@hostname:port/database_name`)

### 2. For Render.com Deployment

1. **Connect Repository**: Link this GitHub repository to your Render Web Service
2. **Set Build Command**: `pip install -r requirements.txt`
3. **Set Start Command**: `gunicorn app:app`
4. **Configure Environment Variables** in Render dashboard:
   - `DATABASE_URL` is automatically provided by Render when you create a PostgreSQL database
   - Link your PostgreSQL database to your web service

### 3. For Local Development

```bash
# Clone the repository
git clone https://github.com/daveenci-ai/daveenci-ai-crm-business-cards.git
cd daveenci-ai-crm-business-cards

# Install dependencies
pip install -r requirements.txt

# Set environment variables (create .env file)
export DATABASE_URL=postgresql://username:password@localhost:5432/database_name

# Run the application
python app.py
```

## Database Schema

The application works with your existing `business_cards` table:

```sql
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
```

**Note**: Additional extracted data (job title, address, raw OCR text) is stored in the `notes` field in a structured format.

## iPhone Shortcut Integration

To use with iOS Shortcuts:

1. Create a new shortcut in the Shortcuts app
2. Add actions to collect business card information (text input, ask for input, etc.)
3. Add "Get Contents of URL" action with:
   - URL: `https://your-app.onrender.com/process-card`
   - Method: POST
   - Request Body: JSON
   - Add JSON fields: `name`, `email`, `phone`, `company`, `title`, `website`, `address`, `notes`
4. Add response handling as needed

**Example Shortcut Flow:**
- Ask for input: "Name"
- Ask for input: "Email" 
- Ask for input: "Phone"
- Ask for input: "Company"
- Send JSON data to API endpoint

## Technology Stack

- **Backend**: Flask (Python)
- **Database**: PostgreSQL
- **Deployment**: Gunicorn WSGI server

## Architecture

1. **Data Reception**: Flask receives structured contact data via JSON or form data
2. **Data Validation**: Validates required fields and data format
3. **Database Storage**: Saves structured data to PostgreSQL
4. **Response**: Returns success confirmation with saved data

## Error Handling

- Validates required contact data fields
- Comprehensive error logging and user feedback
- Database transaction management
- Handles both JSON and form data input formats

## Security

- Environment variable configuration for sensitive data
- No hardcoded credentials
- CORS enabled for cross-origin requests
- Input validation and sanitization

## Support

For issues or questions, please check:
1. Render deployment logs for runtime errors
2. Database connection settings
3. Environment variable configuration
4. Data format requirements (JSON or form data)
