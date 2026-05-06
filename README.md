# BizFlow  – Intelligent Business Management Platform

## Overview

This project was developed as part of the **PIDEV** (Projet Intégré de Développement) – 3rd Year Engineering Program at **Esprit School of Engineering** (Academic Year 2025–2026).

BizFlow AI is a comprehensive full-stack web application designed for Small and Medium Enterprises (SMEs) to manage their business operations efficiently. The platform combines traditional Enterprise Resource Planning (ERP) functionality with cutting-edge Artificial Intelligence capabilities to automate repetitive tasks, provide intelligent insights, and streamline financial management.

The application enables businesses to manage invoices, expenses, inventory, clients, suppliers, and team collaboration while leveraging AI for document processing, expense categorization, risk assessment, and intelligent automation.

## Features

### Core Business Features
- **Invoice Management**: Create, send, and track invoices with PDF generation and email delivery
- **Quote Management**: Generate professional quotes that convert seamlessly to invoices
- **Sales Orders**: Complete order processing workflow from creation to fulfillment
- **Expense Tracking**: Track business expenses with receipt uploads and categorization
- **Purchase Orders**: Manage supplier orders and procurement processes
- **Inventory Management**: Real-time stock tracking with low stock alerts
- **Client & Supplier CRM**: Comprehensive contact management with history tracking
- **Credit Notes**: Handle refunds, returns, and invoice adjustments
- **Cash Management**: Track cash flow with money in/out transactions
- **Multi-Currency Support**: Handle transactions in multiple currencies
- **Dashboard & Reporting**: Real-time KPIs, revenue charts, and financial reports

### AI-Powered Features
- **AI Document Scanner (OCR)**: Extract text from invoices and receipts using Google Cloud Vision API with OCR.space fallback
- **AI Expense Categorization**: Machine learning-based automatic categorization using TensorFlow.js and Universal Sentence Encoder
- **AI Invoice Risk Scorer**: Neural network that predicts payment risk (Low/Medium/High) based on invoice amount, due date, and client payment history
- **AI Chatbot**: Natural language assistant for business queries and navigation
- **AI Anomaly Detection**: Automatic detection of unusual invoice amounts and patterns
- **AI Email Validation**: Verify email deliverability before sending communications
- **AI Smart Auto-Fill**: Extract client information from pasted text or email signatures
- **AI Focus Mode**: Guided workflow assistance for enhanced productivity
- **AI Onboarding**: Interactive first-time user experience with guided tours

### Collaboration & Security Features
- **Multi-Tenancy**: Complete data isolation between different businesses
- **Role-Based Access Control**: 5 user roles (Platform Admin, Business Owner, Business Admin, Accountant, Team Member)
- **Team Invitations**: Invite team members with pre-assigned roles and permissions
- **Activity Logging**: Complete audit trail of all user actions
- **Email Notifications**: Automated emails for invoices, invitations, and system events

## Tech Stack

### Frontend
- **React 19** – Modern UI library with hooks and functional components
- **TypeScript 5** – Type-safe JavaScript for better code quality and IDE support
- **Vite 6** – Next-generation build tool for fast development and optimized production builds
- **Tailwind CSS 4** – Utility-first CSS framework for rapid responsive design
- **React Router 7** – Declarative routing with nested routes and route guards
- **Axios** – Promise-based HTTP client for API communication
- **Recharts & ApexCharts** – Data visualization and charting libraries
- **FullCalendar** – Interactive calendar for scheduling and events
- **jsPDF & html2canvas** – Client-side PDF generation
- **CKEditor 5** – Rich text editor for content creation
- **react-dnd** – Drag and drop functionality

### Backend
- **NestJS 11** – Progressive Node.js framework with modular architecture and dependency injection
- **TypeScript 5** – Full type safety across the backend codebase
- **TypeORM 0.3** – TypeScript ORM for database operations with decorators
- **MySQL 8** – Relational database management system (PostgreSQL compatible)
- **Passport.js** – Authentication middleware with JWT strategy
- **TensorFlow.js 4** – Machine learning library running directly in Node.js
- **@tensorflow-models/universal-sentence-encoder** – Pre-trained model for text embeddings
- **Puppeteer 24** – Headless Chrome for PDF generation from HTML
- **Nodemailer 6** – Email sending library for SMTP integration
- **@nestjs/schedule** – Cron job scheduling for automated tasks
- **class-validator & class-transformer** – DTO validation and transformation
- **bcrypt** – Password hashing with salt rounds
- **JWT** – JSON Web Tokens for authentication

### DevOps & Infrastructure
- **Docker** – Containerization for consistent deployment environments
- **Docker Compose** – Multi-container orchestration for local development
- **Jenkins** – CI/CD pipeline automation with Jenkinsfile
- **SonarQube** – Code quality analysis and security vulnerability detection
- **Kubernetes** – Container orchestration for production deployment
- **Nginx** – Reverse proxy and static file serving
- **Git** – Version control with feature branch workflow

### External APIs & Services
- **Google Cloud Vision API** – OCR text extraction (1000 free requests/month)
- **OCR.space API** – Fallback OCR service (25,000 free requests/month)
- **SMTP Server** – Email delivery service integration

## Architecture

### System Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Browser    │  │   Mobile     │  │   Tablet     │       │
│  │  (React App) │  │  (Responsive)│  │  (Responsive)│       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │ HTTPS (Port 443)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      REVERSE PROXY                           │
│                         (Nginx)                              │
└─────────────────────────────┬───────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   FRONTEND      │    │     BACKEND     │    │   EXTERNAL      │
│   SERVICE       │    │     SERVICE     │    │   SERVICES      │
│                 │    │                 │    │                 │
│  React + Vite   │    │  NestJS +       │    │  Google Vision  │
│  Tailwind CSS   │    │  TypeORM        │    │  OCR.space      │
│  Port: 80       │    │  TensorFlow.js  │    │  SMTP Server    │
│                 │    │  Port: 3000     │    │                 │
└────────┬────────┘    └────────┬────────┘    └─────────────────┘
         │                      │
         │                      ▼
         │             ┌─────────────────┐
         │             │   DATABASE      │
         │             │                 │
         │             │  MySQL 8.x      │
         │             │  Port: 3306     │
         │             │                 │
         │             └─────────────────┘
         │
         ▼
┌─────────────────┐
│   FILE STORAGE  │
│                 │
│  Local FS / S3  │
│  (Uploads)      │
└─────────────────┘
```

### Backend Architecture (NestJS)
The backend follows a modular architecture with 26 feature modules:

- **Auth Module** – Authentication, JWT handling, password reset, email verification
- **User Module** – User management with role-based permissions
- **Tenant Module** – Multi-tenancy data isolation
- **Business Module** – Business profile management
- **Invoice Module** – Invoice lifecycle management with AI risk scoring
- **Expense Module** – Expense tracking with AI categorization
- **Client Module** – Customer relationship management
- **Supplier Module** – Vendor management
- **Product Module** – Product catalog and inventory
- **Stock Movement Module** – Inventory tracking and alerts
- **Quote Module** – Quote generation and conversion
- **Sales Order Module** – Order processing workflow
- **Purchase Order Module** – Procurement management
- **Payment Module** – Payment record tracking
- **Credit Note Module** – Refund and adjustment handling
- **Document Processing Module** – OCR and document AI
- **AI Module** – Machine learning services (categorization, risk scoring)
- **Reporting Module** – Analytics and report generation
- **Audit Module** – Activity logging and audit trails
- **Notification Module** – Email notification system

### Database Architecture
- **Type**: Relational SQL (MySQL 8.x / PostgreSQL 15.x)
- **ORM**: TypeORM with TypeScript decorators
- **Entities**: 26 tables with relationships
- **Multi-Tenancy**: Every entity includes `tenantId` for data isolation
- **Synchronization**: Auto-create tables in development, migrations in production
- **Key Relationships**:
  - User → Tenant (Many-to-One)
  - Business → Tenant (Many-to-One)
  - Invoice → Client/Business (Many-to-One)
  - Invoice → InvoiceItem (One-to-Many)
  - Payment → Invoice (Polymorphic reference)

### Frontend Architecture
- **Component Structure**: Functional components with React Hooks
- **State Management**: React Context API (AuthContext, BusinessContext, FocusModeContext)
- **Routing**: React Router with protected routes and role-based guards
- **HTTP Communication**: Axios with request/response interceptors
- **Styling**: Tailwind CSS utility classes with responsive design
- **AI Integration**: AI components (AIChatbotWidget, AIOnboarding, AIScanner)

### CI/CD Pipeline
```
Developer Push → Git Webhook → Jenkins
                                    ↓
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              [Install] → [Test] → [SonarQube]
                                    ↓
                              [Build App]
                                    ↓
                              [Docker Build]
                                    ↓
                              [Docker Push]
                                    ↓
                              [Trigger CD]
                                    ↓
                              [Kubernetes Deploy]
```

## Contributors

### Development Team
- **Oussema Denguir** 
- **[Nour Romdhani 2]** 
- **[Mayssen Kaabi 3]** 
- **[Bechir Mnissi 2]** 


### Project Supervision
- **Supervisor**: [Mohamed Elhami] – Esprit School of Engineering

## Academic Context

**Institution:** Esprit School of Engineering – Tunisia

**Program:** PIDEV (Projet Intégré de Développement) – 4 Year Engineering

**Academic Year:** 2025–2026

**Project Duration:** [01/02/2026] – [14/05/2026]


This project demonstrates the application of software engineering principles, modern web development practices, and artificial intelligence integration learned during the 3rd year of the engineering program at Esprit School of Engineering.

## Getting Started

### Prerequisites
- Node.js 20.x or higher
- MySQL 8.x or PostgreSQL 15.x
- npm 10.x or yarn 1.22.x
- Docker (optional, for containerized deployment)

### Installation

1. **Clone the repository:**
   ```bash
   git clone [repository-url]
   cd BizFlow-AI
   ```

2. **Backend Setup:**
   ```bash
   cd PI_TWIN5_BACK
   npm install
   ```

3. **Configure environment variables:**
   Create `.env` file in `PI_TWIN5_BACK`:
   ```
   DB_HOST=localhost
   DB_PORT=3306
   DB_USERNAME=root
   DB_PASSWORD=your_password
   DB_DATABASE=bizflow_db
   JWT_SECRET=your-secret-key-min-32-chars
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
   OCR_SPACE_API_KEY=your-ocr-space-key
   ```

4. **Start Backend:**
   ```bash
   npm run start:dev
   ```

5. **Frontend Setup:**
   ```bash
   cd ../PI_TWIN5_FRONT
   npm install
   ```

6. **Start Frontend:**
   ```bash
   npm run dev
   ```

7. **Access Application:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000

### Docker Deployment

1. **Build and start all services:**
   ```bash
   docker-compose up -d
   ```

2. **Access services:**
   - Frontend: http://localhost:80
   - Backend API: http://localhost:3000
   - MySQL: localhost:3306

## Acknowledgments

We would like to express our sincere gratitude to:

- **Esprit School of Engineering** for providing the academic framework and resources for this project
- Our professors and supervisors for their guidance, feedback, and support throughout the development process
- The open-source community for the incredible tools and libraries that made this project possible:
  - NestJS Team for the excellent backend framework
  - React Team for the frontend library
  - TensorFlow.js Team for bringing ML to JavaScript
  - Google Cloud for the Vision API free tier
  - All contributors to the npm packages we used

- Our families and friends for their patience and encouragement during the intensive development period

Special thanks to the creators of the AI models and APIs that power our application's intelligent features.

---

**Developed with ❤️ at Esprit School of Engineering – Tunisia**

**PIDEV 3A | 2025–2026**
