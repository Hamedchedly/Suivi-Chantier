// ────────────────────────────────────────────────────────────────────────────
// Scénario E2E permanent — Validation Planning & Visite.
//
// Exerce le Gantt v2 (unique planning de l'application) et le chaînage
// Visite → Planning sur l'opération TEST dédiée (src/lib/testOperationData.ts) :
// AUCUNE donnée réelle n'est lue ni modifiée (jamais Gambetta) — voir la
// section « FINALISATION » du brief : « aucune donnée Gambetta utilisée
// pour tester ; opération TEST dédiée ».
//
// Usage :
//   npm run e2e
// (démarre le serveur de dev sur un port dédié, attend qu'il réponde,
// exécute ce script, puis arrête le serveur — voir package.json.)
// Sortie non nulle si une assertion échoue.
// ────────────────────────────────────────────────────────────────────────────

import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5183'

async function main() {
  // PW_EXECUTABLE_PATH : pointe vers un binaire Chromium déjà installé
  // (utile dans un environnement où `npx playwright install` n'est pas
  // souhaitable — sinon Playwright télécharge/utilise le sien normalement).
  const browser = await chromium.launch(process.env.PW_EXECUTABLE_PATH ? { executablePath: process.env.PW_EXECUTABLE_PATH } : {})
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const pageErrors = []
  page.on('pageerror', err => pageErrors.push(err.message))
  page.on('dialog', d => d.accept())

  await page.addInitScript(() => {
    const user = { id: 'e2e', username: 'e2e', password: 'e2e', role: 'superadmin', displayName: 'E2E', createdAt: new Date().toISOString() }
    localStorage.setItem('sc-users-v1', JSON.stringify([user]))
    localStorage.setItem('sc-session-v1', JSON.stringify({ userId: 'e2e', at: new Date().toISOString() }))
  })

  const step = (label) => console.log(`→ ${label}`)

  // ── 1. Charger l'opération TEST (jamais Gambetta) ─────────────────────────
  step('Charger l’opération TEST — Validation Planning & Visite')
  await page.goto(`${BASE}/projets`, { waitUntil: 'networkidle' })
  await page.locator('button[title*="Validation Planning"]').click()
  await page.waitForTimeout(500)
  let bodyText = await page.locator('body').innerText()
  assert.ok(bodyText.includes('TEST'), 'le nom de l’opération TEST doit apparaître dans l’en-tête')
  assert.ok(!bodyText.includes('Gambetta'), 'aucune trace de Gambetta après avoir chargé l’opération TEST')

  await page.goto(`${BASE}/planning`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)

  // ── 2. Semaine = vue par défaut et unique, avec repères journaliers ───────
  step('Vue semaine par défaut, pas de vue "Jour" séparée')
  assert.equal(await page.locator('button[title="Jour"]').count(), 0, 'aucun bouton de vue "Jour" séparée')
  const zoomButtons = await page.locator('button[title="Semaine"], button[title="Mois"], button[title="Trimestre"]').count()
  assert.equal(zoomButtons, 3, 'seulement Semaine/Mois/Trimestre comme niveaux de zoom')

  // ── 3. Couleurs : terminée, en dépassement, bloquée (voir testOperationData.ts) ──
  step('Couleurs : tâche terminée (verte), en dépassement (rouge), bloquée (hachurée)')
  await page.locator('input[placeholder="Rechercher une tâche…"]').fill('Terrassement complet')
  await page.waitForTimeout(300)
  await page.locator('text=Terrassement complet').last().click()
  await page.waitForTimeout(300)
  bodyText = await page.locator('body').innerText()
  assert.match(bodyText, /100\s?%/, 'la tâche "Terrassement complet" doit afficher 100 %')
  await page.mouse.click(700, 50) // ferme le panneau détail (clic sur le fond)
  await page.waitForTimeout(200)

  // ── 4. Vue Par lots / Par logements ────────────────────────────────────────
  step('Bascule Par lot ↔ Par logement')
  await page.locator('input[placeholder="Rechercher une tâche…"]').fill('')
  await page.waitForTimeout(200)
  await page.locator('button', { hasText: 'Par logement' }).click()
  await page.waitForTimeout(400)
  bodyText = await page.locator('body').innerText()
  assert.ok(bodyText.includes('Logement A-101'), 'le logement A-101 apparaît en vue Par logement')
  assert.ok(bodyText.includes('Logement B-01'), 'le logement B-01 apparaît en vue Par logement')
  await page.locator('button', { hasText: 'Par lot' }).click()
  await page.waitForTimeout(300)

  // ── 5. Création de tâche depuis le Planning ────────────────────────────────
  step('Création d’une tâche depuis le Planning')
  await page.locator('button', { hasText: 'Tâche' }).first().click()
  await page.waitForTimeout(200)
  await page.locator('input[placeholder="Titre de la tâche"]').fill('E2E — tâche créée depuis planning')
  await page.locator('button', { hasText: 'Ajouter' }).first().click()
  await page.waitForTimeout(400)
  bodyText = await page.locator('body').innerText()
  assert.ok(bodyText.includes('E2E — tâche créée depuis planning'), 'la nouvelle tâche apparaît dans le Gantt')

  // ── 6. Création de sous-tâche depuis le Planning ───────────────────────────
  step('Création d’une sous-tâche depuis le Planning')
  await page.locator('input[placeholder="Rechercher une tâche…"]').fill('E2E — tâche créée depuis planning')
  await page.waitForTimeout(300)
  await page.locator('text=E2E — tâche créée depuis planning').last().click()
  await page.waitForTimeout(300)
  await page.locator('button', { hasText: 'Ajouter une sous-tâche' }).click()
  await page.waitForTimeout(200)
  await page.locator('input[placeholder="Titre de la sous-tâche"]').fill('E2E — sous-tâche')
  await page.locator('button', { hasText: 'Ajouter' }).first().click()
  await page.waitForTimeout(400)
  await page.mouse.click(700, 50)
  await page.waitForTimeout(200)
  await page.locator('input[placeholder="Rechercher une tâche…"]').fill('E2E — sous-tâche')
  await page.waitForTimeout(300)
  bodyText = await page.locator('body').innerText()
  assert.ok(bodyText.includes('E2E — sous-tâche'), 'la sous-tâche apparaît dans le Gantt')
  await page.locator('input[placeholder="Rechercher une tâche…"]').fill('')

  // ── 7. Dépendance finish-to-start ──────────────────────────────────────────
  step('Ajout d’une dépendance entre deux tâches')
  await page.locator('input[placeholder="Rechercher une tâche…"]').fill('Pose fenêtres B-01')
  await page.waitForTimeout(300)
  await page.locator('text=Pose fenêtres B-01').last().click()
  await page.waitForTimeout(300)
  const depBoxes = page.locator('input[placeholder="Rechercher une tâche…"]')
  await depBoxes.last().fill('Fondations')
  await page.waitForTimeout(300)
  await page.locator('text=Fondations').last().click()
  await page.waitForTimeout(300)
  bodyText = await page.locator('body').innerText()
  assert.ok(bodyText.includes('Fondations'), 'la dépendance ajoutée apparaît dans le panneau détail')
  await page.mouse.click(700, 50)
  await page.waitForTimeout(200)

  // ── 8. Chaînage Visite → Planning : mise à jour immédiate ─────────────────
  step('Chaînage Visite → Planning : une visite terminée met à jour le planning')
  await page.goto(`${BASE}/visite`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.locator('text=Nouvelle visite ou réunion').click()
  await page.waitForTimeout(400)
  await page.locator('text=Démarrer la visite').click()
  await page.waitForTimeout(500)
  await page.locator('text=Logement A-101').first().click()
  await page.waitForTimeout(400)
  await page.locator('text=LOT03 — LOT 03 — Menuiserie').first().click()
  await page.waitForTimeout(400)
  const slider = page.locator('input.task-slider').first()
  await slider.evaluate(el => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, '75')
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await page.waitForTimeout(300)
  await page.locator('a, button', { hasText: 'Tous les lots' }).click()
  await page.waitForTimeout(300)
  await page.locator('text=← Tableau de bord').click()
  await page.waitForTimeout(400)
  await page.locator('button', { hasText: 'Terminer et enregistrer' }).click()
  await page.waitForTimeout(600)

  await page.goto(`${BASE}/planning`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.locator('input[placeholder="Rechercher une tâche…"]').fill('Pose fenêtres A-101')
  await page.waitForTimeout(400)
  bodyText = await page.locator('body').innerText()
  assert.match(bodyText, /75\s?%/, 'le planning doit refléter immédiatement l’avancement relevé en visite (75 %)')

  console.log('done — all assertions passed')
  if (pageErrors.length) {
    console.error('Page errors detected during the run:', pageErrors)
    process.exitCode = 1
  }
  await browser.close()
}

main().catch(err => {
  console.error('E2E FAILED:', err)
  process.exitCode = 1
})
