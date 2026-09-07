import { expect, test } from '@playwright/test'

/**
 * Smoke test over the seeded demo data: open the queue, annotate an item, mark it done, export.
 * Requires `yarn setup` (or `yarn db:seed`) to have run.
 */
test('annotates a seeded item and finds it in the export', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Work queue' })).toBeVisible()
  await expect(page.locator('.badge.AUTO_REJECTED')).toBeVisible()
  await page.getByRole('link', { name: '001_leistenhernie.wav' }).click()

  await page.getByPlaceholder('your name').fill('E2E')
  const reopen = page.getByRole('button', { name: 'Reopen' })
  if (await reopen.isVisible()) await reopen.click()

  // Clicking a word moves the playhead.
  await expect(page.locator('.time')).toHaveText(/^0:00\.0/)
  await page.locator('.tok', { hasText: 'Milligramm' }).first().click()
  await expect(page.locator('.time')).not.toHaveText(/^0:00\.0/)

  // Drag across two words and add a measurement span.
  const from = page.locator('.tok', { hasText: 'eintausendfuenfhundert' }).first()
  const to = page.locator('.tok', { hasText: 'Milligramm' }).first()
  await from.hover()
  await page.mouse.down()
  await to.hover()
  await page.mouse.up()
  await expect(page.getByText('New span', { exact: true })).toBeVisible()
  const spansWith = (pattern: RegExp) =>
    page.locator('.item', { has: page.locator('.text', { hasText: pattern }) })
  const before = await page.locator('.item').count()
  const numbersBefore = await spansWith(/^eintausendfuenfhundert$/).count()
  await page.getByRole('button', { name: 'MEASUREMENT' }).click()
  await page.getByPlaceholder('1500').fill('1500')
  await expect(page.getByText('1.5 g')).toBeVisible()
  await page.getByRole('button', { name: 'Add span' }).click()
  await expect(page.locator('.item')).toHaveCount(before + 1)

  // Shift-click inside the measurement starts a nested span.
  await from.click({ modifiers: ['Shift'] })
  await expect(page.getByText('New span', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'NUMBER' }).click()
  await page.getByPlaceholder('12, 6/0, 2026').fill('1500')
  await page.getByRole('button', { name: 'Add span' }).click()
  await expect(page.locator('.item')).toHaveCount(before + 2)

  // A text correction keeps both spans on their words.
  await page.getByRole('button', { name: 'Edit text' }).click()
  const textarea = page.locator('textarea')
  await textarea.fill((await textarea.inputValue()).replace('Cefuroxin', 'Cefuroxim'))
  await page.getByRole('button', { name: 'Annotate' }).click()
  await expect(page.locator('.item')).toHaveCount(before + 2)
  await expect(spansWith(/^eintausendfuenfhundert$/)).toHaveCount(numbersBefore + 1)

  await expect(page.getByText('Saved', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Mark done' }).click()
  await expect(page.locator('.badge', { hasText: 'Done' })).toBeVisible()

  const exported = await page.request.get('/api/export')
  const records = (await exported.text())
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
  const record = records.find((r) => r.audio.filename === '001_leistenhernie.wav')
  expect(record.annotator).toBe('E2E')
  expect(record.correctedTranscript).toContain('Cefuroxim')
  expect(record.spans).toContainEqual(
    expect.objectContaining({
      type: 'MEASUREMENT',
      text: 'eintausendfuenfhundert Milligramm',
      attributes: { value: 1500, unit: 'mg', normalizedValue: 1.5, normalizedUnit: 'g' },
    }),
  )
  expect(record.spans).toContainEqual(
    expect.objectContaining({ type: 'NUMBER', text: 'eintausendfuenfhundert' }),
  )

  // Leave the demo data as it was found: remove the two spans, restore the text, reopen.
  for (const pattern of [/^eintausendfuenfhundert$/, /^eintausendfuenfhundert Milligramm$/]) {
    await spansWith(pattern).first().click()
    await page.getByRole('button', { name: 'Delete' }).click()
  }
  await expect(page.locator('.item')).toHaveCount(before)
  await page.getByRole('button', { name: 'Edit text' }).click()
  await textarea.fill((await textarea.inputValue()).replace('Cefuroxim', 'Cefuroxin'))
  await page.getByRole('button', { name: 'Reopen' }).click()
  await expect(page.locator('.badge', { hasText: 'In progress' })).toBeVisible()
})
