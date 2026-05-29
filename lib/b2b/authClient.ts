import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  onIdTokenChanged,
  GoogleAuthProvider,
  signInWithPopup,
  User,
  UserCredential,
} from 'firebase/auth'
import { auth } from '@/lib/firebase/config'
import { apiClient } from './api'

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
  _name: string
): Promise<UserCredential> {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized. Please configure Firebase in .env.local')
  }
  const authInstance = auth
  return createUserWithEmailAndPassword(authInstance, email, password)
}

export async function signInWithGoogle(): Promise<UserCredential> {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized. Please configure Firebase in .env.local')
  }
  const provider = new GoogleAuthProvider()
  provider.addScope('email')
  provider.addScope('profile')
  // Force account selection so users can switch accounts
  provider.setCustomParameters({ prompt: 'select_account' })
  return signInWithPopup(auth, provider)
}

export async function signOut(): Promise<void> {
  if (!auth) {
    return
  }
  const authInstance = auth
  await firebaseSignOut(authInstance)
  // Clear token from localStorage
  apiClient.setToken(null)
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
    return () => {
      /* noop unsubscribe when auth is null */
    }
  }
  const authInstance = auth
  return onAuthStateChanged(authInstance, callback)
}

export function onTokenRefresh(callback: (token: string | null) => void): () => void {
  if (!auth) {
    callback(null)
    return () => {
      /* noop */
    }
  }
  return onIdTokenChanged(auth, async (user) => {
    const token = user ? await user.getIdToken() : null
    callback(token)
  })
}
