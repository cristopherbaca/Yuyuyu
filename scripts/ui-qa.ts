import { chromium, type Page } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
const base = process.env.UI_QA_URL ?? 'http://127.0.0.1:5173'
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
})
const errors: string[] = [],
  files: string[] = []
mkdirSync('docs/ui-qa', { recursive: true })
async function create(theme: 'dark' | 'light', query = '') {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    colorScheme: theme,
    reducedMotion: 'reduce',
  })
  await context.addInitScript((value) => {
    if (localStorage.getItem('dynamic-flashcards.theme') === null)
      localStorage.setItem('dynamic-flashcards.theme', value)
  }, theme)
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`${base}/?mock=1${query}#/decks`)
  await page.getByRole('heading', { name: 'Mazos', exact: true }).waitFor()
  return { context, page }
}
async function shot(page: Page, name: string, theme: string) {
  const file = `${name}-${theme}.png`
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({
    path: resolve('docs/ui-qa', file),
    fullPage: false,
    animations: 'disabled',
  })
  files.push(file)
}
async function deckId(page: Page) {
  return page.evaluate(() => window.api!.getSnapshot().decks[0].id)
}
async function go(page: Page, path: string) {
  await page.evaluate((path) => {
    location.hash = path
  }, path)
}
try {
  for (const theme of ['dark', 'light'] as const) {
    const { context, page } = await create(theme)
    await shot(page, 'decks-default', theme)
    const id = await deckId(page)
    await go(page, `/decks/${id}`)
    await page.getByRole('button', { name: /Estudiar ahora/ }).waitFor()
    await shot(page, 'overview-default', theme)
    await page.getByRole('button', { name: 'Añadir tarjeta', exact: true }).first().click()
    await page.getByRole('dialog').waitFor()
    await shot(page, 'add-empty', theme)
    await page.getByLabel('Frente', { exact: true }).fill('Una tarjeta nueva')
    await page.getByLabel('Reverso', { exact: true }).fill('La respuesta contiene $a^2+b^2=c^2$.')
    await page.getByRole('button', { name: 'Vista previa', exact: true }).click()
    await page.locator('.katex').first().waitFor()
    await shot(page, 'add-preview', theme)
    await page.keyboard.press('Control+Enter')
    await page
      .getByRole('status')
      .filter({ hasText: /Tarjeta añadida/ })
      .waitFor()
    assert.equal(await page.getByLabel('Frente', { exact: true }).inputValue(), '')
    await page.getByRole('button', { name: 'Cerrar', exact: true }).first().click()
    await go(page, '/browse')
    await page.getByRole('heading', { name: 'Explorar', exact: true }).waitFor()
    await shot(page, 'browse-default', theme)
    await page
      .getByRole('button', { name: /Teorema de Pitágoras/ })
      .first()
      .click()
    await page.getByRole('dialog', { name: 'Detalle de tarjeta' }).waitFor()
    await shot(page, 'browse-detail', theme)
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click()
    assert.equal(await page.getByText('Confirmada', { exact: true }).count(), 2)
    await page.keyboard.press('Escape')
    await go(page, '/stats')
    await page.getByRole('heading', { name: 'Estadísticas', exact: true }).waitFor()
    await shot(page, 'stats-default', theme)
    await go(page, '/settings')
    await page.getByRole('heading', { name: 'Ajustes', exact: true }).waitFor()
    await shot(page, 'settings-default', theme)
    await page.getByRole('heading', { name: 'Avanzado', exact: true }).scrollIntoViewIfNeeded()
    await shot(page, 'settings-advanced', theme)
    await page.evaluate(() => window.scrollTo(0, 0))
    await page
      .getByRole('button', { name: theme === 'dark' ? 'Claro' : 'Oscuro', exact: true })
      .click()
    assert.equal(
      await page.locator('html').getAttribute('data-theme'),
      theme === 'dark' ? 'light' : 'dark',
    )
    await page.getByRole('button', { name: 'Sistema', exact: true }).click()
    assert.equal(await page.locator('html').getAttribute('data-theme'), theme)
    const opposite = theme === 'dark' ? 'light' : 'dark'
    await page.emulateMedia({ colorScheme: opposite })
    await page.waitForFunction(
      (value) => document.documentElement.dataset.theme === value,
      opposite,
    )
    await page.reload()
    await page.getByRole('heading', { name: 'Ajustes', exact: true }).waitFor()
    assert.equal(await page.locator('html').getAttribute('data-theme'), opposite)
    await context.close()
    for (const state of ['empty', 'offline', 'no-key', 'generating']) {
      const run = await create(theme, `&state=${state}`)
      await shot(run.page, `decks-${state}`, theme)
      await run.context.close()
    }
    for (const variant of [
      'recall',
      'cloze',
      'mcq',
      'numeric_problem',
      'open_problem',
      'explain',
    ]) {
      const run = await create(theme, `&variant=${variant}`),
        p = run.page,
        d = await deckId(p)
      await go(p, `/study/${d}?effort=deep&minutes=all`)
      await p.getByRole('button', { name: /Mostrar respuesta|Comprobar respuesta/ }).waitFor()
      await shot(p, `study-${variant}-front`, theme)
      if (variant === 'recall') {
        await p.getByRole('button', { name: '¿Por qué me salió esto?', exact: true }).click()
        await p.getByRole('dialog', { name: '¿Por qué me salió esto?' }).waitFor()
        await shot(p, 'study-selection-reason', theme)
        await p.keyboard.press('Escape')
        await p.locator('.review-metadata').click()
        await p.keyboard.press('e')
        await p.getByRole('dialog', { name: 'Editar tarjeta' }).waitFor()
        await shot(p, 'study-quick-edit', theme)
        await p.keyboard.press('Escape')
      }
      await p.locator('.review-metadata').click()
      await p.keyboard.press('n')
      await p.getByRole('dialog', { name: 'De tu nota' }).waitFor()
      await shot(p, `study-${variant}-source`, theme)
      await p.keyboard.press('Escape')
      if (variant === 'recall') {
        await p.keyboard.press('Space')
        await p.getByRole('button', { name: 'Bien 3 6 d' }).waitFor()
        await shot(p, 'study-recall-reveal', theme)
        const before = await p.evaluate(() => window.api!.getSnapshot().reviews.length)
        await p.keyboard.press('3')
        assert.equal(await p.evaluate(() => window.api!.getSnapshot().reviews.length), before + 1)
        await p.getByRole('button', { name: /Mostrar respuesta/ }).waitFor()
      } else {
        if (variant === 'mcq') await p.getByRole('button', { name: 'B 5', exact: true }).click()
        else
          await p
            .getByLabel('Tu respuesta', { exact: true })
            .fill(
              variant === 'cloze'
                ? 'c^2'
                : variant === 'numeric_problem'
                  ? '10/2'
                  : 'Sumo los cuadrados de los catetos y calculo la raíz cuadrada.',
            )
        if (variant === 'cloze') {
          await p.locator('.review-metadata').click()
          await p.keyboard.press('e')
          await p.getByRole('dialog', { name: 'Editar tarjeta' }).waitFor()
          await p.keyboard.press('Control+Enter')
          await p.getByRole('dialog', { name: 'Editar tarjeta' }).waitFor({ state: 'hidden' })
          await p.getByRole('button', { name: /Comprobar respuesta/ }).waitFor()
          assert.equal(
            await p.getByText('Correcto', { exact: true }).count(),
            0,
            'Saving an editor must not submit the reviewer',
          )
        }
        await p.getByRole('button', { name: /Comprobar respuesta/ }).click()
        await p.getByText('Correcto', { exact: true }).waitFor()
        await shot(p, `study-${variant}-feedback`, theme)
        await p.getByRole('button', { name: 'No estoy de acuerdo', exact: true }).click()
        await p.getByRole('button', { name: 'Casi', exact: true }).click()
        await p.getByText('Valoración corregida por ti.', { exact: true }).waitFor()
        await p.keyboard.press('4')
        assert.equal(
          await p.getByRole('button', { name: 'Fácil 4 15 d' }).getAttribute('aria-pressed'),
          'true',
        )
        if (variant === 'numeric_problem') {
          await p.getByRole('button', { name: 'Reportar error', exact: true }).click()
          await p
            .getByRole('status')
            .filter({ hasText: /Gracias por revisarla/ })
            .waitFor()
          const firstId = await p.evaluate(() => window.api!.getSnapshot().decks[0].id)
          assert.equal(
            await p.evaluate(
              (id) => window.api!.buildSession(id, 'deep', null)[0]?.card.id,
              firstId,
            ),
            await p.evaluate(() => window.api!.getSnapshot().concepts[0].id),
          )
          await p.getByRole('button', { name: 'Reportar error', exact: true }).click()
          await p
            .getByRole('status')
            .filter({ hasText: /se ha retirado/ })
            .waitFor()
          assert.notEqual(
            await p.evaluate(
              (id) => window.api!.buildSession(id, 'deep', null)[0]?.card.id,
              firstId,
            ),
            await p.evaluate(() => window.api!.getSnapshot().concepts[0].id),
          )
        }
        await p.getByRole('button', { name: /Siguiente/ }).click()
      }
      await p.keyboard.press('Escape')
      await p.getByRole('dialog', { name: '¿Salir del repaso?' }).waitFor()
      await shot(p, 'study-exit-confirmation', theme)
      await p.getByRole('button', { name: 'Seguir estudiando', exact: true }).click()
      await run.context.close()
    }
    for (const state of ['fail', 'partial', 'loading']) {
      const run = await create(theme, `&variant=open_problem&state=${state}`),
        p = run.page,
        d = await deckId(p)
      await go(p, `/study/${d}?effort=deep`)
      await p.getByLabel('Tu respuesta', { exact: true }).fill('Una explicación de demostración.')
      await p.getByRole('button', { name: /Comprobar respuesta/ }).click()
      if (state === 'loading') {
        await p.getByRole('button', { name: 'Calificarme yo', exact: true }).waitFor()
        await shot(p, 'study-loading', theme)
        await p.getByRole('button', { name: 'Calificarme yo', exact: true }).click()
        await p.getByRole('button', { name: 'Bien 3 6 d' }).waitFor()
      } else {
        await p.getByText(state === 'fail' ? 'Incorrecto' : 'Casi', { exact: true }).waitFor()
        await shot(p, `study-${state}${state === 'fail' ? '-reinforcement' : ''}`, theme)
        if (state === 'fail') {
          await p.getByRole('button', { name: /Siguiente/ }).click()
          await p.getByText('Raíz cuadrada y potencias', { exact: true }).first().waitFor()
          await shot(p, 'study-reinforcement-front', theme)
        }
      }
      await run.context.close()
    }
    // Complete one card and cover the calm end-of-session state.
    const run = await create(theme, '&variant=recall'),
      p = run.page,
      d = await deckId(p)
    await p.evaluate((id) => {
      const client = window.api!,
        data = client.getSnapshot()
      data.concepts
        .filter((c) => c.deckId === id)
        .slice(1)
        .forEach((c) => client.delete(c.id))
    }, d)
    await go(p, `/study/${d}`)
    await p.getByRole('button', { name: /Mostrar respuesta/ }).waitFor()
    await p.keyboard.press('Space')
    await p.keyboard.press('3')
    await p.getByRole('heading', { name: 'Repaso terminado' }).waitFor()
    await shot(p, 'study-complete', theme)
    await run.context.close()
  }
  assert.deepEqual(errors, [])
  writeFileSync(
    'docs/ui-qa/screenshots.json',
    JSON.stringify([...new Set(files)].sort(), null, 2) + '\n',
  )
  console.log(
    `Browser UI QA passed: ${new Set(files).size} screenshots, both themes, every card type, feedback, reinforcement, source, loading, editor, browse and session summary.`,
  )
} finally {
  await browser.close()
}
