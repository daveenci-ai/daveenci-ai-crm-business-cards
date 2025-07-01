# Business Card CRM API v2.0

A modern Node.js Express API with user authentication and contact management, designed for business card data collection and CRM functionality. Features JWT-based authentication and PostgreSQL database with proper user isolation.

## Features

- 🔐 **User Authentication**: JWT-based registration and login system
- 👥 **Multi-User Support**: Each user manages their own contacts
- 📝 **Contact Management**: Full CRUD operations for business contacts
- 🗄️ **PostgreSQL Database**: Structured data with foreign key relationships
- 📱 **iPhone Integration**: Compatible with iOS Shortcuts for mobile use
- 🔒 **Secure Configuration**: Environment-based configuration for sensitive data
- 🚀 **Cloud Ready**: Optimized for deployment on Render.com
- ⚡ **Lightweight**: Minimal dependencies for fast deployment

## API Endpoints

### Authentication Endpoints

#### POST `/register`
Register a new user account.

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "email": "john@example.com",
    "name": "John Doe",
    "created_at": "2024-01-01T12:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### POST `/login`
Login with existing credentials.

**Request:**
```json
{
  "email": "john@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "email": "john@example.com",
    "name": "John Doe"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Contact Management Endpoints

**Authentication Required:** All contact endpoints require a valid JWT token in the `Authorization` header:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### POST `/contacts`
Create a new contact (replaces `/process-card`).

**Request:**
```json
{
  "name": "Jane Smith",
  "email": "jane@company.com",
  "phone": "5551234567",
  "company": "Tech Corp",
  "source": "Business Card",
  "status": "PROSPECT",
  "notes": "Met at tech conference"
}
```

**Response:**
```json
{
  "message": "Contact saved successfully",
  "id": 123,
  "created_at": "2024-01-01T12:00:00.000Z",
  "updated_at": "2024-01-01T12:00:00.000Z",
  "data": {
    "name": "Jane Smith",
    "email": "jane@company.com",
    "phone": "555-123-4567",
    "company": "Tech Corp",
    "source": "Business Card",
    "status": "PROSPECT",
    "notes": "Met at tech conference",
    "user_id": 1
  }
}
```

#### GET `/contacts`
Retrieve all contacts for the authenticated user.

**Query Parameters:**
- `status` (optional): Filter by status (`PROSPECT`, `LEAD`, `CUSTOMER`, `INACTIVE`)
- `search` (optional): Search in name, email, or company
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "contacts": [...],
  "count": 25,
  "total": 100,
  "limit": 50,
  "offset": 0,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### GET `/contacts/:id`
Retrieve a specific contact by ID.

#### PUT `/contacts/:id`
Update a specific contact by ID.

#### DELETE `/contacts/:id`
Delete a specific contact by ID.

### User Profile Endpoints

#### GET `/profile`
Get current user profile information.

#### PUT `/profile`
Update user profile (name and/or email).

### Legacy Endpoints

For backward compatibility, the following endpoints redirect to the new contact endpoints:
- `POST /process-card` → `POST /contacts`
- `GET /cards` → `GET /contacts`
- `GET /cards/:id` → `GET /contacts/:id`
- `DELETE /cards/:id` → `DELETE /contacts/:id`

### Health Check

#### GET `/`
Health check endpoint.

## Setup Instructions

### 1. Environment Configuration

Create environment variables based on `env_example.txt`:

**Required Variables:**
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT token signing (CHANGE IN PRODUCTION!)
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (optional, defaults to 5000)

### 2. Database Setup

Create the required database tables and enum type:

```sql
-- Create status enum
CREATE TYPE public.status AS ENUM ('PROSPECT', 'LEAD', 'CUSTOMER', 'INACTIVE');

-- Create users table
CREATE TABLE public.users (
    id serial4 NOT NULL,
    email text NOT NULL,
    "name" text NULL,
    "password" text NOT NULL,
    created_at timestamp(3) DEFAULT now() NOT NULL,
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_pkey PRIMARY KEY (id)
);

-- Create contacts table
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

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_company ON contacts(company);
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_contacts_updated_at ON contacts(updated_at);
```

### 3. For Render.com Deployment

1. **Connect Repository**: Link this GitHub repository to your Render Web Service
2. **Set Build Command**: `npm install`
3. **Set Start Command**: `npm start`
4. **Configure Environment Variables** in Render dashboard:
   - `DATABASE_URL` (automatically provided by Render PostgreSQL)
   - `JWT_SECRET` (generate a secure random string)
   - `NODE_ENV=production`

### 4. For Local Development

```bash
# Clone the repository
git clone https://github.com/daveenci-ai/daveenci-ai-crm-business-cards.git
cd daveenci-ai-crm-business-cards

# Install dependencies
npm install

# Set environment variables (create .env file)
export DATABASE_URL=postgresql://username:password@localhost:5432/database_name
export JWT_SECRET=your-super-secret-jwt-key
export NODE_ENV=development

# Check database schema
npm run check-schema

# Run the application
npm start

# Or run in development mode with auto-restart
npm run dev
```

## Database Schema

The application uses a modern multi-user architecture:

### Users Table
- `id`: Primary key
- `email`: Unique user email (login identifier)
- `name`: User's full name
- `password`: Hashed password (bcrypt)
- `created_at`: Account creation timestamp

### Contacts Table
- `id`: Primary key
- `name`: Contact's full name
- `email`: Contact's email
- `phone`: Contact's phone number
- `company`: Contact's company name
- `source`: How the contact was acquired
- `status`: Contact status enum (`PROSPECT`, `LEAD`, `CUSTOMER`, `INACTIVE`)
- `notes`: Additional notes
- `created_at`: Contact creation timestamp
- `updated_at`: Last modification timestamp
- `user_id`: Foreign key to users table

## iPhone Shortcut Integration

To use with iOS Shortcuts for authenticated contact creation:

1. Create a shortcut to get user credentials and JWT token
2. Add actions to collect business card information
3. Add "Get Contents of URL" action with:
   - URL: `https://your-app.onrender.com/contacts`
   - Method: POST
   - Headers: `Authorization: Bearer [your-jwt-token]`
   - Request Body: JSON with contact fields

**Example Shortcut Flow:**
1. Get stored JWT token (from previous login)
2. Ask for input: "Name", "Email", "Phone", "Company"
3. Send authenticated JSON data to `/contacts` endpoint
4. Handle response and show success/error message

## Authentication Flow

1. **Registration**: `POST /register` with email, name, password
2. **Login**: `POST /login` with email, password
3. **Store Token**: Save the returned JWT token securely
4. **API Requests**: Include token in `Authorization: Bearer <token>` header
5. **Token Expiry**: Tokens expire after 24 hours, re-login required

## Technology Stack

- **Backend**: Express.js (Node.js)
- **Database**: PostgreSQL with connection pooling
- **Authentication**: JWT tokens with bcrypt password hashing
- **Security**: Helmet.js, CORS, input validation
- **Performance**: Compression middleware
- **Deployment**: Native Node.js server

## Architecture

1. **User Management**: Registration, login, profile management
2. **Authentication**: JWT token-based with middleware protection
3. **Contact Management**: CRUD operations with user isolation
4. **Data Validation**: Input sanitization and format validation
5. **Database Relations**: Foreign key constraints ensure data integrity
6. **Error Handling**: Comprehensive error responses and logging

## Security Features

- Password hashing with bcrypt (10 salt rounds)
- JWT token authentication with configurable expiry
- Input validation and sanitization
- SQL injection protection via parameterized queries
- User data isolation (users can only access their own contacts)
- Environment variable configuration for secrets
- CORS enabled for cross-origin requests

## Testing

Check your database schema:
```bash
npm run check-schema
```

Test your deployed API:
```bash
node test-api.js https://your-app.onrender.com
```

For local testing:
```bash
npm test
```

## Migration from v1.0

If upgrading from the previous `business_cards` table structure:

1. **Backup Data**: Export existing business card data
2. **Create New Schema**: Run the SQL commands above
3. **Create User Account**: Register via `/register` endpoint
4. **Migrate Data**: Insert business cards as contacts with your user_id
5. **Update Integrations**: Change endpoints and add authentication

## Support

For issues or questions, please check:
1. Database schema validation with `npm run check-schema`
2. Environment variable configuration (especially `JWT_SECRET`)
3. Authentication token validity and expiry
4. User permission and data isolation
5. PostgreSQL connection and foreign key constraints
