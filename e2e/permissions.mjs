// ────────────────────────────────────────────────────────────────────────────
// Scénario E2E permanent — Permissions par module (Feature).
//
// Section « FINALISATION » du brief : les droits d'accès par module
// (lib/auth.ts, hasFeature) doivent être honorés quel que soit le chemin de
// navigation, pas seulement quand on clique dans le menu. Couvre le
// contournement trouvé : currentPage pouvait être fixé directement depuis
// l'URL (chargement initial, bouton Précédent) sans repasser par go()/
// allowed() — un utilisateur restreint qui tape /finances dans la barre
// d'adresse voyait la page malgré tout.
//
// Usage : `node e2e/permissions.mjs` contre un serveur de dev déjà lancé
// (E2E_BASE_URL, par défaut http://localhost:5183).
// ────────────────────────────────────────────────────────────────────────────

import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5183'

async function main() {
  const browser = await chromium.launch(process.env.PW_EXECUTABLE_PATH ? { executablePath: process.env.PW_EXECUTABLE_PATH } : {})
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', err => { throw new Error(`Erreur JS pendant le test de permissions : ${err.message}`) })

  // Utilisateur restreint : rôle 'user', sans le module 'finances'.
  await page.addInitScript(() => {
    const admin = { id: 'u-admin', username: 'admin', password: 'admin', role: 'superadmin', displayName: 'Admin', createdAt: new Date().toISOString() }
    const restricted = {
      id: 'u-restricted', username: 'restricted', password: 'restricted', role: 'user',
      displayName: 'Restricted User', createdAt: new Date().toISOString(),
      features: ['gantt', 'visite'], // pas 'finances'
    }
    localStorage.setItem('sc-users-v1', JSON.stringify([admin, restricted]))
    localStorage.setItem('sc-session-v1', JSON.stringify({ userId: 'u-restricted', at: new Date().toISOString() }))
  })

  const step = (l) => console.log(`→ ${l}`)

  step('Charger l’opération TEST comme utilisateur restreint (sans accès Finances)')
  await page.goto(`${BASE}/projets`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const testBtn = page.locator('button[title*="Validation Planning"]')
  if (await testBtn.count() > 0) { await testBtn.click(); await page.waitForTimeout(500) }

  step('Naviguer directement vers /finances via l’URL — doit être bloqué')
  await page.goto(`${BASE}/finances`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const body = await page.locator('body').innerText()
  assert.ok(!page.url().endsWith('/finances'), 'l’URL doit être redirigée hors de /finances (module non autorisé)')
  assert.ok(!body.includes('Marché'), 'le contenu de la page Finances ne doit pas être visible')

  step('Vérifier qu’un module autorisé (Planning) reste accessible')
  await page.goto(`${BASE}/planning`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const planningBody = await page.locator('body').innerText()
  assert.ok(planningBody.includes('Planning'), 'le planning doit rester accessible (module autorisé)')

  console.log('done — accès Finances correctement bloqué pour l’utilisateur restreint')
  await browser.close()
}

main().catch(err => {
  console.error('E2E FAILED:', err)
  process.exitCode = 1
})
