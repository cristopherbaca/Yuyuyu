import { _electron as electron } from 'playwright'
import { mkdtempSync, mkdirSync, rmSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'
const userData = mkdtempSync(join(tmpdir(), 'dynamic-flashcards-smoke-'))
const app = await electron.launch({
  args: ['out/main/index.js'],
  env: { ...process.env, DYNAMIC_FLASHCARDS_USER_DATA: userData },
  timeout: 30000,
})
const errors: string[] = []
try {
  const page = await app.firstWindow()
  page.on('pageerror', (error) => errors.push(error.message))
  await page.getByRole('heading', { name: 'Ideas que se quedan.' }).waitFor()
  const security = await app.evaluate(({ BrowserWindow }) => {
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
  assert.equal(
    await page.evaluate(() => typeof Reflect.get(window, 'api')),
    'undefined',
    'No backend IPC API remains',
  )
  const denied = await page.evaluate(() => window.desktop!.openExternal('file:///tmp/blocked'))
  assert.equal(denied.ok, false)
  await page.getByRole('link', { name: 'Ajustes', exact: true }).click()
  await page.getByRole('button', { name: 'Claro Suave y luminoso' }).click()
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light')
  await page.getByRole('button', { name: 'Activar tema oscuro' }).click()
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
  const darkBackground = await page.evaluate(
    () => getComputedStyle(document.documentElement).backgroundColor,
  )
  await page.reload()
  await page.getByRole('heading', { name: 'Ajustes', exact: true }).waitFor()
  assert.equal(
    await page.locator('html').getAttribute('data-theme'),
    'dark',
    'Theme must survive reload',
  )
  assert.equal(await page.getByLabel('Nueva clave API').count(), 0)
  await page.getByRole('link', { name: 'Conceptos', exact: true }).click()
  await page.getByRole('button', { name: 'Nuevo concepto', exact: true }).click()
  await page.getByLabel('Título', { exact: true }).fill('Teorema de Pitágoras')
  await page
    .getByLabel('Tu nota', { exact: true })
    .fill('En un triángulo rectángulo se cumple $a^2 + b^2 = c^2$.')
  await page.getByRole('button', { name: 'Guardar concepto', exact: true }).click()
  await page.getByRole('heading', { name: 'Teorema de Pitágoras', exact: true }).waitFor()
  await page.locator('.katex').first().waitFor()
  await page.getByRole('link', { name: /Repasar concepto/ }).click()
  await page.getByRole('button', { name: /Empezar a estudiar/ }).click()
  await page.getByRole('button', { name: /Mostrar respuesta/ }).waitFor()
  await page.keyboard.press('Space')
  await page.getByRole('button', { name: 'Bien 3' }).waitFor()
  await page.keyboard.press('3')
  await page.getByText('Práctica registrada', { exact: true }).waitFor()
  await page.getByRole('button', { name: /Terminar sesión/ }).click()
  await page.getByRole('heading', { name: 'Sesión completada.' }).waitFor()
  await page.getByRole('link', { name: 'Estadísticas', exact: true }).click()
  await page.getByRole('heading', { name: 'Tu progreso', exact: true }).waitFor()
  assert.equal(
    await page.locator('.stats-cards .panel').nth(1).locator('strong').textContent(),
    '1',
  )
  mkdirSync('.onboarding', { recursive: true })
  await page.screenshot({
    path: resolve('.onboarding/dark-theme.png'),
    fullPage: true,
    animations: 'disabled',
  })
  await page.getByRole('button', { name: 'Activar tema claro' }).click()
  assert.notEqual(
    await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor),
    darkBackground,
  )
  await page.screenshot({
    path: resolve('.onboarding/light-theme.png'),
    fullPage: true,
    animations: 'disabled',
  })
  await page.reload()
  await page.getByRole('heading', { name: 'Tu progreso', exact: true }).waitFor()
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light')
  assert.equal(
    await page.locator('.stats-cards .panel').nth(1).locator('strong').textContent(),
    '1',
    'Demo activity must survive reload',
  )
  assert.equal(
    readdirSync(userData).some((file) => /flashcards\.db|api-key|settings\.json/.test(file)),
    false,
    'No backend files created',
  )
  assert.deepEqual(errors, [])
  console.log(
    'Electron smoke passed: secure shell, no backend API/files, both themes and persistence, note creation, KaTeX, keyboard practice and demo activity.',
  )
} finally {
  await app.close()
  rmSync(userData, { recursive: true, force: true })
}
