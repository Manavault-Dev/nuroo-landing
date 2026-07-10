import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Readable } from 'node:stream'

// ─── completeNoBodyPreParsing unit test ───────────────────────────────────────
// We test the logic directly without Fastify internals.

async function completeNoBodyPreParsing(
  request: { headers: Record<string, string> },
  _reply: unknown,
  _payload: NodeJS.ReadableStream
): Promise<NodeJS.ReadableStream> {
  request.headers['content-length'] = '2'
  const stream = Readable.from(['{}'])
  ;(stream as any).receivedEncodedLength = 2
  return stream
}

describe('completeNoBodyPreParsing', () => {
  it('always returns a readable stream', async () => {
    const req = { headers: {} as Record<string, string> }
    const original = Readable.from([''])
    const result = await completeNoBodyPreParsing(req, {}, original)
    expect(result).toBeInstanceOf(Readable)
  })

  it('sets content-length to 2 on the request', async () => {
    const req = { headers: {} as Record<string, string> }
    await completeNoBodyPreParsing(req, {}, Readable.from(['']))
    expect(req.headers['content-length']).toBe('2')
  })

  it('returned stream emits {} and ends', async () => {
    const req = { headers: {} as Record<string, string> }
    const stream = await completeNoBodyPreParsing(req, {}, Readable.from(['']))
    const chunks: Buffer[] = []
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (c) => chunks.push(Buffer.from(c)))
      stream.on('end', resolve)
      stream.on('error', reject)
    })
    expect(Buffer.concat(chunks).toString()).toBe('{}')
  })

  it('sets receivedEncodedLength = 2 on the stream', async () => {
    const req = { headers: {} as Record<string, string> }
    const stream = await completeNoBodyPreParsing(req, {}, Readable.from(['']))
    expect((stream as any).receivedEncodedLength).toBe(2)
  })

  it('overrides an existing content-length header', async () => {
    const req = { headers: { 'content-length': '0' } as Record<string, string> }
    await completeNoBodyPreParsing(req, {}, Readable.from(['']))
    expect(req.headers['content-length']).toBe('2')
  })
})

// ─── progress endpoint logic ──────────────────────────────────────────────────

function makeProgressDb({
  progressDocs = [] as Array<{ lessonId: string; courseId: string }>,
  lessonCount = 3,
  courseExists = true,
} = {}) {
  return {
    collection: (path: string) => {
      if (path.includes('lessonProgress')) {
        return {
          where: () => ({
            get: vi.fn().mockResolvedValue({
              docs: progressDocs.map((d) => ({ data: () => d })),
            }),
          }),
        }
      }
      return { where: () => ({ get: vi.fn().mockResolvedValue({ docs: [] }) }) }
    },
    doc: () => ({
      get: vi.fn().mockResolvedValue({
        exists: courseExists,
        data: () => (courseExists ? { lessonCount } : null),
      }),
    }),
  } as any
}

async function getProgressLogic(db: any, userId: string, orgId: string, courseId: string) {
  const progressSnap = await db
    .collection(`users/${userId}/lessonProgress`)
    .where('courseId', '==', courseId)
    .get()

  const completedLessonIds = progressSnap.docs.map((d: any) => d.data().lessonId as string)

  const courseSnap = await db.doc(`organizations/${orgId}/courses/${courseId}`).get()
  const totalLessons: number = courseSnap.exists ? (courseSnap.data()?.lessonCount ?? 0) : 0

  const completedLessons = completedLessonIds.length
  const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0

  return {
    enrollmentId: `${userId}_${courseId}`,
    totalLessons,
    completedLessons,
    progressPct,
    completedLessonIds,
  }
}

describe('course progress endpoint logic', () => {
  it('returns 0% progress when no lessons completed', async () => {
    const db = makeProgressDb({ progressDocs: [], lessonCount: 5 })
    const result = await getProgressLogic(db, 'user1', 'org1', 'course1')
    expect(result.completedLessons).toBe(0)
    expect(result.totalLessons).toBe(5)
    expect(result.progressPct).toBe(0)
    expect(result.completedLessonIds).toEqual([])
  })

  it('returns 100% when all lessons completed', async () => {
    const docs = [
      { lessonId: 'l1', courseId: 'course1' },
      { lessonId: 'l2', courseId: 'course1' },
      { lessonId: 'l3', courseId: 'course1' },
    ]
    const db = makeProgressDb({ progressDocs: docs, lessonCount: 3 })
    const result = await getProgressLogic(db, 'user1', 'org1', 'course1')
    expect(result.completedLessons).toBe(3)
    expect(result.progressPct).toBe(100)
    expect(result.completedLessonIds).toEqual(['l1', 'l2', 'l3'])
  })

  it('rounds progressPct correctly', async () => {
    const docs = [{ lessonId: 'l1', courseId: 'course1' }]
    const db = makeProgressDb({ progressDocs: docs, lessonCount: 3 })
    const result = await getProgressLogic(db, 'user1', 'org1', 'course1')
    expect(result.progressPct).toBe(33) // Math.round(1/3 * 100) = 33
  })

  it('returns 0% progress when course doc does not exist', async () => {
    const db = makeProgressDb({ progressDocs: [], courseExists: false })
    const result = await getProgressLogic(db, 'user1', 'org1', 'course1')
    expect(result.totalLessons).toBe(0)
    expect(result.progressPct).toBe(0)
  })

  it('builds enrollmentId as userId_courseId', async () => {
    const db = makeProgressDb()
    const result = await getProgressLogic(db, 'user42', 'org1', 'courseABC')
    expect(result.enrollmentId).toBe('user42_courseABC')
  })

  it('returns correct completedLessonIds list', async () => {
    const docs = [
      { lessonId: 'lesson-a', courseId: 'course1' },
      { lessonId: 'lesson-b', courseId: 'course1' },
    ]
    const db = makeProgressDb({ progressDocs: docs, lessonCount: 5 })
    const result = await getProgressLogic(db, 'user1', 'org1', 'course1')
    expect(result.completedLessonIds).toContain('lesson-a')
    expect(result.completedLessonIds).toContain('lesson-b')
    expect(result.completedLessonIds).toHaveLength(2)
  })

  it('returns 0% when lessonCount is 0 (division by zero guard)', async () => {
    const docs = [{ lessonId: 'l1', courseId: 'course1' }]
    const db = makeProgressDb({ progressDocs: docs, lessonCount: 0 })
    const result = await getProgressLogic(db, 'user1', 'org1', 'course1')
    expect(result.progressPct).toBe(0)
  })
})
