import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  UserCredential
} from 'firebase/auth'
import { auth } from '@/lib/firebase/config'

export async function signIn(email: string, password: string): Promise<UserCredential> {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized. Please configure Firebase in .env.local')
  }
  const authInstance = auth
  return signInWithEmailAndPassword(authInstance, email, password)
}

export async function register(
  email: string,
  password: string,
  name: string
): Promise<UserCredential> {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized. Please configure Firebase in .env.local')
  }
  const authInstance = auth
  return createUserWithEmailAndPassword(authInstance, email, password)
}

export async function signOut(): Promise<void> {
  if (!auth) {
    return
  }
  const authInstance = auth
  return firebaseSignOut(authInstance)
}

export function getCurrentUser(): User | null {
  return auth?.currentUser || null
}

export async function getIdToken(forceRefresh = false): Promise<string | null> {
  if (!auth) {
    return null
  }
  const user = auth.currentUser
  if (!user) return null
  return user.getIdToken(forceRefresh)
}

export function onAuthChange(callback: (user: User | null) => void) {
  if (!auth) {
    callback(null)
    return () => {}
  }
  const authInstance = auth
  return onAuthStateChanged(authInstance, callback)
}
