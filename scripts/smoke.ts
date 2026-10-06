import { _electron as electron } from 'playwright'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'
const userData = mkdtempSync(join(tmpdir(), 'dynamic-flashcards-smoke-'))
const app = await electron.launch({
  args: ['out/main/index.js'],
  env: {
    ...process.env,
    DYNAMIC_FLASHCARDS_USER_DATA: userData,
    FAKE_LLM: 'true',
    OPENAI_API_KEY: '',
  },
  timeout: 30000,
})
const errors: string[] = []
try {
  const page = await app.firstWindow()
  page.on('pageerror', (error) => errors.push(error.message))
  await page.getByRole('heading', { name: 'Ideas que se quedan.' }).waitFor()
  const security = await app.evaluate(({ BrowserWindow }) => {
    // Electron exposes this runtime inspector without a public declaration.
    const contents = BrowserWindow.getAllWindows()[0].webContents as Electron.WebContents & {
      getLastWebPreferences(): {
        contextIsolation: boolean
        nodeIntegration: boolean
        sandbox: boolean
      }
    }
    const prefs = contents.getLastWebPreferences()
    return {
      contextIsolation: prefs.contextIsolation,
      nodeIntegration: prefs.nodeIntegration,
      sandbox: prefs.sandbox,
    }
  })
  assert.deepEqual(security, { contextIsolation: true, nodeIntegration: false, sandbox: true })
  assert.equal(await page.evaluate(() => typeof Reflect.get(window, 'require')), 'undefined')
  const secret = await page.evaluate(async () => {
    const saved = await window.api.settings.setApiKey('local-smoke-secret')
    const read = await window.api.settings.get()
    return { saved, read }
  })
  assert.ok(secret.read.ok)
  assert.equal(secret.read.data.apiKeySet, true)
  assert.equal(JSON.stringify(secret).includes('local-smoke-secret'), false)
  await page.getByRole('button', { name: 'Nuevo concepto', exact: true }).click()
  await page.getByLabel('Título', { exact: true }).fill('Teorema de Pitágoras')
  await page
    .getByLabel('Tu nota', { exact: true })
    .fill(
      'En un triángulo rectángulo, los catetos a y b y la hipotenusa c cumplen a² + b² = c². La fórmula es $c = \\sqrt{a^2+b^2}$.',
    )
  await page.getByRole('button', { name: 'Guardar concepto', exact: true }).click()
  await page.getByRole('heading', { name: 'Teorema de Pitágoras', exact: true }).waitFor()
  await page.locator('.katex').first().waitFor()
  await page.waitForFunction(async () => {
    const result = await window.api.concepts.list()
    return result.ok && result.data[0]?.poolSize === 5
  })
  const before = await page.evaluate(async () => {
    const result = await window.api.concepts.list()
    if (!result.ok || !result.data[0]) throw new Error('Missing concept')
    return result.data[0].due
  })
  await page.getByRole('link', { name: 'Estudiar', exact: true }).click()
  await page.getByRole('button', { name: /Empezar a estudiar/ }).click()
  await page.getByRole('button', { name: /Mostrar respuesta/ }).waitFor()
  await page.keyboard.press('Space')
  await page.getByRole('button', { name: 'Bien 3' }).waitFor()
  await page.keyboard.press('3')
  await page.getByText('Próximo repaso', { exact: true }).waitFor()
  const after = await page.evaluate(async () => {
    const result = await window.api.concepts.list()
    if (!result.ok || !result.data[0]) throw new Error('Missing concept')
    return result.data[0].due
  })
  assert.ok(after > before, 'FSRS must move due after a Good review')
  await page.getByRole('button', { name: 'No estoy de acuerdo', exact: true }).click()
  await page.getByRole('button', { name: 'Incorrecta', exact: true }).click()
  await page.getByText('Valoración corregida por ti.', { exact: true }).waitFor()
  await page.getByRole('button', { name: 'Reportar error', exact: true }).click()
  await page.getByText(/Reporte guardado/).waitFor()
  await page.getByRole('button', { name: 'Reportar error', exact: true }).click()
  await page.getByText(/Variante retirada/).waitFor()
  await page.getByRole('link', { name: 'Estadísticas', exact: true }).click()
  await page.getByRole('heading', { name: 'Tu progreso', exact: true }).waitFor()
  await page.getByText('Solución independiente', { exact: true }).waitFor()
  assert.deepEqual(errors, [])
  mkdirSync('.onboarding', { recursive: true })
  await page.screenshot({ path: resolve('.onboarding/stats-smoke.png'), fullPage: true })
  console.log(
    'Electron smoke passed: secure preload, write-only key, concept creation, verified pool, KaTeX, keyboard review, FSRS due, override, reporting and usage statistics.',
  )
} finally {
  await app.close()
  rmSync(userData, { recursive: true, force: true })
}
