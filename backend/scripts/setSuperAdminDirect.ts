/**
 * Simple script to set Super Admin claim
 * Run this directly with Node.js (not through npm script)
 *
 * Usage:
 *   node scripts/setSuperAdminDirect.js nuroo@gmail.com
 *
 * Or with tsx:
 *   npx tsx scripts/setSuperAdminDirect.ts nuroo@gmail.com
 */

import admin from 'firebase-admin'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env from backend directory
dotenv.config({ path: path.join(__dirname, '../.env') })

const email = process.argv[2]

if (!email) {
  console.error('❌ Usage: node setSuperAdminDirect.js <email>')
  console.error('   Example: node setSuperAdminDirect.js nuroo@gmail.com')
  process.exit(1)
}

async function setSuperAdmin() {
  try {
    // Initialize Firebase Admin
    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

    if (!projectId || !clientEmail || !privateKey) {
      console.error('❌ Firebase Admin credentials not found in .env file')
      console.error(
        '   Make sure you have FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY set'
      )
      process.exit(1)
    }

    // Initialize app if not already initialized
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
      })
      console.log('✅ Firebase Admin initialized')
    }

    const auth = admin.auth()

    console.log(`🔍 Looking up user with email: ${email}`)
    const user = await auth.getUserByEmail(email)

    console.log(`✅ Found user: ${user.uid} (${user.email})`)

    // Set custom claim
    await auth.setCustomUserClaims(user.uid, { superAdmin: true })

    console.log(`✅ Super Admin claim set for ${email}`)
    console.log(`\n📝 Important:`)
    console.log(`   - User must refresh their ID token for the claim to take effect`)
    console.log(`   - User should sign out and sign in again`)
    console.log(`   - Or call user.getIdToken(true) to force refresh`)

    process.exit(0)
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    if (error.code === 'auth/user-not-found') {
      console.error(`   User with email ${email} not found`)
      console.error(`   Make sure the user is registered first`)
    } else if (
      error.code === 'auth/internal-error' ||
      error.message?.includes('PERMISSION_DENIED')
    ) {
      console.error(`\n⚠️  Permission error detected.`)
      console.error(`   The service account needs additional permissions.`)
      console.error(`   Try using Firebase Console instead:`)
      console.error(
        `   1. Go to: https://console.firebase.google.com/project/${process.env.FIREBASE_PROJECT_ID}/authentication/users`
      )
      console.error(`   2. Find user ${email}`)
      console.error(`   3. Click three dots → Edit → Custom claims`)
      console.error(`   4. Add: superAdmin = true`)
    }
    process.exit(1)
  }
}

setSuperAdmin()
