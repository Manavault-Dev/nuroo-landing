'use client'

import { useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useAuth } from '@/lib/b2b/AuthContext'
import { db as _db } from '@/lib/firebase/config'
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore'

// db is undefined during SSR — all usage is client-only (guarded by useEffect)
const db = _db as Firestore
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Power,
  Save,
  Shield,
  Smartphone,
  Wrench,
} from 'lucide-react'

interface MaintenanceConfig {
  enabled: boolean
  title: string
  message: string
  estimatedEnd: string | null
  platforms: string[] | 'all'
  bypassUids: string[]
}

interface ForceUpdatePlatform {
  minVersion: string
  storeUrl: string
}

interface FeatureFlags {
  booking: boolean
  aiTasks: boolean
  cohorts: boolean
  courses: boolean
  calendarSync: boolean
  billing: boolean
  askNuroo: boolean
  progressTracking: boolean
}

interface AppRemoteConfig {
  maintenance: MaintenanceConfig
  forceUpdate: { ios: ForceUpdatePlatform; android: ForceUpdatePlatform }
  features: FeatureFlags
  _updatedAt: unknown
  _updatedBy: string | null
}

const DEFAULT_CONFIG: AppRemoteConfig = {
  maintenance: {
    enabled: false,
    title: 'Технические работы',
    message: 'Мы проводим плановое обслуживание. Скоро вернёмся.',
    estimatedEnd: null,
    platforms: 'all',
    bypassUids: [],
  },
  forceUpdate: {
    ios: { minVersion: '0.0.0', storeUrl: 'https://apps.apple.com/' },
    android: { minVersion: '0.0.0', storeUrl: 'https://play.google.com/' },
  },
  features: {
    booking: true,
    aiTasks: true,
    cohorts: true,
    courses: true,
    calendarSync: true,
    billing: true,
    askNuroo: true,
    progressTracking: true,
  },
  _updatedAt: null,
  _updatedBy: null,
}

const FEATURE_LABELS: Record<keyof FeatureFlags, string> = {
  booking: 'Запись / Booking',
  aiTasks: 'AI-задания',
  cohorts: 'Группы / Наборы',
  courses: 'Маркетплейс курсов',
  calendarSync: 'Google Calendar',
  billing: 'Биллинг',
  askNuroo: 'Чат «Спроси Нуру»',
  progressTracking: 'Отслеживание прогресса',
}

// ─── Confirm dialog ──────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

function ConfirmDialog({
  open,
  title,
  description,
  onConfirm,
  onCancel,
  danger,
}: ConfirmDialogProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle
            className={`w-6 h-6 shrink-0 mt-0.5 ${danger ? 'text-red-500' : 'text-amber-500'}`}
          />
          <div>
            <p className="font-semibold text-gray-900 text-base">{title}</p>
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}
          >
            Подтвердить
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function SystemAppControlPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [checking, setChecking] = useState(true)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [config, setConfig] = useState<AppRemoteConfig>(DEFAULT_CONFIG)
  const [draft, setDraft] = useState<AppRemoteConfig>(DEFAULT_CONFIG)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const [confirmProps, setConfirmProps] = useState({ title: '', description: '', danger: false })

  // ── Check platform admin role ────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    void (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid))
        const data = snap.data() as Record<string, unknown> | undefined
        if (data?.platformRole === 'platform_admin') {
          setIsPlatformAdmin(true)
        } else {
          router.replace('/b2b')
        }
      } catch {
        router.replace('/b2b')
      } finally {
        setChecking(false)
      }
    })()
  }, [user, router])

  // ── Subscribe to config ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlatformAdmin) return
    const unsub = onSnapshot(doc(db, 'system', 'appConfig'), (snap) => {
      if (snap.exists()) {
        const raw = snap.data() as Partial<AppRemoteConfig>
        const merged: AppRemoteConfig = {
          ...DEFAULT_CONFIG,
          ...raw,
          maintenance: {
            ...DEFAULT_CONFIG.maintenance,
            ...raw.maintenance,
            bypassUids: Array.isArray(raw.maintenance?.bypassUids)
              ? raw.maintenance.bypassUids
              : [],
            platforms: raw.maintenance?.platforms ?? 'all',
          },
          forceUpdate: {
            ios: { ...DEFAULT_CONFIG.forceUpdate.ios, ...raw.forceUpdate?.ios },
            android: { ...DEFAULT_CONFIG.forceUpdate.android, ...raw.forceUpdate?.android },
          },
          features: { ...DEFAULT_CONFIG.features, ...raw.features },
        }
        setConfig(merged)
        setDraft(merged)
      }
    })
    return unsub
  }, [isPlatformAdmin])

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      await setDoc(doc(db, 'system', 'appConfig'), {
        ...draft,
        _updatedAt: serverTimestamp(),
        _updatedBy: user?.uid ?? null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setSaveError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const confirmAndSave = () => {
    if (draft.maintenance.enabled && !config.maintenance.enabled) {
      setConfirmProps({
        title: 'Включить режим обслуживания?',
        description:
          'Все пользователи увидят экран «Технические работы». Байпас-UIDs сохранят доступ.',
        danger: true,
      })
      setPendingAction(() => handleSave)
      setConfirmOpen(true)
    } else {
      void handleSave()
    }
  }

  const setDraftField = <K extends keyof AppRemoteConfig>(key: K, value: AppRemoteConfig[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  if (checking || !user) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!isPlatformAdmin) return null

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <ConfirmDialog
        open={confirmOpen}
        {...confirmProps}
        onConfirm={() => {
          setConfirmOpen(false)
          pendingAction?.()
        }}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
            <Shield className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">System / App Control</h1>
            <p className="text-sm text-gray-500">Управление приложением в реальном времени</p>
          </div>
        </div>

        <button
          onClick={confirmAndSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </div>

      {saved && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4" />
          Изменения сохранены и применяются в реальном времени
        </div>
      )}

      {saveError && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4" />
          {saveError}
        </div>
      )}

      {/* ── Maintenance Mode ─────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-gray-500" />
            <h2 className="font-semibold text-gray-900">Режим обслуживания</h2>
          </div>
          <button
            type="button"
            onClick={() =>
              setDraft((prev) => ({
                ...prev,
                maintenance: { ...prev.maintenance, enabled: !prev.maintenance.enabled },
              }))
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              draft.maintenance.enabled ? 'bg-red-500' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                draft.maintenance.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {draft.maintenance.enabled && (
          <div className="mb-3 flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Режим обслуживания ВКЛЮЧЁН — пользователи видят экран технических работ
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Заголовок</label>
            <input
              type="text"
              value={draft.maintenance.title}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  maintenance: { ...prev.maintenance, title: e.target.value },
                }))
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Сообщение</label>
            <textarea
              rows={3}
              value={draft.maintenance.message}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  maintenance: { ...prev.maintenance, message: e.target.value },
                }))
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Ожидаемое завершение (ISO или пусто)
            </label>
            <input
              type="datetime-local"
              value={draft.maintenance.estimatedEnd?.slice(0, 16) ?? ''}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  maintenance: {
                    ...prev.maintenance,
                    estimatedEnd: e.target.value ? new Date(e.target.value).toISOString() : null,
                  },
                }))
              }
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Платформы (через запятую: ios, android, web — или &quot;all&quot;)
            </label>
            <input
              type="text"
              value={
                draft.maintenance.platforms === 'all'
                  ? 'all'
                  : draft.maintenance.platforms.join(', ')
              }
              onChange={(e) => {
                const val = e.target.value.trim()
                setDraft((prev) => ({
                  ...prev,
                  maintenance: {
                    ...prev.maintenance,
                    platforms:
                      val === 'all'
                        ? 'all'
                        : (val
                            .split(',')
                            .map((p) => p.trim())
                            .filter(Boolean) as string[]),
                  },
                }))
              }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Bypass UIDs (через запятую — эти пользователи видят приложение)
            </label>
            <textarea
              rows={2}
              value={(draft.maintenance.bypassUids ?? []).join(', ')}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  maintenance: {
                    ...prev.maintenance,
                    bypassUids: e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                }))
              }
              placeholder="uid1, uid2, ..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
            />
          </div>
        </div>
      </section>

      {/* ── Force Update ──────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Smartphone className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900">Принудительное обновление</h2>
        </div>

        {(['ios', 'android'] as const).map((platform) => (
          <div key={platform} className="mb-4 last:mb-0">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {platform === 'ios' ? '🍎 iOS' : '🤖 Android'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Min version (semver)
                </label>
                <input
                  type="text"
                  placeholder="1.0.0"
                  value={draft.forceUpdate[platform].minVersion}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      forceUpdate: {
                        ...prev.forceUpdate,
                        [platform]: { ...prev.forceUpdate[platform], minVersion: e.target.value },
                      },
                    }))
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Store URL</label>
                <input
                  type="url"
                  value={draft.forceUpdate[platform].storeUrl}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      forceUpdate: {
                        ...prev.forceUpdate,
                        [platform]: { ...prev.forceUpdate[platform], storeUrl: e.target.value },
                      },
                    }))
                  }
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                />
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* ── Feature Flags ─────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Power className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900">Feature Flags</h2>
        </div>

        <div className="divide-y divide-gray-100">
          {(Object.keys(FEATURE_LABELS) as Array<keyof FeatureFlags>).map((flag) => (
            <div key={flag} className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-700">{FEATURE_LABELS[flag]}</span>
              <button
                type="button"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    features: { ...prev.features, [flag]: !prev.features[flag] },
                  }))
                }
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  draft.features[flag] ? 'bg-green-500' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    draft.features[flag] ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
