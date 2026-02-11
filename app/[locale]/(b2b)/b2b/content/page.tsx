'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { apiClient } from '@/lib/b2b/api'
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
} from 'lucide-react'

type ContentType = 'tasks' | 'roadmaps'

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

export default function ContentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<ContentType>('tasks')
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null)
  const [saving, setSaving] = useState(false)

  const [tasks, setTasks] = useState<ContentItem[]>([])
  const [roadmaps, setRoadmaps] = useState<ContentItem[]>([])

  const [formData, setFormData] = useState<Record<string, any>>({})
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  useEffect(() => {
    const checkAccess = async () => {
      const user = getCurrentUser()
      if (!user) {
        router.push('/b2b/login')
        return
      }

      try {
        const idToken = await getIdToken(true)
        if (!idToken) {
          router.push('/b2b/login')
          return
        }
        apiClient.setToken(idToken)

        const result = await apiClient.checkSuperAdmin()
        if (!result.isSuperAdmin) {
          router.push('/b2b')
          return
        }

        setIsSuperAdmin(true)
        await loadContent()
      } catch {
        router.push('/b2b/login')
      } finally {
        setLoading(false)
      }
    }

    checkAccess()
  }, [router])

  const loadContent = async () => {
    try {
      const idToken = await getIdToken()
      if (!idToken) return
      apiClient.setToken(idToken)

      const [tasksData, roadmapsData] = await Promise.all([
        apiClient.getTasks(),
        apiClient.getRoadmaps(),
      ])

      setTasks(tasksData.tasks || [])
      setRoadmaps(roadmapsData.roadmaps || [])
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load content'
      alert(errorMessage)
    }
  }

  const handleCreate = () => {
    setEditingItem(null)
    setFormData({ taskIds: [] })
    setMediaFile(null)
    setUploadProgress(0)
    setIsModalOpen(true)
  }

  const handleEdit = (item: ContentItem) => {
    setEditingItem(item)
    const editData = { ...item }
    if (!editData.taskIds && item.steps) {
      editData.taskIds = item.steps.filter((step) => step.taskId).map((step) => step.taskId!)
    }
    if (!editData.taskIds) {
      editData.taskIds = []
    }
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
  }

  const handleSave = async () => {
    if (activeTab === 'roadmaps' && !formData.name) {
      alert('Name is required')
      return
    }
    if (activeTab !== 'roadmaps' && !formData.title) {
      alert('Title is required')
      return
    }
    if (
      activeTab === 'tasks' &&
      !mediaFile &&
      !editingItem &&
      !formData.videoUrl &&
      !formData.imageUrl
    ) {
      alert('Please upload a video or image file, or provide a URL')
      return
    }

    setSaving(true)
    try {
      const idToken = await getIdToken()
      if (!idToken) return
      apiClient.setToken(idToken)

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
            } else {
              await apiClient.updateTask(editingItem.id, formData)
            }
            break
          case 'roadmaps':
            await apiClient.updateRoadmap(editingItem.id, formData)
            break
        }
      } else {
        switch (activeTab) {
          case 'tasks':
            if (mediaFile) {
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
            } else {
              await apiClient.createTask(formData)
            }
            break
          case 'roadmaps':
            await apiClient.createRoadmap(formData)
            break
        }
      }

      const wasEditing = !!editingItem
      const action = wasEditing ? 'updated' : 'created'
      const contentType = activeTab.slice(0, -1)

      setIsModalOpen(false)
      setEditingItem(null)
      setFormData({})
      setMediaFile(null)
      setUploadProgress(0)
      await loadContent()

      setTimeout(() => {
        alert(`Successfully ${action} ${contentType}!`)
      }, 100)
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : `Failed to ${editingItem ? 'update' : 'create'} ${activeTab.slice(0, -1)}`
      alert(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (type: ContentType, id: string) => {
    if (!confirm(`Are you sure you want to delete this ${type.slice(0, -1)}?`)) return

    try {
      const idToken = await getIdToken()
      if (!idToken) return
      apiClient.setToken(idToken)

      switch (type) {
        case 'tasks':
          await apiClient.deleteTask(id)
          setTasks(tasks.filter((t) => t.id !== id))
          break
        case 'roadmaps':
          await apiClient.deleteRoadmap(id)
          setRoadmaps(roadmaps.filter((r) => r.id !== id))
          break
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : `Failed to delete ${type.slice(0, -1)}`
      alert(errorMessage)
    }
  }

  const updateFormField = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const renderForm = () => {
    const isTask = activeTab === 'tasks'
    const isRoadmap = activeTab === 'roadmaps'

    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isRoadmap ? 'Name' : 'Title'} *
          </label>
          <input
            type="text"
            value={isRoadmap ? formData.name || '' : formData.title || ''}
            onChange={(e) => updateFormField(isRoadmap ? 'name' : 'title', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder={`Enter ${isRoadmap ? 'name' : 'title'}`}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => updateFormField('description', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Enter description"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <input
            type="text"
            value={formData.category || ''}
            onChange={(e) => updateFormField('category', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Enter category"
          />
        </div>

        {isTask && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
              <select
                value={formData.difficulty || ''}
                onChange={(e) => updateFormField('difficulty', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Select difficulty</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimated Duration (minutes)
              </label>
              <input
                type="number"
                value={formData.estimatedDuration || ''}
                onChange={(e) =>
                  updateFormField('estimatedDuration', parseInt(e.target.value) || undefined)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter duration"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Video URL</label>
              <input
                type="url"
                value={formData.videoUrl || ''}
                onChange={(e) => updateFormField('videoUrl', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
              <input
                type="url"
                value={formData.imageUrl || ''}
                onChange={(e) => updateFormField('imageUrl', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Materials (one per line)
              </label>
              <textarea
                value={formData.materials ? formData.materials.join('\n') : ''}
                onChange={(e) => {
                  const materials = e.target.value
                    .split('\n')
                    .map((m) => m.trim())
                    .filter((m) => m.length > 0)
                  updateFormField('materials', materials.length > 0 ? materials : undefined)
                }}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Material 1&#10;Material 2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Instructions (one per line)
              </label>
              <textarea
                value={formData.instructions ? formData.instructions.join('\n') : ''}
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Step 1&#10;Step 2"
              />
            </div>
          </>
        )}

        {isRoadmap && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tasks in Roadmap
              </label>
              <div className="border border-gray-300 rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto bg-gray-50">
                {formData.taskIds && formData.taskIds.length > 0 ? (
                  <div className="space-y-2">
                    {formData.taskIds.map((taskId: string, index: number) => {
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
                                {task?.title || 'Unknown Task'}
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
                                const newTaskIds = [...(formData.taskIds || [])]
                                if (index > 0) {
                                  ;[newTaskIds[index], newTaskIds[index - 1]] = [
                                    newTaskIds[index - 1],
                                    newTaskIds[index],
                                  ]
                                  updateFormField('taskIds', newTaskIds)
                                }
                              }}
                              disabled={index === 0}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move up"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const newTaskIds = [...(formData.taskIds || [])]
                                if (index < newTaskIds.length - 1) {
                                  ;[newTaskIds[index], newTaskIds[index + 1]] = [
                                    newTaskIds[index + 1],
                                    newTaskIds[index],
                                  ]
                                  updateFormField('taskIds', newTaskIds)
                                }
                              }}
                              disabled={index === (formData.taskIds || []).length - 1}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move down"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const newTaskIds = (formData.taskIds || []).filter(
                                  (id: string) => id !== taskId
                                )
                                updateFormField('taskIds', newTaskIds.length > 0 ? newTaskIds : [])
                              }}
                              className="p-1 text-red-400 hover:text-red-600"
                              title="Remove"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8">
                    No tasks added yet. Select tasks below to add them to this roadmap.
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Add Task to Roadmap
              </label>
              <select
                value=""
                onChange={(e) => {
                  const taskId = e.target.value
                  if (taskId) {
                    const currentTaskIds = formData.taskIds || []
                    if (!currentTaskIds.includes(taskId)) {
                      updateFormField('taskIds', [...currentTaskIds, taskId])
                    }
                    e.target.value = ''
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Select a task to add...</option>
                {tasks
                  .filter((task) => !(formData.taskIds || []).includes(task.id))
                  .map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title || 'Untitled Task'}
                    </option>
                  ))}
              </select>
              {tasks.length === 0 && (
                <p className="mt-2 text-xs text-gray-500">
                  No tasks available. Create tasks first before adding them to a roadmap.
                </p>
              )}
            </div>
          </div>
        )}

        {isTask && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Upload Media File (Video or Image) {!editingItem && '*'}
            </label>
            <input
              type="file"
              accept="video/*,image/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setMediaFile(file)
                  if (!formData.title) {
                    updateFormField('title', file.name.replace(/\.[^/.]+$/, ''))
                  }
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                  Remove
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
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!isSuperAdmin) {
    return null
  }

  const tabs = [
    { id: 'tasks' as ContentType, label: 'Tasks', icon: CheckSquare, count: tasks.length },
    { id: 'roadmaps' as ContentType, label: 'Roadmaps', icon: BookOpen, count: roadmaps.length },
  ]

  const getCurrentItems = () => {
    switch (activeTab) {
      case 'tasks':
        return tasks
      case 'roadmaps':
        return roadmaps
    }
  }

  const currentItems = getCurrentItems()
  const contentTypeLabel =
    activeTab.slice(0, -1).charAt(0).toUpperCase() + activeTab.slice(0, -1).slice(1)

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Content Management</h1>
        <p className="text-gray-600">Manage global content: tasks and roadmaps</p>
      </div>

      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${
                    isActive
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${
                    isActive ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      <div className="mb-4 flex justify-end">
        <button
          onClick={handleCreate}
          className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Create {contentTypeLabel}</span>
        </button>
      </div>

      {currentItems.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            {(() => {
              const activeTabData = tabs.find((t) => t.id === activeTab)
              const Icon = activeTabData?.icon
              return Icon ? <Icon className="w-8 h-8 text-gray-400" /> : null
            })()}
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No {activeTab} yet</h3>
          <p className="text-gray-600 mb-6">
            Create your first {activeTab.slice(0, -1)} to get started.
          </p>
          <button
            onClick={handleCreate}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Create {contentTypeLabel}
          </button>
        </div>
      ) : (
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
                    {item.title || item.name || 'Untitled'}
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
                    onClick={() => handleEdit(item)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(activeTab, item.id)}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-xs text-gray-500">
                {item.category && (
                  <div>
                    <span className="font-medium">Category:</span> {item.category}
                  </div>
                )}
                {item.ageRange && (
                  <div>
                    <span className="font-medium">Age Range:</span> {item.ageRange.min}-
                    {item.ageRange.max} years
                  </div>
                )}
                {item.difficulty && (
                  <div>
                    <span className="font-medium">Difficulty:</span>{' '}
                    <span className="capitalize">{item.difficulty}</span>
                  </div>
                )}
                {item.type && (
                  <div>
                    <span className="font-medium">Type:</span>{' '}
                    <span className="capitalize">{item.type}</span>
                  </div>
                )}
                {item.tags && item.tags.length > 0 && (
                  <div>
                    <span className="font-medium">Tags:</span>{' '}
                    <span className="text-purple-600">{item.tags.join(', ')}</span>
                  </div>
                )}
                {item.estimatedDuration && (
                  <div>
                    <span className="font-medium">Duration:</span> {item.estimatedDuration} min
                  </div>
                )}
                {item.duration && (
                  <div>
                    <span className="font-medium">Duration:</span> {Math.floor(item.duration / 60)}:
                    {String(item.duration % 60).padStart(2, '0')}
                  </div>
                )}
                {item.materials && item.materials.length > 0 && (
                  <div>
                    <span className="font-medium">Materials:</span> {item.materials.length} item(s)
                  </div>
                )}
                {item.instructions && item.instructions.length > 0 && (
                  <div>
                    <span className="font-medium">Instructions:</span> {item.instructions.length}{' '}
                    step(s)
                  </div>
                )}
                {item.taskIds && item.taskIds.length > 0 && (
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Tasks:</span> {item.taskIds.length} task(s)
                  </div>
                )}
                {!item.taskIds && item.steps && item.steps.length > 0 && (
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Steps:</span> {item.steps.length} step(s)
                  </div>
                )}
                {item.videoUrl && (
                  <div className="pt-2">
                    <a
                      href={item.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 hover:text-purple-700 underline"
                    >
                      View Video →
                    </a>
                  </div>
                )}
                {item.imageUrl && (
                  <div className="pt-2">
                    <a
                      href={item.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 hover:text-purple-700 underline"
                    >
                      View Image →
                    </a>
                  </div>
                )}
                {item.url && (
                  <div className="pt-2">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 hover:text-purple-700 underline"
                    >
                      Open Link →
                    </a>
                  </div>
                )}
                {item.createdAt && (
                  <div className="pt-2 border-t border-gray-100">
                    <span className="font-medium">Created:</span>{' '}
                    {new Date(item.createdAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingItem ? 'Edit' : 'Create'} {contentTypeLabel}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">{renderForm()}</div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end space-x-3">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {saving
                    ? activeTab === 'tasks' && mediaFile
                      ? `Uploading... ${uploadProgress}%`
                      : 'Saving...'
                    : editingItem
                      ? 'Update'
                      : 'Create'}
                </span>
              </button>
              {activeTab === 'tasks' && mediaFile && uploadProgress > 0 && uploadProgress < 100 && (
                <div className="mt-2 w-full">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Uploading video... {uploadProgress}%</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
