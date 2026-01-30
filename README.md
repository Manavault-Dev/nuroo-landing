<p align="center">
  <img src="public/logo.png" alt="Nuroo Logo" width="120" height="120" />
</p>

<h1 align="center">Nuroo Platform</h1>

<p align="center">
  <strong>AI-powered autism support platform connecting specialists, organizations, and parents</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#project-structure">Project Structure</a> •
  <a href="#api-reference">API Reference</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.5-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Fastify-4.24-black?style=flat-square&logo=fastify" alt="Fastify" />
  <img src="https://img.shields.io/badge/Firebase-Admin-orange?style=flat-square&logo=firebase" alt="Firebase" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=flat-square&logo=tailwind-css" alt="TailwindCSS" />
</p>

---

## Overview

Nuroo is a comprehensive platform designed to support children with autism and their families. The platform connects:

- **Specialists** (speech therapists, behavioral analysts, educators)
- **Organizations** (clinics, kindergartens, therapy centers)
- **Parents** (via mobile app - separate repository)

This repository contains the **B2B Web Platform** and **Backend API**.

## Features

### B2B Web Platform

- **Organization Management** - Create and manage organizations, invite team members
- **Child Progress Tracking** - View detailed progress, activity timelines, and milestones
- **Specialist Notes** - Add notes with parent visibility controls
- **Parent Connections** - Generate invite codes, view connected parents
- **Group Management** - Organize parents into groups for batch communication
- **Content Management** - Manage tasks, roadmaps, and educational materials (Super Admin)

### Backend API

- **Authentication** - Firebase Auth integration with custom claims
- **Role-Based Access Control** - Super Admin, Org Admin, Specialist roles
- **Parent API** - Endpoints for mobile app integration
- **Real-time Data Sync** - Firestore-powered data synchronization

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Nuroo Platform                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │   Landing Page  │    │  B2B Dashboard  │    │ Mobile App  │ │
│  │   (Next.js)     │    │   (Next.js)     │    │ (Expo RN)   │ │
│  └────────┬────────┘    └────────┬────────┘    └──────┬──────┘ │
│           │                      │                     │        │
│           └──────────────────────┼─────────────────────┘        │
│                                  │                              │
│                         ┌────────▼────────┐                     │
│                         │  Backend API    │                     │
│                         │   (Fastify)     │                     │
│                         └────────┬────────┘                     │
│                                  │                              │
│                         ┌────────▼────────┐                     │
│                         │    Firebase     │                     │
│                         │  Auth + Firestore                     │
│                         └─────────────────┘                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

### Frontend (Next.js)

| Technology   | Version | Purpose                         |
| ------------ | ------- | ------------------------------- |
| Next.js      | 14.2    | React framework with App Router |
| TypeScript   | 5.5     | Type safety                     |
| TailwindCSS  | 3.4     | Utility-first styling           |
| Firebase     | 10.x    | Client-side authentication      |
| Lucide React | -       | Icon library                    |

### Backend (Fastify)

| Technology     | Version | Purpose                         |
| -------------- | ------- | ------------------------------- |
| Fastify        | 4.24    | High-performance web framework  |
| Firebase Admin | 12.x    | Server-side Firebase operations |
| Zod            | 3.22    | Schema validation               |
| TypeScript     | 5.5     | Type safety                     |

### Infrastructure

| Service         | Purpose             |
| --------------- | ------------------- |
| Firebase Auth   | User authentication |
| Cloud Firestore | NoSQL database      |
| Vercel          | Frontend hosting    |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Firebase project with Firestore and Authentication enabled

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/manavault/nuroo-landing.git
   cd nuroo-landing
   ```

2. **Install frontend dependencies**

   ```bash
   npm install
   ```

3. **Install backend dependencies**

   ```bash
   cd backend
   npm install
   cd ..
   ```

4. **Configure environment variables**

   Create `.env.local` in root:

   ```env
   # Firebase Client Config
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

   # API URL
   NEXT_PUBLIC_API_URL=http://127.0.0.1:3001
   ```

   Create `.env` in `backend/`:

   ```env
   # Server
   PORT=3001
   NODE_ENV=development

   # Firebase Admin
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_CLIENT_EMAIL=your_service_account_email
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

   # Security
   BOOTSTRAP_SECRET_KEY=your_secret_key_for_first_super_admin
   ```

5. **Start development servers**

   Terminal 1 - Backend:

   ```bash
   cd backend
   npm run dev
   ```

   Terminal 2 - Frontend:

   ```bash
   npm run dev
   ```

6. **Open the application**
   - Landing page: [http://localhost:3000](http://localhost:3000)
   - B2B Dashboard: [http://localhost:3000/b2b](http://localhost:3000/b2b)

## Project Structure

```
nuroo-landing/
├── app/                      # Next.js App Router
│   ├── (b2b)/               # B2B dashboard routes
│   │   └── b2b/
│   │       ├── admin/       # Super Admin pages
│   │       ├── children/    # Child management
│   │       ├── invites/     # Invite management
│   │       ├── login/       # Authentication
│   │       ├── register/    # Registration
│   │       ├── settings/    # Org settings
│   │       └── team/        # Team management
│   ├── api/                 # API routes (if any)
│   ├── privacy/             # Privacy policy
│   └── help/                # Help pages
│
├── backend/                  # Fastify Backend
│   └── src/
│       ├── config/          # Configuration
│       ├── infrastructure/  # Database, auth, middleware
│       │   ├── auth/        # Authentication logic
│       │   ├── database/    # Firestore collections
│       │   └── middleware/  # Request handlers
│       ├── modules/         # Feature modules
│       │   ├── admin/       # Super Admin operations
│       │   ├── assignments/ # Task assignments
│       │   ├── children/    # Child management
│       │   ├── health/      # Health checks
│       │   ├── invites/     # Invite system
│       │   ├── notes/       # Specialist notes
│       │   ├── organizations/
│       │   ├── parent-api/  # Mobile app API
│       │   ├── parents/     # Parent management
│       │   ├── team/        # Team management
│       │   └── users/       # User profiles
│       ├── shared/          # Shared utilities
│       │   ├── guards/      # Route guards
│       │   ├── types/       # TypeScript types
│       │   └── utils/       # Utility functions
│       ├── app.ts           # Fastify app setup
│       └── server.ts        # Server entry point
│
├── components/              # React components
│   └── b2b/                # B2B-specific components
│
├── lib/                     # Shared libraries
│   ├── b2b/                # B2B utilities (API client, auth)
│   └── firebase/           # Firebase configuration
│
├── public/                  # Static assets
└── types/                   # Global TypeScript types
```

## API Reference

### Authentication

All API endpoints require Firebase ID token in Authorization header:

```
Authorization: Bearer <firebase_id_token>
```

### Key Endpoints

#### Specialist Endpoints

| Method | Endpoint                               | Description                   |
| ------ | -------------------------------------- | ----------------------------- |
| GET    | `/me`                                  | Get current user profile      |
| POST   | `/me`                                  | Create specialist profile     |
| GET    | `/orgs/:orgId/children`                | List children in organization |
| GET    | `/orgs/:orgId/children/:childId`       | Get child details             |
| POST   | `/orgs/:orgId/children/:childId/notes` | Create note                   |
| POST   | `/orgs/:orgId/parent-invites`          | Generate parent invite code   |

#### Parent API (Mobile App)

| Method | Endpoint                              | Description               |
| ------ | ------------------------------------- | ------------------------- |
| POST   | `/api/org/parent-invites/validate`    | Validate invite code      |
| POST   | `/api/org/parent-invites/accept`      | Accept invite, link child |
| GET    | `/api/parent/organizations`           | Get linked organizations  |
| GET    | `/api/parent/children/:childId/notes` | Get specialist notes      |

#### Admin Endpoints

| Method | Endpoint               | Description            |
| ------ | ---------------------- | ---------------------- |
| GET    | `/admin/organizations` | List all organizations |
| POST   | `/admin/organizations` | Create organization    |
| POST   | `/admin/invites`       | Generate invite code   |
| GET    | `/admin/super-admin`   | List super admins      |

## Database Schema

### Collections

```
├── organizations/{orgId}
│   ├── members/{uid}        # Organization members
│   ├── children/{childId}   # Linked children
│   ├── parents/{parentId}   # Parent contacts
│   └── groups/{groupId}     # Parent groups
│
├── specialists/{uid}        # Specialist profiles
│
├── parents/{parentUid}      # Authenticated parents (mobile app)
│
├── children/{childId}
│   ├── specialistNotes/{noteId}
│   ├── tasks/{taskId}
│   ├── progress/speech
│   └── feedback/{feedbackId}
│
├── invites/{code}           # General invites
├── orgInvites/{code}        # Organization membership invites
└── parentInvites/{code}     # Parent invite codes
```

## Scripts

### Frontend

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Backend

```bash
npm run dev      # Start with hot reload
npm run build    # Compile TypeScript
npm run start    # Start production server
npm run typecheck # Type checking only
```

## Environment Variables

### Frontend (.env.local)

| Variable                 | Required | Description                       |
| ------------------------ | -------- | --------------------------------- |
| `NEXT_PUBLIC_FIREBASE_*` | Yes      | Firebase client configuration     |
| `NEXT_PUBLIC_API_URL`    | Yes      | Backend API URL                   |
| `NEXT_PUBLIC_B2B_URL`    | No       | B2B platform URL for invite links |

### Backend (.env)

| Variable                | Required | Description                          |
| ----------------------- | -------- | ------------------------------------ |
| `PORT`                  | No       | Server port (default: 3001)          |
| `NODE_ENV`              | No       | Environment (development/production) |
| `FIREBASE_PROJECT_ID`   | Yes      | Firebase project ID                  |
| `FIREBASE_CLIENT_EMAIL` | Yes      | Service account email                |
| `FIREBASE_PRIVATE_KEY`  | Yes      | Service account private key          |
| `BOOTSTRAP_SECRET_KEY`  | Yes      | Key for creating first Super Admin   |

## Deployment

### Frontend (Vercel)

1. Connect repository to Vercel
2. Set environment variables
3. Deploy

### Backend

1. Build: `npm run build`
2. Set environment variables
3. Start: `npm run start`

Recommended: Deploy on Google Cloud Run, AWS ECS, or similar container service.

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Code Style

- Use TypeScript strict mode
- Follow ESLint configuration
- Use conventional commits

## Related Repositories

- **[nuroo-app](https://github.com/manavault/nuroo-app)** - Mobile app for parents (Expo/React Native)

## License

This project is proprietary software. All rights reserved.

---

<p align="center">
  Built with ❤️ by <a href="https://manavault.com">Manavault</a>
</p>
