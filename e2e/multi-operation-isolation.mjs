// ────────────────────────────────────────────────────────────────────────────
// Scénario E2E permanent — Isolation multi-opérations (TEST CRITIQUE).
//
// Section « FINALISATION » du brief : deux opérations distinctes doivent
// avoir zéro contamination croisée. Utilise l'opération TEST dédiée et le
// projet Exemple intégré (« Résidence Les Tilleuls ») — jamais Gambetta.
//
// Usage : `node e2e/multi-operation-isolation.mjs` contre un serveur de dev
// déjà lancé (E2E_BASE_URL, par défaut http://localhost:5183).
// ────────────────────────────────────────────────────────────────────────────

import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5183'

async function main() {
  const browser = await chromium.launch(process.env.PW_EXECUTABLE_PATH ? { executablePath: process.env.PW_EXECUTABLE_PATH } : {})
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', err => { throw new Error(`Erreur JS pendant le test d'isolation : ${err.message}`) })
  await page.addInitScript(() => {
    const user = { id: 'iso', username: 'iso', password: 'iso', role: 'superadmin', displayName: 'Iso Test', createdAt: new Date().toISOString() }
    localStorage.setItem('sc-users-v1', JSON.stringify([user]))
    localStorage.setItem('sc-session-v1', JSON.stringify({ userId: 'iso', at: new Date().toISOString() }))
  })

  const step = (l) => console.log(`→ ${l}`)
  const addMarkerTask = async (title) => {
    await page.locator('button', { hasText: 'Tâche' }).first().click()
    await page.waitForTimeout(200)
    await page.locator('input[placeholder="Titre de la tâche"]').fill(title)
    await page.locator('button', { hasText: 'Ajouter' }).first().click()
    await page.waitForTimeout(400)
  }

  step('Charger opération TEST, ajouter une tâche distinctive')
  await page.goto(`${BASE}/projets`, { waitUntil: 'networkidle' })
  await page.locator('button[title*="Validation Planning"]').click()
  await page.waitForTimeout(500)
  await page.goto(`${BASE}/planning`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await addMarkerTask('ISO-MARKER — visible uniquement dans TEST')
  let body = await page.locator('body').innerText()
  assert.ok(body.includes('ISO-MARKER — visible uniquement dans TEST'), 'le marqueur doit apparaître dans TEST')

  step('Charger un 2e projet (Exemple), vérifier zéro fuite du marqueur TEST')
  await page.goto(`${BASE}/projets`, { waitUntil: 'networkidle' })
  await page.locator('button[title="Créer un projet d\'exemple pré-rempli"]').click()
  await page.waitForTimeout(500)
  await page.goto(`${BASE}/planning`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  body = await page.locator('body').innerText()
  assert.ok(!body.includes('ISO-MARKER'), 'AUCUNE fuite du marqueur TEST vers le 2e projet')
  assert.ok(!body.includes('TEST-E2E'), 'le 2e projet ne doit montrer aucune trace de la réf. TEST')
  await addMarkerTask('ISO-MARKER-2 — visible uniquement dans Exemple')
  body = await page.locator('body').innerText()
  assert.ok(body.includes('ISO-MARKER-2'), 'le 2e marqueur doit apparaître dans le projet Exemple')

  step('Revenir sur TEST : marqueur TEST intact, marqueur du 2e projet absent')
  await page.goto(`${BASE}/projets`, { waitUntil: 'networkidle' })
  // Un seul projet non actif a un bouton "Ouvrir" à ce stade (TEST — Exemple est actif).
  await page.locator('button', { hasText: 'Ouvrir' }).click()
  await page.waitForTimeout(500)
  await page.goto(`${BASE}/planning`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  body = await page.locator('body').innerText()
  assert.ok(body.includes('ISO-MARKER — visible uniquement dans TEST'), 'le marqueur TEST doit être toujours là après un aller-retour')
  assert.ok(!body.includes('ISO-MARKER-2'), 'AUCUNE fuite du marqueur du 2e projet vers TEST')

  console.log('done — zero cross-contamination confirmed')
  await browser.close()
}

main().catch(err => {
  console.error('E2E FAILED:', err)
  process.exitCode = 1
})
