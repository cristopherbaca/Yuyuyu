import { _electron as electron } from 'playwright'
import { mkdtempSync, mkdirSync, rmSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'
const userData = mkdtempSync(join(tmpdir(), 'mnemo-smoke-'))
const app = await electron.launch({
  args: ['out/main/index.js'],
  env: { ...process.env, DYNAMIC_FLASHCARDS_USER_DATA: userData },
  timeout: 30000,
})
const errors: string[] = []
try {
  const page = await app.firstWindow()
  page.on('pageerror', (error) => errors.push(error.message))
  await page.getByRole('heading', { name: 'Mazos', exact: true }).waitFor()
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
    'Mock API must not ship in production',
  )
  assert.equal(
    (await page.evaluate(() => window.desktop!.openExternal('file:///tmp/blocked'))).ok,
    false,
  )
  await page.getByRole('button', { name: 'Crear mazo', exact: true }).first().click()
  await page.getByLabel('Nombre del mazo', { exact: true }).fill('Mi primer mazo')
  await page.getByRole('dialog').getByRole('button', { name: 'Crear mazo', exact: true }).click()
  await page.getByRole('heading', { name: 'Mi primer mazo', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Añadir tarjeta', exact: true }).last().click()
  await page.getByLabel('Frente', { exact: true }).fill('Teorema de Pitágoras')
  await page
    .getByLabel('Reverso', { exact: true })
    .fill('En un triángulo rectángulo se cumple $a^2+b^2=c^2$.')
  await page.keyboard.press('Control+Enter')
  await page
    .getByRole('status')
    .filter({ hasText: /Tarjeta añadida/ })
    .waitFor()
  assert.equal(await page.getByLabel('Frente', { exact: true }).inputValue(), '')
  await page.getByRole('button', { name: 'Cerrar', exact: true }).first().click()
  await page.getByRole('button', { name: /Estudiar ahora/ }).click()
  await page.getByRole('button', { name: /Mostrar respuesta/ }).waitFor()
  await page.keyboard.press('e')
  await page.getByRole('dialog', { name: 'Editar tarjeta' }).waitFor()
  await page.getByLabel('Frente', { exact: true }).fill('Pitágoras y sus catetos')
  await page.keyboard.press('Control+Enter')
  await page
    .locator('.card-question')
    .getByText('Pitágoras y sus catetos', { exact: true })
    .waitFor()
  await page.keyboard.press('n')
  await page.getByRole('dialog', { name: 'De tu nota' }).waitFor()
  await page.locator('.katex').first().waitFor()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Space')
  await page.getByRole('button', { name: 'Bien 3 Sin programar' }).waitFor()
  await page.keyboard.press('3')
  await page.getByRole('heading', { name: 'Repaso terminado' }).waitFor()
  await page.getByRole('button', { name: 'Volver al mazo', exact: true }).click()
  await page.keyboard.press('a')
  await page.getByRole('dialog', { name: 'Añadir tarjeta' }).waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Ajustes', exact: true }).click()
  await page.getByRole('button', { name: 'Oscuro', exact: true }).click()
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
  await page.reload()
  await page.getByRole('heading', { name: 'Ajustes', exact: true }).waitFor()
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
  await page.getByRole('button', { name: 'Claro', exact: true }).click()
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light')
  await page.getByRole('link', { name: 'Explorar', exact: true }).click()
  await page.getByRole('button', { name: /Pitágoras y sus catetos/ }).click()
  await page.getByRole('dialog', { name: 'Detalle de tarjeta' }).waitFor()
  await page.getByText('Bien', { exact: true }).waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Estadísticas', exact: true }).click()
  await page.getByRole('heading', { name: 'Estadísticas', exact: true }).waitFor()
  assert.equal(await page.locator('.stat-tiles>div').nth(1).locator('strong').textContent(), '1')
  mkdirSync('docs/ui-qa', { recursive: true })
  await page.screenshot({
    path: resolve('docs/ui-qa/electron-local-light.png'),
    fullPage: true,
    animations: 'disabled',
  })
  assert.equal(
    readdirSync(userData).some((file) => /flashcards\.db|api-key|settings\.json/.test(file)),
    false,
  )
  assert.deepEqual(errors, [])
  console.log(
    'Electron smoke passed: secure custom shell, deck/card creation, batch editor, KaTeX source, keyboard reviewer, local activity, persistent themes and no mock/backend API.',
  )
} finally {
  await app.close()
  rmSync(userData, { recursive: true, force: true })
}
