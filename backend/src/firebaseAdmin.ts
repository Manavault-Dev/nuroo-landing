import admin from 'firebase-admin'
import { config } from './config.js'

function getAdminApp(): admin.app.App {
  if (!admin.apps.length) {
    const {
      FIREBASE_PROJECT_ID,
      FIREBASE_CLIENT_EMAIL,
      FIREBASE_PRIVATE_KEY,
      FIREBASE_STORAGE_BUCKET,
    } = config

    const storageBucket =
      FIREBASE_STORAGE_BUCKET ||
      (FIREBASE_PROJECT_ID ? `${FIREBASE_PROJECT_ID}.appspot.com` : undefined)

    if (FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY && FIREBASE_PROJECT_ID) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL,
          privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
        projectId: FIREBASE_PROJECT_ID,
        storageBucket,
      })
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: FIREBASE_PROJECT_ID,
        storageBucket,
      })
    }
  }
  return admin.app()
}
