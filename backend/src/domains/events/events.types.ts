export interface EventDoc {
  id: string
  orgId: string
  orgName: string
  orgLogoUrl: string | null
  title: string
  description: string
  coverUrl: string | null
  date: string
  endDate: string | null
  location: string
  address: string | null
  city: string | null
  format: 'online' | 'offline' | 'hybrid'
  price: number
  currency: string
  spotsTotal: number
  registeredCount: number
  category: string | null
  ageMin: number | null
  ageMax: number | null
  status: 'draft' | 'published' | 'cancelled'
  createdAt: string
  updatedAt: string
}

export interface PublicEvent {
  id: string
  orgId: string
  orgName: string
  orgLogoUrl: string | null
  title: string
  description: string
  coverUrl: string | null
  date: string
  endDate: string | null
  location: string
  city: string | null
  format: 'online' | 'offline' | 'hybrid'
  price: number
  currency: string
  spotsTotal: number
  spotsLeft: number
  registeredCount: number
  category: string | null
  ageMin: number | null
  ageMax: number | null
}
