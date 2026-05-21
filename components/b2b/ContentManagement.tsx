'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiClient } from '@/lib/b2b/api'
import { useAlert } from '@/components/ui/AlertDialog'
import {
  Plus,
  BookOpen,
  CheckSquare,
  Trash2,
  Edit2,
  Loader2,
  X,
  ChevronUp,
  ChevronDown,
  Users2,
  Calendar,
  Check,
} from 'lucide-react'
import { AIInstructionHelper } from './AIInstructionHelper'

export type ContentManagementMode = 'global' | 'org'

type ContentType = 'tasks' | 'roadmaps'

interface ContentManagementProps {
  mode: ContentManagementMode
  orgId?: string
  pageTitle?: string
  pageSubtitle?: string
}

interface ContentItem {
  id: string
  title?: string
  name?: string
  description?: string
  category?: string
  ageRange?: { min: number; max: number }
  difficulty?: 'easy' | 'medium' | 'hard'
  estimatedDuration?: number
  materials?: string[]
  instructions?: string[]
  videoUrl?: string
  imageUrl?: string
  thumbnailUrl?: string
  duration?: number
  type?: 'article' | 'video' | 'pdf' | 'image' | 'other'
  content?: string
  url?: string
  tags?: string[]
  steps?: Array<{ order: number; taskId?: string; title: string; description?: string }>
  taskIds?: string[]
  createdAt?: string
  updatedAt?: string
}

interface OrgGroup {
  id: string
  name: string
  color: string
}

export function ContentManagement({
  mode,
  orgId,
  pageTitle,
  pageSubtitle,
}: ContentManagementProps) {
  const t = useTranslations('b2b.pages.assignments')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ContentType>('tasks')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null)
  const [saving, setSaving] = useState(false)

  const [tasks, setTasks] = useState<ContentItem[]>([])
  const [roadmaps, setRoadmaps] = useState<ContentItem[]>([])

  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [taskSelectValue, setTaskSelectValue] = useState('')

  // Split-panel state (org mode tasks tab)
  const [selectedTask, setSelectedTask] = useState<ContentItem | null>(null)
  const [orgGroups, setOrgGroups] = useState<OrgGroup[]>([])
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set())
  const [assignDueDate, setAssignDueDate] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [assignSuccess, setAssignSuccess] = useState(false)
  const [loadingGroups, setLoadingGroups] = useState(false)
  const { alert, confirm } = useAlert()

  const loadContent = async () => {
    try {
      if (mode === 'global') {
        const [tasksData, roadmapsData] = await Promise.all([
          apiClient.getTasks(),
          apiClient.getRoadmaps(),
        ])
        setTasks(tasksData.tasks || [])
        setRoadmaps(roadmapsData.roadmaps || [])
      } else if (mode === 'org' && orgId) {
        const [tasksRes, roadmapsRes] = await Promise.all([
          apiClient.getOrgContentTasks(orgId),
          apiClient.getOrgContentRoadmaps(orgId),
        ])
        setTasks(tasksRes.tasks || [])
        setRoadmaps(roadmapsRes.roadmaps || [])
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('loadError')
      alert(errorMessage, { type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (mode === 'global' || (mode === 'org' && orgId)) {
      setLoading(true)
      loadContent()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, orgId])

  // Load org groups once for the assignment panel
  useEffect(() => {
    if (mode !== 'org' || !orgId) return
    setLoadingGroups(true)
    apiClient
      .getGroups(orgId)
      .then((res) => setOrgGroups(res.groups || []))
      .catch(() => setOrgGroups([]))
      .finally(() => setLoadingGroups(false))
  }, [mode, orgId])

  const handleCreate = () => {
    setEditingItem(null)
    setFormData({ taskIds: [] })
    setMediaFile(null)
    setUploadProgress(0)
    setTaskSelectValue('')
    setIsModalOpen(true)
  }

  const handleEdit = (item: ContentItem) => {
    setEditingItem(item)
    const editData: Record<string, unknown> = { ...item }
    if (!editData.taskIds && item.steps) {
      editData.taskIds = item.steps.filter((s) => s.taskId).map((s) => s.taskId!)
    }
    if (!editData.taskIds) editData.taskIds = []
    setIsModalOpen(true)
    setFormData(editData)
    setMediaFile(null)
    setUploadProgress(0)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingItem(null)
    setFormData({})
    setMediaFile(null)
    setUploadProgress(0)
    setTaskSelectValue('')
  }

  const requireMediaForNewTask =
    mode === 'global' &&
    activeTab === 'tasks' &&
    !mediaFile &&
    !editingItem &&
    !formData.videoUrl &&
    !formData.imageUrl

  const handleSave = async () => {
    if (activeTab === 'roadmaps' && !formData.name) {
      alert(t('nameRequired'), { type: 'warning' })
      return
    }
    if (activeTab !== 'roadmaps' && !formData.title) {
      alert(t('titleRequired'), { type: 'warning' })
      return
    }
    if (requireMediaForNewTask) {
      alert(t('mediaRequired'), { type: 'warning' })
      return
    }

    setSaving(true)
    try {
      if (mode === 'org' && orgId) {
        if (editingItem) {
          if (activeTab === 'tasks') {
            await apiClient.updateOrgContentTask(orgId, editingItem.id, {
              title: (formData.title as string) || '',
              description: (formData.description as string) || undefined,
              category: formData.category as string | undefined,
              difficulty: formData.difficulty as 'easy' | 'medium' | 'hard' | undefined,
              estimatedDuration: formData.estimatedDuration as number | undefined,
              ageRange: formData.ageRange as { min: number; max: number } | undefined,
              instructions: formData.instructions as string[] | undefined,
              videoUrl: (formData.videoUrl as string) || undefined,
              imageUrl: (formData.imageUrl as string) || undefined,
            })
          } else {
            await apiClient.updateOrgContentRoadmap(orgId, editingItem.id, {
              name: (formData.name as string) || '',
              description: (formData.description as string) || undefined,
              taskIds: (formData.taskIds as string[]) || [],
            })
          }
        } else {
          if (activeTab === 'tasks') {
            if (mediaFile) {
              setUploadProgress(10)
              await apiClient.uploadOrgTaskMedia(orgId, mediaFile, {
                title: (formData.title as string) || '',
                description: formData.description as string | undefined,
                category: formData.category as string | undefined,
                difficulty: formData.difficulty as 'easy' | 'medium' | 'hard' | undefined,
                estimatedDuration: formData.estimatedDuration as number | undefined,
                ageRange: formData.ageRange as { min: number; max: number } | undefined,
                instructions: formData.instructions as string[] | undefined,
              })
              setUploadProgress(100)
            } else {
              await apiClient.createOrgContentTask(orgId, {
                title: (formData.title as string) || '',
                description: (formData.description as string) || undefined,
                category: formData.category as string | undefined,
                difficulty: formData.difficulty as 'easy' | 'medium' | 'hard' | undefined,
                estimatedDuration: formData.estimatedDuration as number | undefined,
                ageRange: formData.ageRange as { min: number; max: number } | undefined,
                instructions: formData.instructions as string[] | undefined,
                videoUrl: (formData.videoUrl as string) || undefined,
                imageUrl: (formData.imageUrl as string) || undefined,
              })
            }
          } else {
            await apiClient.createOrgContentRoadmap(orgId, {
              name: (formData.name as string) || '',
              description: (formData.description as string) || undefined,
              taskIds: (formData.taskIds as string[]) || [],
            })
          }
        }
      } else {
        if (editingItem) {
          switch (activeTab) {
            case 'tasks':
              if (mediaFile) {
                setUploadProgress(10)
                await apiClient.uploadTaskMedia(
                  mediaFile,
                  (formData.title as string) || editingItem.title || '',
                  {
                    description: formData.description as string | undefined,
                    category: formData.category as string | undefined,
                    difficulty: formData.difficulty as 'easy' | 'medium' | 'hard' | undefined,
                    estimatedDuration: formData.estimatedDuration as number | undefined,
                    ageRange: formData.ageRange as { min: number; max: number } | undefined,
                    instructions: formData.instructions as string[] | undefined,
                    taskId: editingItem.id,
                  }
                )
                setUploadProgress(100)
              } else if (mode === 'org' && orgId) {
                await apiClient.updateOrgContentTask(
                  orgId,
                  editingItem.id,
                  formData as Record<string, unknown>
                )
              } else {
                await apiClient.updateTask(editingItem.id, formData as Record<string, unknown>)
              }
              break
            case 'roadmaps':
              if (mode === 'org' && orgId) {
                await apiClient.updateOrgContentRoadmap(
                  orgId,
                  editingItem.id,
                  formData as Record<string, unknown>
                )
              } else {
                await apiClient.updateRoadmap(editingItem.id, formData as Record<string, unknown>)
              }
              break
          }
        } else {
          switch (activeTab) {
            case 'tasks':
              if (mediaFile && mode === 'org' && orgId) {
                setUploadProgress(10)
                await apiClient.uploadOrgTaskMedia(orgId, mediaFile, {
                  title: (formData.title as string) || '',
                  description: formData.description as string | undefined,
                  category: formData.category as string | undefined,
                  difficulty: formData.difficulty as 'easy' | 'medium' | 'hard' | undefined,
                  estimatedDuration: formData.estimatedDuration as number | undefined,
                  ageRange: formData.ageRange as { min: number; max: number } | undefined,
                  instructions: formData.instructions as string[] | undefined,
                })
                setUploadProgress(100)
              } else if (mediaFile && mode === 'global') {
                setUploadProgress(10)
                await apiClient.uploadTaskMedia(mediaFile, (formData.title as string) || '', {
                  description: formData.description as string | undefined,
                  category: formData.category as string | undefined,
                  difficulty: formData.difficulty as 'easy' | 'medium' | 'hard' | undefined,
                  estimatedDuration: formData.estimatedDuration as number | undefined,
                  ageRange: formData.ageRange as { min: number; max: number } | undefined,
                  instructions: formData.instructions as string[] | undefined,
                })
                setUploadProgress(100)
              } else if (mode === 'org' && orgId) {
                await apiClient.createOrgContentTask(orgId, formData as Record<string, unknown>)
              } else {
                await apiClient.createTask(formData as Record<string, unknown>)
              }
              break
            case 'roadmaps':
              if (mode === 'org' && orgId) {
                await apiClient.createOrgContentRoadmap(orgId, formData as Record<string, unknown>)
              } else {
                await apiClient.createRoadmap(formData as Record<string, unknown>)
              }
              break
          }
        }
      }

      const wasEditing = !!editingItem
      handleCloseModal()
      await loadContent()
      setTimeout(
        () => alert(wasEditing ? t('updatedSuccess') : t('createdSuccess'), { type: 'success' }),
        300
      )
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('saveError')
      alert(errorMessage, { type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (type: ContentType, id: string) => {
    const confirmed = await confirm(
      t(type === 'tasks' ? 'deleteTaskConfirm' : 'deleteRoadmapConfirm')
    )
    if (!confirmed) return
    try {
      if (mode === 'org' && orgId) {
        if (type === 'tasks') await apiClient.deleteOrgContentTask(orgId, id)
        else await apiClient.deleteOrgContentRoadmap(orgId, id)
      } else {
        if (type === 'tasks') await apiClient.deleteTask(id)
        else await apiClient.deleteRoadmap(id)
      }
      setTasks((prev) => (type === 'tasks' ? prev.filter((t) => t.id !== id) : prev))
      setRoadmaps((prev) => (type === 'roadmaps' ? prev.filter((r) => r.id !== id) : prev))
      if (selectedTask?.id === id) setSelectedTask(null)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('deleteError')
      alert(errorMessage, { type: 'error' })
    }
  }

  const handleAssign = async () => {
    if (!orgId || !selectedTask || selectedGroupIds.size === 0) return
    setAssigning(true)
    setAssignSuccess(false)
    try {
      await Promise.all(
        Array.from(selectedGroupIds).map((groupId) =>
          apiClient.assignGroupTasks(orgId, groupId, [selectedTask.id], assignDueDate || null)
        )
      )
      setAssignSuccess(true)
      setSelectedGroupIds(new Set())
      setAssignDueDate('')
      setTimeout(() => setAssignSuccess(false), 2500)
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : t('assignError'), { type: 'error' })
    } finally {
      setAssigning(false)
    }
  }

  const toggleGroup = (id: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const updateFormField = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const renderForm = () => {
    const isTask = activeTab === 'tasks'
    const isRoadmap = activeTab === 'roadmaps'
    const showMediaUpload = isTask

    return (
      <div className="space-y-4">
        {/* Roadmap name/description fields — tasks use the AI helper instead */}
        {isRoadmap && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('roadmapName')} *
              </label>
              <input
                type="text"
                value={(formData.name as string) || ''}
                onChange={(e) => updateFormField('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder={t('enterRoadmapName')}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('roadmapDescription')}
              </label>
              <textarea
                value={(formData.description as string) || ''}
                onChange={(e) => updateFormField('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder={t('enterDescription')}
              />
            </div>
          </>
        )}

        {/* Task title field — global mode only (org mode uses AI helper below) */}
        {isTask && mode === 'global' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('taskTitle')} *
            </label>
            <input
              type="text"
              value={(formData.title as string) || ''}
              onChange={(e) => updateFormField('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder={t('enterTaskTitle')}
              required
            />
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('taskDescription')}
              </label>
              <textarea
                value={(formData.description as string) || ''}
                onChange={(e) => updateFormField('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder={t('enterDescription')}
              />
            </div>
          </div>
        )}

        {/* AI Instruction Helper — org task mode: title + description are set here */}
        {isTask && mode === 'org' && (
          <AIInstructionHelper
            initialResult={
              editingItem
                ? {
                    title: (formData.title as string) || '',
                    description: (formData.description as string) || '',
                    instructions: (formData.instructions as string[]) || [],
                    parentTip: '',
                    expectedResult: '',
                  }
                : undefined
            }
            context={{
              category: (formData.category as string) || undefined,
              ageMin: (formData.ageRange as { min: number; max: number } | undefined)?.min,
              ageMax: (formData.ageRange as { min: number; max: number } | undefined)?.max,
            }}
            onApply={(result) => {
              updateFormField('title', result.title)
              updateFormField('description', result.description)
              updateFormField('instructions', result.instructions)
            }}
          />
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('category')}</label>
          <input
            type="text"
            value={(formData.category as string) || ''}
            onChange={(e) => updateFormField('category', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder={t('enterCategory')}
          />
        </div>
        {isTask && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('difficulty')}
              </label>
              <select
                value={(formData.difficulty as string) || ''}
                onChange={(e) => updateFormField('difficulty', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">{t('selectDifficulty')}</option>
                <option value="easy">{t('difficultyEasy')}</option>
                <option value="medium">{t('difficultyMedium')}</option>
                <option value="hard">{t('difficultyHard')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('estimatedDuration')}
              </label>
              <input
                type="number"
                value={(formData.estimatedDuration as number) || ''}
                onChange={(e) =>
                  updateFormField('estimatedDuration', parseInt(e.target.value) || undefined)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder={t('enterDuration')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('videoUrl')}
              </label>
              <input
                type="url"
                value={(formData.videoUrl as string) || ''}
                onChange={(e) => updateFormField('videoUrl', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('imageUrl')}
              </label>
              <input
                type="url"
                value={(formData.imageUrl as string) || ''}
                onChange={(e) => updateFormField('imageUrl', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="https://..."
              />
            </div>
            {mode === 'global' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('materials')}
                  </label>
                  <textarea
                    value={(formData.materials as string[])?.join('\n') || ''}
                    onChange={(e) => {
                      const materials = e.target.value
                        .split('\n')
                        .map((m) => m.trim())
                        .filter((m) => m.length > 0)
                      updateFormField('materials', materials.length > 0 ? materials : undefined)
                    }}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder={t('materialsPlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('instructions')}
                  </label>
                  <textarea
                    value={(formData.instructions as string[])?.join('\n') || ''}
                    onChange={(e) => {
                      const instructions = e.target.value
                        .split('\n')
                        .map((i) => i.trim())
                        .filter((i) => i.length > 0)
                      updateFormField(
                        'instructions',
                        instructions.length > 0 ? instructions : undefined
                      )
                    }}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder={t('instructionsPlaceholder')}
                  />
                </div>
              </>
            )}
          </>
        )}
        {isRoadmap && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('tasksInRoadmap')}
              </label>
              <div className="border border-gray-300 rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto bg-gray-50">
                {(formData.taskIds as string[])?.length > 0 ? (
                  <div className="space-y-2">
                    {((formData.taskIds as string[]) || []).map((taskId: string, index: number) => {
                      const task = tasks.find((t) => t.id === taskId)
                      return (
                        <div
                          key={taskId}
                          className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 shadow-sm"
                        >
                          <div className="flex items-center space-x-3 flex-1">
                            <span className="text-sm font-medium text-gray-500 w-8">
                              {index + 1}.
                            </span>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {task?.title || t('unknownTask')}
                              </p>
                              {task?.description && (
                                <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                                  {task.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => {
                                const ids = [...((formData.taskIds as string[]) || [])]
                                if (index > 0) {
                                  ;[ids[index], ids[index - 1]] = [ids[index - 1], ids[index]]
                                  updateFormField('taskIds', ids)
                                }
                              }}
                              disabled={index === 0}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title={t('moveUp')}
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const ids = [...((formData.taskIds as string[]) || [])]
                                if (index < ids.length - 1) {
                                  ;[ids[index], ids[index + 1]] = [ids[index + 1], ids[index]]
                                  updateFormField('taskIds', ids)
                                }
                              }}
                              disabled={index === ((formData.taskIds as string[]) || []).length - 1}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title={t('moveDown')}
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const ids = ((formData.taskIds as string[]) || []).filter(
                                  (id: string) => id !== taskId
                                )
                                updateFormField('taskIds', ids)
                              }}
                              className="p-1 text-red-400 hover:text-red-600"
                              title={t('remove')}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8">{t('noTasksAdded')}</p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('addTaskToRoadmap')}
              </label>
              <select
                value={taskSelectValue}
                onChange={(e) => {
                  const taskId = e.target.value
                  if (!taskId) return
                  setTaskSelectValue('')
                  setFormData((prev) => {
                    const current = (prev.taskIds as string[]) || []
                    if (current.includes(taskId)) return prev
                    return { ...prev, taskIds: [...current, taskId] }
                  })
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">{t('selectTaskToAdd')}</option>
                {tasks
                  .filter((task) => !((formData.taskIds as string[]) || []).includes(task.id))
                  .map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title || t('untitledTask')}
                    </option>
                  ))}
              </select>
              {tasks.length === 0 && (
                <p className="mt-2 text-xs text-gray-500">{t('noTasksAvailable')}</p>
              )}
            </div>
          </div>
        )}
        {showMediaUpload && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('uploadMediaFile')} {!editingItem && '*'}
            </label>
            <input
              type="file"
              accept="video/*,image/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setMediaFile(file)
                  if (!formData.title) updateFormField('title', file.name.replace(/\.[^/.]+$/, ''))
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {mediaFile && (
              <div className="mt-2 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {mediaFile.name} ({(mediaFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
                <button
                  type="button"
                  onClick={() => setMediaFile(null)}
                  className="text-red-600 hover:text-red-700 text-sm"
                >
                  {t('remove')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'tasks' as ContentType, label: t('tasks'), icon: CheckSquare, count: tasks.length },
    { id: 'roadmaps' as ContentType, label: t('roadmaps'), icon: BookOpen, count: roadmaps.length },
  ]

  const currentItems = activeTab === 'tasks' ? tasks : roadmaps
  const isTasksTab = activeTab === 'tasks'
  const title = pageTitle ?? (mode === 'org' ? t('title') : t('contentManagement'))
  const subtitle = pageSubtitle ?? (mode === 'org' ? t('subtitle') : t('contentManagementSubtitle'))

  // ── Split-panel layout for org mode tasks ────────────────────────────────
  const showSplitPanel = mode === 'org' && isTasksTab

  return (
    <div className="min-w-0 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">{title}</h1>
        <p className="max-w-3xl text-base leading-7 text-gray-600 sm:text-lg">{subtitle}</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-6 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id)
                  setSelectedTask(null)
                }}
                className={`flex shrink-0 items-center space-x-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors ${isActive ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${isActive ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'}`}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Create button */}
      <div className="mb-4 flex justify-stretch sm:justify-end">
        <button
          type="button"
          onClick={handleCreate}
          className="flex w-full items-center justify-center space-x-2 rounded-lg bg-primary-600 px-4 py-2.5 text-white transition-colors hover:bg-primary-700 sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{isTasksTab ? t('createTask') : t('createRoadmap')}</span>
        </button>
      </div>

      {/* Empty state */}
      {currentItems.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            {isTasksTab ? (
              <CheckSquare className="w-8 h-8 text-gray-400" />
            ) : (
              <BookOpen className="w-8 h-8 text-gray-400" />
            )}
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {isTasksTab ? t('noTasksYet') : t('noRoadmapsYet')}
          </h3>
          <p className="text-gray-600 mb-6">
            {isTasksTab ? t('noTasksHint') : t('noRoadmapsHint')}
          </p>
          <button
            type="button"
            onClick={handleCreate}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            {isTasksTab ? t('createTask') : t('createRoadmap')}
          </button>
        </div>
      )}

      {/* ── SPLIT PANEL: org mode tasks ── */}
      {showSplitPanel && currentItems.length > 0 && (
        <div className="flex min-h-[520px] min-w-0 flex-col gap-4 lg:flex-row">
          {/* Left: task cards */}
          <div className="min-w-0 flex-1 space-y-3 lg:max-h-[calc(100vh-280px)] lg:overflow-y-auto lg:pr-1">
            {tasks.map((task) => {
              const isSelected = selectedTask?.id === task.id
              return (
                <div
                  key={task.id}
                  onClick={() => {
                    setSelectedTask(task)
                    setSelectedGroupIds(new Set())
                    setAssignDueDate('')
                    setAssignSuccess(false)
                  }}
                  className={`cursor-pointer rounded-xl border bg-white p-4 transition-all ${isSelected ? 'border-primary-500 shadow-sm ring-2 ring-primary-100' : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'}`}
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="break-words text-sm font-semibold text-gray-900 sm:truncate">
                        {task.title || t('untitled')}
                      </h3>
                      {task.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {task.category && (
                          <span className="text-[11px] px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
                            {task.category}
                          </span>
                        )}
                        {task.difficulty && (
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-full ${task.difficulty === 'easy' ? 'bg-green-100 text-green-700' : task.difficulty === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}
                          >
                            {t(
                              task.difficulty === 'easy'
                                ? 'difficultyEasy'
                                : task.difficulty === 'medium'
                                  ? 'difficultyMedium'
                                  : 'difficultyHard'
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      className="flex items-center gap-1 flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => handleEdit(task)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                        title={t('edit')}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete('tasks', task.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        title={t('delete')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Right: group assignment panel */}
          <div className="min-w-0 lg:w-80 lg:flex-shrink-0">
            <div className="overflow-hidden rounded-xl border border-gray-100 bg-white lg:sticky lg:top-4">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Users2 className="w-4 h-4 text-primary-600" />
                <span className="text-sm font-semibold text-gray-800">{t('assignToGroups')}</span>
              </div>

              {!selectedTask ? (
                <div className="px-4 py-8 text-center">
                  <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckSquare className="w-5 h-5 text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-400">{t('selectTaskLeft')}</p>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {/* Selected task preview */}
                  <div className="bg-primary-50 rounded-lg px-3 py-2">
                    <p className="text-[11px] font-semibold text-primary-600 uppercase tracking-wide mb-0.5">
                      {t('taskLabel')}
                    </p>
                    <p className="text-sm font-medium text-primary-900 line-clamp-2">
                      {selectedTask.title}
                    </p>
                  </div>

                  {/* Groups checklist */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      {t('groupsLabel')}
                    </p>
                    {loadingGroups ? (
                      <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{t('loadingGroups')}</span>
                      </div>
                    ) : orgGroups.length === 0 ? (
                      <p className="text-sm text-gray-400">{t('noGroupsForAssign')}</p>
                    ) : (
                      <div className="space-y-1.5">
                        {orgGroups.map((group) => {
                          const checked = selectedGroupIds.has(group.id)
                          return (
                            <label
                              key={group.id}
                              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${checked ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50 border border-transparent'}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleGroup(group.id)}
                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              />
                              <span
                                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                style={{ background: group.color || '#94a3b8' }}
                              />
                              <span className="text-sm text-gray-800 truncate flex-1">
                                {group.name}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Due date */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {t('dueDateLabel')}
                    </label>
                    <input
                      type="date"
                      value={assignDueDate}
                      onChange={(e) => setAssignDueDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  {/* Assign button */}
                  <button
                    type="button"
                    onClick={handleAssign}
                    disabled={assigning || selectedGroupIds.size === 0}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${assignSuccess ? 'bg-green-100 text-green-700' : 'bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                  >
                    {assigning ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{t('assigning')}</span>
                      </>
                    ) : assignSuccess ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{t('assigned')}</span>
                      </>
                    ) : (
                      <>
                        <Users2 className="w-4 h-4" />
                        <span>{t('assignSelected', { count: selectedGroupIds.size })}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── GRID layout: global mode or roadmaps tab ── */}
      {!showSplitPanel && currentItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentItems.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow flex flex-col min-h-0"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex-1 min-w-0">
                  <h3
                    className="text-lg font-semibold text-gray-900 mb-1 truncate"
                    title={item.title || item.name || undefined}
                  >
                    {item.title || item.name || t('untitled')}
                  </h3>
                  {item.description && (
                    <p
                      className="text-sm text-gray-600 line-clamp-3 break-words mt-0.5"
                      title={item.description}
                    >
                      {item.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    type="button"
                    onClick={() => handleEdit(item)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                    title={t('edit')}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(activeTab, item.id)}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    title={t('delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-2 text-xs text-gray-500">
                {item.category && (
                  <div>
                    <span className="font-medium">{t('category')}:</span> {item.category}
                  </div>
                )}
                {item.ageRange && (
                  <div>
                    <span className="font-medium">{t('ageRange')}:</span> {item.ageRange.min}-
                    {item.ageRange.max} {t('years')}
                  </div>
                )}
                {item.difficulty && (
                  <div>
                    <span className="font-medium">{t('difficulty')}:</span>{' '}
                    <span className="capitalize">
                      {t(
                        item.difficulty === 'easy'
                          ? 'difficultyEasy'
                          : item.difficulty === 'medium'
                            ? 'difficultyMedium'
                            : 'difficultyHard'
                      )}
                    </span>
                  </div>
                )}
                {item.taskIds && item.taskIds.length > 0 && (
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">{t('tasks')}:</span>{' '}
                    {t('tasksCount', { count: item.taskIds.length })}
                  </div>
                )}
                {item.createdAt && (
                  <div className="pt-2 border-t border-gray-100">
                    <span className="font-medium">{t('createdLabel')}:</span>{' '}
                    {new Date(item.createdAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingItem
                  ? isTasksTab
                    ? t('editTask')
                    : t('editRoadmap')
                  : isTasksTab
                    ? t('createTask')
                    : t('createRoadmap')}
              </h2>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">{renderForm()}</div>
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={handleCloseModal}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={saving}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {saving
                    ? activeTab === 'tasks' && mediaFile
                      ? t('uploading', { progress: uploadProgress })
                      : t('saving')
                    : editingItem
                      ? t('save')
                      : t('create')}
                </span>
              </button>
              {activeTab === 'tasks' && mediaFile && uploadProgress > 0 && uploadProgress < 100 && (
                <div className="mt-2 w-full">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {t('uploadingVideo', { progress: uploadProgress })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
