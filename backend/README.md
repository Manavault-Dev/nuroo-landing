# Nuroo Backend API

Fastify backend API for the B2B Specialist Platform.

## Architecture

- **Framework**: Fastify (TypeScript)
- **Auth**: Firebase ID Token verification
- **Database**: Firebase Firestore (via Admin SDK)
- **Validation**: Zod

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in your Firebase Admin credentials:

```bash
cp .env.example .env
```

**Get Firebase Admin Credentials:**

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (`nuroo-2`)
3. Go to Project Settings > Service Accounts
4. Click "Generate New Private Key"
5. Download the JSON file
6. Extract values:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep the newlines, wrap in quotes)

**Important**: The private key should include `\n` characters for newlines. Wrap the entire key in quotes in your `.env` file.

### 3. Run Development Server

```bash
npm run dev
```

Server will start on `http://localhost:3001`

## API Endpoints

All endpoints require authentication via Firebase ID token in `Authorization: Bearer <token>` header (except `/health`).

### Health Check

- `GET /health` - Health check (no auth required)

### Authentication

- `GET /me` - Get current specialist profile and organizations

### Children

- `GET /orgs/:orgId/children` - List children in organization
- `GET /orgs/:orgId/children/:childId` - Get child detail
- `GET /orgs/:orgId/children/:childId/notes` - List notes for a child
- `POST /orgs/:orgId/children/:childId/notes` - Create a note

## Development

### Local Development

Run backend and frontend separately:

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend (from root)
npm run dev
```

### Project Structure

```
backend/
├── src/
│   ├── index.ts           # Server entry point
│   ├── config/            # Environment config (index.ts, env.ts)
│   ├── firebaseAdmin.ts   # Firebase Admin (scripts)
│   ├── types.ts           # TypeScript types
│   ├── plugins/
│   │   ├── auth.ts        # Auth plugin (token verification)
│   │   └── rbac.ts        # RBAC helpers
│   └── routes/
│       ├── health.ts      # Health check
│       ├── me.ts          # Profile endpoint
│       ├── children.ts    # Children endpoints
│       └── notes.ts       # Notes endpoints
├── package.json
├── tsconfig.json
└── README.md
```

## Firestore Structure

The backend reads/writes to these Firestore collections:

```
organizations/{orgId}
  └── members/{uid}          # { role: 'admin'|'specialist', status: 'active'|'inactive' }
  └── children/{childId}     # { assigned: true }

specialists/{uid}            # Specialist profile

children/{childId}
  └── progress/speech        # Speech progress
  └── tasks/{taskId}         # Tasks
  └── specialistNotes/{noteId}  # Specialist notes
```

## Security

- All endpoints (except `/health`) require Firebase ID token authentication
- RBAC: Specialists can only access children assigned to their organizations
- Child assignment is verified before access
- Never trust client-provided `orgId` or `childId` without server-side verification

## Notes

- The backend uses Firebase Admin SDK (server-side) to access Firestore
- Client-side (Next.js B2B UI) uses Firebase Client SDK only for authentication
- All data operations go through the backend API
