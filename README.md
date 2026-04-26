# BizFlow AI - Backend API

A comprehensive business management and financial tracking system powered by AI. Built with NestJS, TypeORM, and MySQL/PostgreSQL.

## 🚀 Features

### Core Modules
- **Authentication & Authorization** - JWT-based auth with role-based access control
- **User Management** - Multi-role system (Platform Admin, Business Owner, Admin, Accountant, Team Member)
- **Business Management** - Multi-tenant architecture with business isolation
- **Client & Supplier Management** - Full CRM functionality

### Financial Management
- **Invoicing** - Create, manage, and track invoices with PDF generation
- **Quotes & Sales Orders** - Convert quotes to invoices seamlessly
- **Expenses** - Track and categorize business expenses with receipt uploads
- **Payments** - Record money in/out transactions
- **Credit Notes** - Handle refunds and adjustments
- **Purchase Orders** - Manage supplier orders

### Inventory & Stock
- **Product Management** - Track storable and consumable products
- **Stock Management** - Real-time inventory tracking
- **Stock Movements** - Track all inventory changes
- **Stock Take** - Physical inventory reconciliation

### AI-Powered Features
- **AI Scanner (OCR)** - Extract data from invoices, receipts, and documents using Google Vision API
- **AI Chatbot** - Natural language queries about business data
- **AI Anomaly Detection** - Detect unusual invoice amounts and patterns
- **AI Email Validation** - Verify client email deliverability
- **AI Smart Auto-Fill** - Extract client info from pasted text

### Reporting & Analytics
- **Dashboard Analytics** - Revenue, expenses, profit trends
- **Financial Reports** - Export CSV/PDF reports
- **Top Clients Analysis** - Revenue by client
- **Activity Logs** - Track all user actions

### Notifications & Activity
- **Email Notifications** - Automated emails for invoices, team invites
- **Activity Tracking** - Comprehensive audit trail
- **Calendar Integration** - Schedule and track events

## 🛠️ Tech Stack

- **Framework**: NestJS 11.x
- **Language**: TypeScript 5.x
- **Database**: MySQL 8.x / PostgreSQL 15.x (via TypeORM)
- **Authentication**: Passport.js with JWT
- **File Storage**: Local filesystem (configurable for S3)
- **PDF Generation**: Puppeteer
- **OCR**: Google Cloud Vision API
- **Email**: Nodemailer
- **Scheduling**: @nestjs/schedule

## 📋 Prerequisites

- Node.js 22.x or higher
- MySQL 8.x or PostgreSQL 15.x
- Google Cloud Vision API credentials (for OCR features)
- SMTP server configuration (for email notifications)

## 🚀 Getting Started

### 1. Clone and Install

```bash
cd PI_TWIN5_BACK
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=bizflow_db

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-characters
JWT_EXPIRATION=7d

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Google Vision API (for OCR)
GOOGLE_APPLICATION_CREDENTIALS=./google-vision-credentials.json

# App
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### 3.  AI Scanner



### 4. Database Setup

```bash
# The app uses TypeORM synchronize in development (auto-creates tables)
# For production, use migrations:
npm run typeorm migration:run
```

### 5. Run the Application

```bash
# Development (with hot reload)
npm run start:dev

# Production build
npm run build
npm run start:prod
```

The API will be available at `http://localhost:3000`

## 📚 API Documentation

### Authentication Endpoints
```
POST /auth/signup          - Register new user
POST /auth/signin          - Login
POST /auth/forgot-password - Request password reset
POST /auth/reset-password  - Reset password with token
```

### Business Endpoints
```
GET  /business             - Get current business
PUT  /business             - Update business
POST /business/logo        - Upload business logo
```

### Invoice Endpoints
```
GET    /invoices           - List all invoices
POST   /invoices           - Create new invoice
GET    /invoices/:id       - Get invoice details
PUT    /invoices/:id       - Update invoice
DELETE /invoices/:id       - Delete invoice
POST   /invoices/:id/pdf   - Generate PDF
```

### AI Endpoints
```
POST /ai/chat              - Chat with AI assistant
POST /ai/validate-email    - Validate email address
POST /ai/extract-client    - Extract client info from text
POST /ai/detect-anomaly    - Detect invoice anomalies
POST /ai/generate-report   - Generate AI business report
```

### Full API
All endpoints require authentication (Bearer token) except auth endpoints. See the controller files in each module for complete documentation.

## 🏗️ Project Structure

```
src/
├── activity/           # Activity logging
├── admin-dashboard/    # Platform admin features
├── audit/             # Audit trail management
├── auth/              # Authentication & authorization
├── business/          # Business management
├── cash/              # Cash/payments management
├── client/            # Client CRM
├── config/            # App configuration
├── credit-note/       # Credit notes
├── document-processing/ # OCR & document AI
├── expense/           # Expense tracking
├── invoice/           # Invoice management
├── notification/      # Email notifications
├── payment/           # Payment records
├── product/           # Product catalog
├── purchase-order/    # Purchase orders
├── quote/             # Quotes management
├── reporting/         # Analytics & reports
├── sales-order/       # Sales orders
├── shared/            # Shared utilities, guards, decorators
├── stock-movement/    # Inventory movements
├── stock-take/        # Physical inventory
├── supplier/          # Supplier management
├── tenant/            # Multi-tenancy middleware
└── user/              # User management
```

## 🔐 Role-Based Access Control

| Role | Permissions |
|------|-------------|
| PLATFORM_ADMIN | Full platform access, manage all businesses |
| BUSINESS_OWNER | Full business access, manage team, all features |
| BUSINESS_ADMIN | Similar to owner, can manage team |
| ACCOUNTANT | Financial features, invoices, expenses, reports |
| TEAM_MEMBER | Limited access, view clients, products, invoices |

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📦 Deployment

### Production Build
```bash
npm run build
npm run start:prod
```

### Docker (optional)
```dockerfile
# Dockerfile example
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["node", "dist/main"]
```

## 🔧 Configuration

Key environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| DB_HOST | Database host | Yes |
| DB_PORT | Database port | Yes |
| DB_USERNAME | Database user | Yes |
| DB_PASSWORD | Database password | Yes |
| DB_DATABASE | Database name | Yes |
| JWT_SECRET | JWT signing key (min 32 chars) | Yes |
| SMTP_HOST | Email server host | Yes |
| SMTP_USER | Email username | Yes |
| SMTP_PASS | Email password | Yes |
| GOOGLE_APPLICATION_CREDENTIALS | Path to Vision API credentials | For OCR |
| PORT | API port (default: 3000) | No |

## 📝 License

UNLICENSED - Private software

## 🤝 Support

For support, email support@bizflow.ai or create an issue in the repository.

