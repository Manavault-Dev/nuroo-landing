'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, getIdToken } from '@/lib/b2b/authClient'
import { apiClient } from '@/lib/b2b/api'
import {
  Plus,
  Video,
  FileText,
  BookOpen,
  CheckSquare,
  Trash2,
  Edit2,
  Loader2,
  X,
} from 'lucide-react'

type ContentType = 'tasks' | 'roadmaps' | 'materials' | 'videos'

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
  const [materials, setMaterials] = useState<ContentItem[]>([])
  const [videos, setVideos] = useState<ContentItem[]>([])

  const [formData, setFormData] = useState<any>({})

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
      } catch (error) {
        console.error('Error checking access:', error)
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

      const [tasksData, roadmapsData, materialsData, videosData] = await Promise.all([
        apiClient.getTasks(),
        apiClient.getRoadmaps(),
        apiClient.getMaterials(),
        apiClient.getVideos(),
      ])

      setTasks(tasksData.tasks || [])
      setRoadmaps(roadmapsData.roadmaps || [])
      setMaterials(materialsData.materials || [])
      setVideos(videosData.videos || [])
    } catch (error: any) {
      console.error('Error loading content:', error)
      alert(error.message || 'Failed to load content')
    }
  }

  const handleCreate = () => {
    setEditingItem(null)
    setFormData({})
    setIsModalOpen(true)
  }

  const handleEdit = (item: ContentItem) => {
    setEditingItem(item)
    const editData = { ...item }
    setIsModalOpen(true)
    setFormData(editData)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingItem(null)
    setFormData({})
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
    if (activeTab === 'materials' && !formData.type) {
      alert('Type is required')
      return
    }
    if (activeTab === 'videos' && !formData.videoUrl) {
      alert('Video URL is required')
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
            await apiClient.updateTask(editingItem.id, formData)
            break
          case 'roadmaps':
            await apiClient.updateRoadmap(editingItem.id, formData)
            break
          case 'materials':
            await apiClient.updateMaterial(editingItem.id, formData)
            break
          case 'videos':
            await apiClient.updateVideo(editingItem.id, formData)
            break
        }
      } else {
        switch (activeTab) {
          case 'tasks':
            await apiClient.createTask(formData)
            break
          case 'roadmaps':
            await apiClient.createRoadmap(formData)
            break
          case 'materials':
            await apiClient.createMaterial(formData)
            break
          case 'videos':
            await apiClient.createVideo(formData)
            break
        }
      }

      const wasEditing = !!editingItem
      const action = wasEditing ? 'updated' : 'created'
      const contentType = activeTab.slice(0, -1)

      setIsModalOpen(false)
      setEditingItem(null)
      setFormData({})
      await loadContent()

      setTimeout(() => {
        alert(`Successfully ${action} ${contentType}!`)
      }, 100)
    } catch (error: any) {
      console.error('Error saving content:', error)
      alert(
        error.message || `Failed to ${editingItem ? 'update' : 'create'} ${activeTab.slice(0, -1)}`
      )
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
        case 'materials':
          await apiClient.deleteMaterial(id)
          setMaterials(materials.filter((m) => m.id !== id))
          break
        case 'videos':
          await apiClient.deleteVideo(id)
          setVideos(videos.filter((v) => v.id !== id))
          break
      }
    } catch (error: any) {
      alert(error.message || `Failed to delete ${type.slice(0, -1)}`)
    }
  }

  const updateFormField = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }))
  }

  const renderForm = () => {
    const isTask = activeTab === 'tasks'
    const isRoadmap = activeTab === 'roadmaps'
    const isMaterial = activeTab === 'materials'
    const isVideo = activeTab === 'videos'

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

        {isMaterial && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select
                value={formData.type || ''}
                onChange={(e) => updateFormField('type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              >
                <option value="">Select type</option>
                <option value="article">Article</option>
                <option value="video">Video</option>
                <option value="pdf">PDF</option>
                <option value="image">Image</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
              <input
                type="url"
                value={formData.url || ''}
                onChange={(e) => updateFormField('url', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
              <textarea
                value={formData.content || ''}
                onChange={(e) => updateFormField('content', e.target.value)}
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter content"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={formData.tags ? formData.tags.join(', ') : ''}
                onChange={(e) => {
                  const tags = e.target.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter((t) => t.length > 0)
                  updateFormField('tags', tags.length > 0 ? tags : undefined)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="tag1, tag2, tag3"
              />
            </div>
          </>
        )}

        {isRoadmap && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Steps (JSON format)
            </label>
            <textarea
              value={formData.steps ? JSON.stringify(formData.steps, null, 2) : ''}
              onChange={(e) => {
                const value = e.target.value.trim()
                if (!value) {
                  updateFormField('steps', undefined)
                  return
                }
                try {
                  const parsed = JSON.parse(value)
                  if (Array.isArray(parsed)) {
                    updateFormField('steps', parsed)
                  } else {
                    updateFormField('steps', undefined)
                  }
                } catch {
                  updateFormField('steps', undefined)
                }
              }}
              rows={6}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-xs ${
                formData.steps ? 'border-gray-300' : 'border-gray-300'
              }`}
              placeholder='[{"order": 1, "title": "Step 1", "description": "..."}]'
            />
            <p className="mt-1 text-xs text-gray-500">
              Enter steps as JSON array. Each step should have: order (number), title (string),
              description (optional), taskId (optional)
            </p>
          </div>
        )}

        {isVideo && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Video URL *</label>
              <input
                type="url"
                value={formData.videoUrl || ''}
                onChange={(e) => updateFormField('videoUrl', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="https://..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Thumbnail URL</label>
              <input
                type="url"
                value={formData.thumbnailUrl || ''}
                onChange={(e) => updateFormField('thumbnailUrl', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration (seconds)
              </label>
              <input
                type="number"
                value={formData.duration || ''}
                onChange={(e) => updateFormField('duration', parseInt(e.target.value) || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter duration"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={formData.tags ? formData.tags.join(', ') : ''}
                onChange={(e) => {
                  const tags = e.target.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter((t) => t.length > 0)
                  updateFormField('tags', tags.length > 0 ? tags : undefined)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="tag1, tag2, tag3"
              />
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Age Range Min</label>
            <input
              type="number"
              min="0"
              max="18"
              value={formData.ageRange?.min || ''}
              onChange={(e) =>
                updateFormField('ageRange', {
                  ...formData.ageRange,
                  min: parseInt(e.target.value) || undefined,
                  max: formData.ageRange?.max || 18,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Age Range Max</label>
            <input
              type="number"
              min="0"
              max="18"
              value={formData.ageRange?.max || ''}
              onChange={(e) =>
                updateFormField('ageRange', {
                  ...formData.ageRange,
                  min: formData.ageRange?.min || 0,
                  max: parseInt(e.target.value) || undefined,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-8">
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
    { id: 'materials' as ContentType, label: 'Materials', icon: FileText, count: materials.length },
    { id: 'videos' as ContentType, label: 'Videos', icon: Video, count: videos.length },
  ]

  const getCurrentItems = () => {
    switch (activeTab) {
      case 'tasks':
        return tasks
      case 'roadmaps':
        return roadmaps
      case 'materials':
        return materials
      case 'videos':
        return videos
    }
  }

  const currentItems = getCurrentItems()
  const contentTypeLabel =
    activeTab.slice(0, -1).charAt(0).toUpperCase() + activeTab.slice(0, -1).slice(1)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Content Management</h1>
        <p className="text-gray-600">
          Manage global content: tasks, roadmaps, materials, and videos
        </p>
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
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {item.title || item.name || 'Untitled'}
                  </h3>
                  {item.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
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
                {item.steps && item.steps.length > 0 && (
                  <div>
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
                <span>{saving ? 'Saving...' : editingItem ? 'Update' : 'Create'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
