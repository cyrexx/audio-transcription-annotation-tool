import { expect, test, type Page } from '@playwright/test'

/**
 * Smoke test over the seeded demo data: open the queue, annotate an item, mark it done, export.
 * Requires `yarn setup` (or `yarn db:seed`) to have run. It only touches words the README demo
 * path never annotates and restores the item from a snapshot even when it fails, so it can run
 * before or after a manual walk-through; the one trace it leaves is a Pending item becoming
 * In progress.
 */
test('annotates a seeded item and finds it in the export', async ({ page }) => {
  const items = await (await page.request.get('/api/items')).json()
  const seeded = items.find((i: { filename: string }) => i.filename === '001_leistenhernie.wav')
  expect(seeded, 'demo item missing: run yarn setup first').toBeTruthy()
  const wasDone = seeded.status === 'DONE'
  const previousAnnotator: string = seeded.annotator ?? ''
  const before = await (await page.request.get(`/api/items/${seeded.id}`)).json()

  try {
    await run(page, wasDone, previousAnnotator)
  } finally {
    // Whatever happened above, put the item back the way it was found.
    const restored = await page.request
      .put(`/api/items/${seeded.id}/annotation`, {
        data: {
          correctedText: before.correctedText,
          spans: before.spans.map(({ id: _id, ...span }: { id: string }) => span),
          speechRateWpmOverride: before.speechRateWpmOverride,
          distanceOverride: before.distanceOverride,
          annotator: before.annotator,
          status: wasDone ? 'DONE' : 'IN_PROGRESS',
        },
      })
      .catch((e: Error) => e)
    expect
      .soft(!(restored instanceof Error) && restored.ok(), 'restoring the demo item failed')
      .toBe(true)
  }
})

async function run(page: Page, wasDone: boolean, previousAnnotator: string) {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Work queue' })).toBeVisible()
  await expect(page.locator('.badge.AUTO_REJECTED')).toBeVisible()
  await page.getByRole('link', { name: '001_leistenhernie.wav' }).click()

  await page.getByPlaceholder('your name').fill('E2E')
  if (wasDone) await page.getByRole('button', { name: 'Reopen' }).click()

  // Clicking a word moves the playhead.
  await expect(page.locator('.time')).toHaveText(/^0:00\.0/)
  await page.locator('.tok', { hasText: 'Milliliter' }).click()
  await expect(page.locator('.time')).not.toHaveText(/^0:00\.0/)
  await page.getByRole('button', { name: 'Cancel' }).click()

  // Drag across two words and add a measurement span.
  const spansWith = (pattern: RegExp) =>
    page.locator('.item', { has: page.locator('.text', { hasText: pattern }) })
  const from = page.locator('.tok', { hasText: 'fuenfzig' })
  const to = page.locator('.tok', { hasText: 'Milliliter' })
  const tokens = await page.locator('.tok').allInnerTexts()
  const wordBefore = tokens[tokens.indexOf('fuenfzig') - 1]
  await from.hover()
  await page.mouse.down()
  await to.hover()
  await page.mouse.up()
  await expect(page.getByText('New span', { exact: true })).toBeVisible()
  const before = await page.locator('.item').count()
  await page.getByRole('button', { name: 'MEASUREMENT' }).click()
  await page.getByPlaceholder('1500').fill('50')
  await page.getByLabel('Unit').selectOption('ml')
  await expect(page.getByText('0.05 l')).toBeVisible()
  await page.getByRole('button', { name: 'Add span' }).click()
  await expect(page.locator('.item')).toHaveCount(before + 1)

  // Dragging over exactly those words again opens the span instead of offering a duplicate,
  // and its boundaries move one word at a time.
  await from.hover()
  await page.mouse.down()
  await to.hover()
  await page.mouse.up()
  await expect(page.getByText('Edit span', { exact: true })).toBeVisible()
  await page.getByTitle('Include the previous word').click()
  await expect(spansWith(new RegExp(`^${wordBefore} fuenfzig Milliliter$`))).toHaveCount(1)
  await page.getByTitle('Drop the first word').click()
  await expect(spansWith(/^fuenfzig Milliliter$/)).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.getByText('Edit span', { exact: true })).toBeHidden()

  // Shift-click inside the measurement starts a nested span.
  await from.click({ modifiers: ['Shift'] })
  await expect(page.getByText('New span', { exact: true })).toBeVisible()
  await page.keyboard.press('Alt+Digit1') // NUMBER
  await page.getByPlaceholder('12, 6/0, 2026').fill('50')
  await page.getByRole('button', { name: 'Add span' }).click()
  await expect(page.locator('.item')).toHaveCount(before + 2)

  // A text correction elsewhere keeps both spans on their words.
  await page.getByRole('button', { name: 'Edit text' }).click()
  const textarea = page.locator('textarea')
  await textarea.fill((await textarea.inputValue()).replace('Blutverlust', 'Blutverlust-e2e'))
  await page.getByRole('button', { name: 'Annotate' }).click()
  await expect(page.locator('.item')).toHaveCount(before + 2)
  await expect(spansWith(/^fuenfzig$/)).toHaveCount(1)
  await expect(spansWith(/^fuenfzig Milliliter$/)).toHaveCount(1)

  await expect(page.getByText('✓ Saved')).toBeVisible()
  await page.getByRole('button', { name: 'Mark done' }).click()
  await expect(page.locator('.badge', { hasText: 'Done' })).toBeVisible()

  const exported = await page.request.get('/api/export')
  const records = (await exported.text())
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
  const record = records.find((r) => r.audio.filename === '001_leistenhernie.wav')
  expect(record.annotator).toBe('E2E')
  expect(record.correctedTranscript).toContain('Blutverlust-e2e')
  expect(record.spans).toContainEqual(
    expect.objectContaining({
      type: 'MEASUREMENT',
      text: 'fuenfzig Milliliter',
      attributes: { value: 50, unit: 'ml', normalizedValue: 0.05, normalizedUnit: 'l' },
    }),
  )
  expect(record.spans).toContainEqual(expect.objectContaining({ type: 'NUMBER', text: 'fuenfzig' }))

  // Put back what was found: remove the two spans, undo the text change, restore the annotator
  // and, unless the item was already done, reopen it.
  for (const pattern of [/^fuenfzig$/, /^fuenfzig Milliliter$/]) {
    await spansWith(pattern).first().click()
    await page.getByRole('button', { name: 'Delete' }).click()
  }
  await expect(page.locator('.item')).toHaveCount(before)
  await page.getByRole('button', { name: 'Edit text' }).click()
  await textarea.fill((await textarea.inputValue()).replace('Blutverlust-e2e', 'Blutverlust'))
  await page.getByPlaceholder('your name').fill(previousAnnotator)
  if (!wasDone) {
    await page.getByRole('button', { name: 'Reopen' }).click()
    await expect(page.locator('.badge', { hasText: 'In progress' })).toBeVisible()
  } else {
    await expect(page.getByText('✓ Saved')).toBeVisible()
  }
}
