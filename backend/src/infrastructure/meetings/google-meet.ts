/**
 * Google Meet integration via Google Calendar API.
 *
 * Supports two auth strategies:
 *   - User OAuth (recommended): uses specialist's own refresh_token
 *   - Service Account (fallback): uses platform credentials
 *
 * Meeting strategies:
 *   - createPersistentRoom(): one shared room per cohort (recurring group)
 *   - createUniqueLink():     new link per individual consultation / 1:1
 */

import { google, type calendar_v3 } from 'googleapis'

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function getOAuthClient() {
  // Support both naming conventions used across .env files
  const clientId =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID
  const clientSecret =
    process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_SECRET
  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI ?? process.env.NEXT_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI

  if (!clientId || !clientSecret) {
    throw new Error(
      'Google OAuth not configured. Set NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID and NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_SECRET in .env'
    )
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

/** Build an authenticated Calendar client from specialist's stored refresh token */
function getCalendarWithRefreshToken(refreshToken: string): calendar_v3.Calendar {
  const oauth2 = getOAuthClient()
  oauth2.setCredentials({ refresh_token: refreshToken })
  return google.calendar({ version: 'v3', auth: oauth2 })
}

/** Fallback: Service Account for system-level meeting creation */
function getCalendarWithServiceAccount(): calendar_v3.Calendar {
  const email = process.env.GOOGLE_CLIENT_EMAIL
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!email || !key) {
    throw new Error(
      'No Google auth configured. Provide either user refresh_token or GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY.'
    )
  }

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  })
  return google.calendar({ version: 'v3', auth })
}

function getCalendar(refreshToken?: string | null): calendar_v3.Calendar {
  return refreshToken ? getCalendarWithRefreshToken(refreshToken) : getCalendarWithServiceAccount()
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MeetResult {
  meetingUrl: string
  eventId: string
}

export interface CreateRoomOptions {
  title: string
  description?: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  orgName?: string
  /** Specialist's stored Google refresh token (if connected) */
  refreshToken?: string | null
}

export interface CreateLinkOptions {
  title: string
  date: string // YYYY-MM-DD
  startTime: string // HH:MM
  endTime: string // HH:MM
  attendeeEmail?: string
  timeZone?: string
  description?: string
  /** Specialist's stored Google refresh token (if connected) */
  refreshToken?: string | null
}

// ─── Meeting creators ─────────────────────────────────────────────────────────

/**
 * Creates a persistent Google Meet room for a cohort group.
 * One room → all sessions share the same link.
 * Appears in specialist's own Google Calendar if refreshToken is provided.
 */
export async function createPersistentRoom(opts: CreateRoomOptions): Promise<MeetResult> {
  const calendar = getCalendar(opts.refreshToken)

  const event = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    requestBody: {
      summary: opts.title,
      description: [opts.description, opts.orgName ? `Организация: ${opts.orgName}` : null]
        .filter(Boolean)
        .join('\n'),
      start: { date: opts.startDate },
      end: { date: opts.endDate },
      conferenceData: {
        createRequest: {
          requestId: `nuroo-cohort-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
  })

  const meetUrl = extractMeetUrl(event.data)
  return { meetingUrl: meetUrl, eventId: event.data.id ?? '' }
}

/**
 * Creates a unique Google Meet link for a single 1:1 consultation.
 * Optionally invites the parent/client as an attendee.
 */
export async function createUniqueLink(opts: CreateLinkOptions): Promise<MeetResult> {
  const calendar = getCalendar(opts.refreshToken)
  const tz = opts.timeZone ?? 'Asia/Bishkek'

  const attendees: calendar_v3.Schema$EventAttendee[] = []
  if (opts.attendeeEmail) {
    attendees.push({ email: opts.attendeeEmail })
  }

  const event = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    sendUpdates: attendees.length ? 'all' : 'none',
    requestBody: {
      summary: opts.title,
      description: opts.description,
      start: { dateTime: `${opts.date}T${opts.startTime}:00`, timeZone: tz },
      end: { dateTime: `${opts.date}T${opts.endTime}:00`, timeZone: tz },
      attendees,
      conferenceData: {
        createRequest: {
          requestId: `nuroo-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
  })

  const meetUrl = extractMeetUrl(event.data)
  return { meetingUrl: meetUrl, eventId: event.data.id ?? '' }
}

/** Delete a Google Calendar event (e.g. on cohort/session cancel) */
export async function deleteEvent(eventId: string, refreshToken?: string | null): Promise<void> {
  const calendar = getCalendar(refreshToken)
  await calendar.events.delete({ calendarId: 'primary', eventId }).catch(() => {})
}

// ─── OAuth flow helpers ───────────────────────────────────────────────────────

/** Generate the Google OAuth consent URL for specialist Calendar access */
export function getOAuthConsentUrl(state: string): string {
  const oauth2 = getOAuthClient()
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    state,
  })
}

/** Exchange authorization code for tokens */
export async function exchangeCodeForTokens(code: string): Promise<{
  refreshToken: string
  email: string
}> {
  const oauth2 = getOAuthClient()
  const { tokens } = await oauth2.getToken(code)

  if (!tokens.refresh_token) {
    throw new Error(
      'No refresh_token returned. User may have already granted access — revoke at myaccount.google.com/permissions and retry.'
    )
  }

  // Get user email
  oauth2.setCredentials(tokens)
  const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 })
  const { data } = await oauth2Api.userinfo.get()

  return {
    refreshToken: tokens.refresh_token,
    email: data.email ?? '',
  }
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function extractMeetUrl(event: calendar_v3.Schema$Event): string {
  const url = event.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === 'video')?.uri

  if (!url) throw new Error('Google Meet link not returned by Calendar API')
  return url
}
