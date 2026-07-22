import { expect, test } from '@playwright/test'
import { mockBillingStatus, seedB2BAuth } from './helpers/b2b'

const tasks = Array.from({ length: 26 }, (_, index) => ({
  id: `task-${index + 1}`,
  title:
    index === 0
      ? 'Speech Sounds'
      : index === 1
        ? 'Balance Walk'
        : index === 2
          ? 'Advanced Speech Practice'
          : `Task ${index + 1}`,
  description:
    index === 0
      ? 'Speech therapy basics'
      : index === 1
        ? 'Motor coordination activity'
        : index === 2
          ? 'Medium difficulty speech task'
          : `Description ${index + 1}`,
  category:
    index === 0 || index === 2
      ? 'Speech Therapy'
      : index % 2 === 0
        ? 'Motor Skills'
        : 'Cognitive Play',
  difficulty:
    index === 0
      ? 'easy'
      : index === 1
        ? 'hard'
        : index === 2
          ? 'medium'
          : index % 3 === 0
            ? 'medium'
            : 'easy',
}))

test.describe('Assignments product flows', () => {
  test('filters tasks, uses custom select, and assigns a task to a group', async ({ page }) => {
    await seedB2BAuth(page)
    await mockBillingStatus(page)

    await page.route('**/orgs/org-1/content/tasks', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, tasks, count: tasks.length }),
      })
    })
    await page.route('**/orgs/org-1/content/roadmaps', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          roadmaps: [{ id: 'roadmap-1', name: 'Starter roadmap' }],
          count: 1,
        }),
      })
    })
    await page.route('**/orgs/org-1/groups', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          groups: [
            { id: 'group-a', name: 'Morning Group', color: '#14b8a6' },
            { id: 'group-b', name: 'Evening Group', color: '#f59e0b' },
          ],
          count: 2,
        }),
      })
    })

    let assignPayload: unknown = null
    await page.route('**/orgs/org-1/groups/group-a/assign', async (route) => {
      assignPayload = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, tasksCreated: 1, childCount: 3, taskCount: 1 }),
      })
    })

    await page.goto('/en/b2b/assignments?orgId=org-1')

    await expect(page.getByRole('heading', { name: /tasks and roadmaps/i })).toBeVisible()
    await expect(page.getByText('26 of 26 tasks')).toBeVisible()
    await expect(page.getByText('Showing 24 of 26')).toBeVisible()

    await page.getByPlaceholder('Search by title, description or category...').fill('speech')
    await expect(page.getByText('2 of 26 tasks')).toBeVisible()
    await expect(page.getByText('Speech Sounds')).toBeVisible()
    await expect(page.getByText('Advanced Speech Practice')).toBeVisible()

    await page.getByRole('button', { name: 'All categories' }).click()
    await page.getByRole('option', { name: 'Speech Therapy' }).click()
    await expect(page.getByText('2 of 26 tasks')).toBeVisible()

    await page.getByRole('button', { name: 'Any difficulty' }).click()
    await page.getByRole('option', { name: 'Medium' }).click()
    await expect(page.getByText('1 of 26 tasks')).toBeVisible()
    await expect(page.getByText('Advanced Speech Practice')).toBeVisible()

    await page.getByRole('button', { name: /clear/i }).click()
    await expect(page.getByText('26 of 26 tasks')).toBeVisible()

    await page.getByRole('button', { name: /show more/i }).click()
    await expect(page.getByText('Task 26')).toBeVisible()

    await page.getByText('Speech Sounds').click()
    await expect(page.getByText('Morning Group')).toBeVisible()
    await page.getByLabel('Morning Group').check()
    await page.getByRole('button', { name: 'Assign (1)' }).click()

    await expect(page.getByRole('button', { name: /assigned!/i })).toBeVisible()
    expect(assignPayload).toEqual({
      contentTaskIds: ['task-1'],
      contentRoadmapIds: [],
      dueDate: null,
    })
  })
})
