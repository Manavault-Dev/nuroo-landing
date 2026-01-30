/**
 * Script to set Super Admin custom claim for a user
 *
 * Usage:
 *   npm run set-super-admin <email>
 *
 * Or with ts-node:
 *   npx ts-node scripts/setSuperAdmin.ts <email>
 */

import { initializeFirebaseAdmin, getAuth } from '../src/firebaseAdmin.js'

async function setSuperAdmin(email: string) {
  try {
    console.log(`🔍 Looking up user with email: ${email}`)

    const auth = getAuth()
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
    }
    process.exit(1)
  }
}

// Get email from command line args
const email = process.argv[2]

if (!email) {
  console.error('❌ Usage: npm run set-super-admin <email>')
  console.error('   Example: npm run set-super-admin admin@example.com')
  process.exit(1)
}

// Initialize Firebase Admin and run
initializeFirebaseAdmin()
setSuperAdmin(email)
