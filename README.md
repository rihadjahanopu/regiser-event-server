<div align="center">

# ⚙️ Talamij Event Platform — Backend REST API Microservice

[![Node.js](https://img.shields.io/badge/Node.js-v18+-green?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-v5.0-000000?style=for-the-badge&logo=express)](https://expressjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-v6.0-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB_Atlas-v6.0-47A248?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![Better Auth](https://img.shields.io/badge/Better_Auth-v1.6-red?style=for-the-badge)](https://better-auth.com/)
[![Cloudinary](https://img.shields.io/badge/Cloudinary-SDK-3448C5?style=for-the-badge&logo=cloudinary)](https://cloudinary.com/)

*A scalable, highly secure RESTful microservice backend powering participant registration processing, real-time analytics, Cloudinary cloud asset management, anti-fraud certificate verification, and session-based Role-Based Access Control (RBAC).*

[System Architecture](#-system-architecture) • [API Specification](#-complete-api-specification) • [Engineering Highlights](#-engineering--architectural-highlights) • [Interview Q&A](#-technical-interview-presentation-talking-points)

</div>

---

## 📑 Table of Contents
- [Executive Overview](#-executive-overview)
- [System Architecture](#-system-architecture)
- [Core Engineering Features](#-core-engineering-features)
- [Engineering & Architectural Highlights](#-engineering--architectural-highlights)
  - [1. Better Auth & RBAC Security Layer](#1-better-auth--rbac-security-layer)
  - [2. Cloudinary Asset Garbage Collection Pipeline](#2-cloudinary-asset-garbage-collection-pipeline)
  - [3. Singleton Document Settings Architecture](#3-singleton-document-settings-architecture)
  - [4. Anti-Fraud QR Verification Protocol](#4-anti-fraud-qr-verification-protocol)
- [Complete API Specification](#-complete-api-specification)
- [Database Schema Models](#-database-schema-models)
- [Directory Architecture](#-directory-architecture)
- [Environment Configuration](#-environment-configuration)
- [Installation & Local Setup](#-installation--local-setup)
- [Technical Interview Presentation Talking Points](#-technical-interview-presentation-talking-points)

---

## 🎯 Executive Overview

The **Talamij Backend REST API Microservice** provides high-throughput processing for event registrations, secure administrative management, and dynamic CMS capabilities.

Built with **Express 5** and **TypeScript**, it handles high-concurrency registration processing, ensures strict data integrity via Mongoose schemas, manages cloud assets on Cloudinary, and enforces enterprise-grade security via **Better Auth** session verification.

---

## 📐 System Architecture

```
                                    +-----------------------------------------+
                                    |    Next.js Client / Auth Proxy Route    |
                                    +--------------------+--------------------+
                                                         |
                                 +-----------------------+-----------------------+
                                 | REST API Requests                             | Multipart Form Uploads
                                 v                                               v
                   +---------------------------+                   +---------------------------+
                   |  Express 5 Node Server    |                   | Multer Memory Storage     |
                   |   - CORS Middleware       |                   |  - Image Buffer Streaming |
                   |   - Express JSON Parser   |                   +-------------+-------------+
                   +-------------+-------------+                                 |
                                 |                                               | Upload Stream
                                 v                                               v
                   +---------------------------+                   +---------------------------+
                   |  Better Auth & RBAC Guard |                   | Cloudinary CDN Engine     |
                   |   - requireAdmin Guard    |                   |  - Watermarks, Signatures |
                   |   - Session Token Verify  |                   |  - Logos, Banners         |
                   +-------------+-------------+                   +---------------------------+
                                 |
                                 v
                   +---------------------------+
                   | MongoDB Atlas Database    |
                   |  - Registrations          |
                   |  - Singleton Settings     |
                   |  - Admins & User Auth     |
                   +---------------------------+
```

---

## 🚀 Core Engineering Features

### 📝 1. Fast Registration Processing & Verification
- **High-Throughput Enrollment**: Rapid payload validation, unique ID formatting (`TLM-XXXXXX`), seat allocation checks, and indexed query verification for duplicate emails/phones.
- **Paginated Analytics & Reporting**: Filtered aggregation queries supporting real-time breakdown of attendee demographics (Male/Female count, daily velocity, registration status).

### 🛡️ 2. Role-Based Access Control (RBAC) & Better Auth
- **Better Auth Integration**: Native MongoDB adapter integration with session & JWT plugin support.
- **Strict Endpoint Protection**: Custom `requireAdmin` Express middleware validating incoming request session tokens against the database, restricting access to administrative endpoints.

### 🖼️ 3. Cloud Storage Pipeline with Automatic File Garbage Collection
- **Streamlined Upload Processing**: Uses **Multer** memory buffers to stream uploaded brand logos, watermarks, cover banners, and executive signature images directly to Cloudinary.
- **Auto Cleanup**: Overwriting an image automatically triggers Cloudinary API destruction of old public IDs, preventing cloud storage clutter and orphaned assets.

### ⚙️ 4. Singleton CMS Settings Engine
- **Centralized MongoDB Settings Schema**: Single-document MongoDB collection pattern serving all site configurations (custom certificate text, Bismillah calligraphy toggles, event dates, contact details).

---

## 💡 Engineering & Architectural Highlights

### 1. Better Auth & RBAC Security Layer
Requests hitting protected `/api/admin/*` endpoints pass through `requireAdmin` middleware. The handler extracts incoming headers via `better-auth/node`, verifies session state, and validates admin rights in MongoDB:

```typescript
// src/routes/admin.ts
const requireAdmin = async (req: any, res: any, next: any) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session || !session.user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    let isAdmin = session.user.role === "admin";
    if (!isAdmin) {
      const adminRecord = await Admin.findOne({ email: session.user.email });
      if (adminRecord) {
        isAdmin = true;
        // Sync role to user collection
        const db = mongoose.connection.db;
        if (db) {
          await db.collection("user").updateOne(
            { email: session.user.email },
            { $set: { role: "admin" } }
          );
        }
      }
    }

    if (!isAdmin) {
      return res.status(403).json({ success: false, error: "Forbidden: Admin access required" });
    }
    req.session = session;
    next();
  } catch (error) {
    res.status(500).json({ success: false, error: "Authentication failure" });
  }
};
```

### 2. Cloudinary Asset Garbage Collection Pipeline
When an administrator uploads a new watermark, certificate top logo, or signature, the server checks the existing Settings document for a pre-existing Cloudinary `public_id` and dispatches a deletion request prior to saving the new URL:

```typescript
// Automatic cleanup snippet
const existing = await Settings.findOne({});
if (existing?.certWatermarkPublicId) {
  await cloudinary.uploader.destroy(existing.certWatermarkPublicId);
}
```

### 3. Singleton Document Settings Architecture
To avoid unnecessary database reads and complex key-value tables, the application uses a Singleton Settings Schema (`Settings.findOne({})`). If no record exists, the system automatically initializes one with fallback configuration.

### 4. Anti-Fraud QR Verification Protocol
Exposes lightweight public validation APIs (`/api/registration/verify/ticket/:id` and `/api/admin/verify/certificate/:id`) that query indexed MongoDB fields, returning verification status and participant metadata without exposing sensitive personal info.

---

## 🔌 Complete API Specification

### 👥 1. Registration APIs (`/api/registration`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/registration` | Public | Submit new event registration |
| `GET` | `/api/registration/check-email` | Public | Verify if email is already registered |
| `GET` | `/api/registration/check-phone` | Public | Verify if phone number is already registered |
| `GET` | `/api/registration/:id` | Public | Retrieve participant ticket data by ID |
| `GET` | `/api/registration/verify/ticket/:id` | Public | Public QR Code gate ticket verification |

### 🛡️ 2. Admin & CMS Management APIs (`/api/admin`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/dashboard` | Admin | Get event metrics & attendance breakdown |
| `GET` | `/api/admin/registrations` | Admin | Fetch paginated registrations with search/filter |
| `DELETE`| `/api/admin/registrations/:id` | Admin | Delete participant registration record |
| `GET` | `/api/admin/settings` | Admin | Fetch global site & certificate settings |
| `PUT` | `/api/admin/settings` | Admin | Update headings, titles, dates & calligraphy |
| `POST` | `/api/admin/settings/watermark` | Admin | Upload custom watermark image to Cloudinary |
| `DELETE`| `/api/admin/settings/watermark` | Admin | Delete custom watermark image |
| `POST` | `/api/admin/settings/cert-logo` | Admin | Upload dedicated certificate top logo |
| `DELETE`| `/api/admin/settings/cert-logo` | Admin | Delete custom certificate top logo |
| `POST` | `/api/admin/settings/signatures` | Admin | Upload president & secretary signature images |
| `POST` | `/api/admin/settings/cover` | Admin | Upload event cover banner image |

### 🔐 3. Authentication Endpoints (`/api/auth`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/sign-in/email` | Public | Authenticate email & password session |
| `POST` | `/api/auth/sign-up/email` | Public | Register new user account |
| `POST` | `/api/auth/sign-out` | Authenticated | Terminate active user session |
| `GET` | `/api/auth/get-session` | Public | Retrieve current session payload |

---

## 🗄️ Database Schema Models

- **`Registration`**: Participant info (name, email, phone, district, institution, status, registrationId, createdAt).
- **`Settings`**: Singleton document holding organization names, registration panel titles, custom certificate titles, Bismillah toggle (`isBismillahActive`), Cloudinary asset URLs & public IDs.
- **`Certificate`**: Issued certificate metadata & verification serial numbers.
- **`Admin`**: List of authorized admin emails and system permissions.
- **`Blog` / `Category` / `Tag`**: Articles, reviews, categories, and tags.
- **`GalleryImage` & `TeamMember`**: Media gallery and executive committee metadata.

---

## 📁 Directory Architecture

```
regiser-event-server/
├── src/
│   ├── config/
│   │   ├── auth.ts                   # Better Auth setup & MongoDB adapter
│   │   └── cloudinary.ts             # Cloudinary client & Multer memory storage
│   ├── models/
│   │   ├── Admin.ts                  # Admin privileges collection
│   │   ├── Blog.ts                   # Article & news schema
│   │   ├── Category.ts               # Blog categories schema
│   │   ├── Certificate.ts            # Issued certificates schema
│   │   ├── GalleryImage.ts           # Photo gallery schema
│   │   ├── Registration.ts           # Participant registrations schema
│   │   ├── Settings.ts               # Singleton CMS settings schema
│   │   ├── Tag.ts                    # Article tags schema
│   │   ├── TeamMember.ts             # Executive committee schema
│   │   └── User.ts                   # Core user schema
│   ├── routes/
│   │   ├── admin.ts                  # Administrative management endpoints
│   │   ├── blog.ts                   # News & article endpoints
│   │   ├── registration.ts           # Enrollment & verification endpoints
│   │   ├── settings.ts               # Public configuration endpoints
│   │   └── user.ts                   # User profile endpoints
│   └── index.ts                      # Express app entry point & CORS configuration
├── vercel.json                       # Vercel deployment rewrite rules
├── tsconfig.json                     # TypeScript compiler configuration
└── package.json
```

---

## ⚙️ Environment Configuration

Create a `.env` file in `regiser-event-server`:

```env
# Application Port
PORT=5000

# Database Connection String
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/talamij

# Service Origins
API_URL=http://localhost:5000
CLIENT_URL=http://localhost:3000

# Cloudinary Storage Credentials
CLOUDINARY_CLOUD_NAME=dqw92ity5
CLOUDINARY_API_KEY=893331286853798
CLOUDINARY_API_SECRET=AzzQh46N8yaxh_iqb_Zjv2h7KwI

# Secret Token Key
BETTER_AUTH_SECRET=cNfAnj5cFDfrfy85ib3ExCFojrlnBCfq
```

---

## 💻 Installation & Local Setup

```bash
# 1. Clone repository
git clone https://github.com/your-username/talamij-event-platform.git
cd talamij/regiser-event-server

# 2. Install dependencies
npm install

# 3. Start development mode with tsx watch
npm run dev

# 4. Compile TypeScript for production
npm run build
npm run start
```

---

## 🎙️ Technical Interview Presentation Talking Points

When asked about the backend architecture during a Senior Backend Engineer interview, highlight:

1. **Singleton Configuration Schema**:
   > *"Instead of query-heavy key-value settings tables, I implemented a Singleton Document pattern in MongoDB Mongoose (`Settings.findOne({})`). This delivers atomic, instant settings retrieval across the REST API."*

2. **Automated Cloud Garbage Collection**:
   > *"I engineered a cloud storage pipeline integrating Multer streaming and Cloudinary SDK. Updating brand assets (watermarks, logos, signature images) automatically triggers Cloudinary API destruction of the overwritten asset's `public_id`, keeping cloud storage clean."*

3. **Multi-Tenant CORS & Proxy Compatibility**:
   > *"The Express server's CORS layer dynamically inspects incoming headers to allow credentials while supporting Vercel preview domains (`*.vercel.app`) alongside strict production origins."*

---

<div align="center">
  <sub>Built with ❤️ for Talamij Event Management Platform. Scalable, Secure REST Architecture.</sub>
</div>
