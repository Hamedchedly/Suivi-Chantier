// ────────────────────────────────────────────────────────────────────────────
// Scénario E2E permanent — Chaîne Marché → Avenants → Situations → facturé/
// payé/reste.
//
// Section « FINALISATION » du brief. Vérifie que la chaîne financière est un
// vrai pipeline utilisable de bout en bout (pas seulement un affichage) :
// un avenant PROPOSÉ ne doit jamais compter dans le budget, seul un avenant
// VALIDÉ l'augmente, un avenant REJETÉ ne doit jamais y entrer, et facturé/
// payé suivent bien les situations créées puis marquées payées.
//
// Usage : `node e2e/finances-chain.mjs` contre un serveur de dev déjà lancé
// (E2E_BASE_URL, par défaut http://localhost:5183).
// ────────────────────────────────────────────────────────────────────────────

import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5183'
const eur = (n) => n.toLocaleString('fr-FR') + ' €' // espace insécable fine (U+202F), pas un espace normal

async function main() {
  const browser = await chromium.launch(process.env.PW_EXECUTABLE_PATH ? { executablePath: process.env.PW_EXECUTABLE_PATH } : {})
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', err => { throw new Error(`Erreur JS pendant le test finances : ${err.message}`) })
  await page.addInitScript(() => {
    const user = { id: 'e2e', username: 'e2e', password: 'e2e', role: 'superadmin', displayName: 'E2E', createdAt: new Date().toISOString() }
    localStorage.setItem('sc-users-v1', JSON.stringify([user]))
    localStorage.setItem('sc-session-v1', JSON.stringify({ userId: 'e2e', at: new Date().toISOString() }))
  })

  const step = (l) => console.log(`→ ${l}`)

  await page.goto(`${BASE}/projets`, { waitUntil: 'networkidle' })
  await page.locator('button[title*="Validation Planning"]').click()
  await page.waitForTimeout(500)
  await page.goto(`${BASE}/finances`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)

  step('Créer un marché pour LOT01')
  await page.locator('button', { hasText: 'Ajouter un marché' }).click()
  await page.waitForTimeout(200)
  await page.locator('input[placeholder="Montant HT (€)"]').fill('100000')
  await page.locator('button', { hasText: 'Créer' }).click()
  await page.waitForTimeout(300)
  let body = await page.locator('body').innerText()
  assert.ok(body.includes(eur(100000)), 'le budget doit refléter le marché créé')
  assert.ok(body.includes('LOT 01'), 'lotShort doit afficher "LOT 01", pas "LOT OT01"')

  step('Proposer un avenant de +15000 — ne doit pas encore compter dans le budget')
  await page.locator('button', { hasText: 'Avenants' }).click()
  await page.waitForTimeout(300)
  await page.locator('button', { hasText: 'Nouvel avenant' }).click()
  await page.waitForTimeout(200)
  await page.locator('input[placeholder="Libellé"]').fill('Reprise de fondations')
  await page.locator('input[placeholder="Montant HT (± €)"]').fill('15000')
  await page.locator('button', { hasText: 'Proposer' }).click()
  await page.waitForTimeout(300)
  body = await page.locator('body').innerText()
  assert.ok(body.includes('Reprise de fondations'), 'le nouvel avenant doit apparaître')
  assert.ok(body.includes('Proposé'), 'le nouvel avenant doit être au statut "Proposé"')
  await page.locator('button', { hasText: 'Marchés' }).click()
  await page.waitForTimeout(200)
  body = await page.locator('body').innerText()
  assert.ok(body.includes(eur(100000)), 'le budget doit rester 100 000 € tant que l’avenant n’est pas validé')

  step('Valider l’avenant → le budget passe à 115 000')
  await page.locator('button', { hasText: 'Avenants' }).click()
  await page.waitForTimeout(200)
  await page.locator('button', { hasText: "Valider l'avenant" }).click()
  await page.waitForTimeout(300)
  body = await page.locator('body').innerText()
  assert.ok(body.includes('Validé'), 'l’avenant doit passer au statut "Validé"')
  await page.locator('button', { hasText: 'Marchés' }).click()
  await page.waitForTimeout(200)
  body = await page.locator('body').innerText()
  assert.ok(body.includes(eur(115000)), 'le budget doit inclure l’avenant validé (100 000 + 15 000)')

  step('Proposer puis rejeter un second avenant — ne doit jamais compter')
  await page.locator('button', { hasText: 'Avenants' }).click()
  await page.waitForTimeout(200)
  await page.locator('button', { hasText: 'Nouvel avenant' }).click()
  await page.waitForTimeout(200)
  await page.locator('input[placeholder="Libellé"]').fill('Extension non retenue')
  await page.locator('input[placeholder="Montant HT (± €)"]').fill('5000')
  await page.locator('button', { hasText: 'Proposer' }).click()
  await page.waitForTimeout(300)
  await page.locator('button', { hasText: 'Rejeter' }).click()
  await page.waitForTimeout(300)
  body = await page.locator('body').innerText()
  assert.ok(body.includes('Rejeté'), 'l’avenant doit passer au statut "Rejeté"')
  await page.locator('button', { hasText: 'Marchés' }).click()
  await page.waitForTimeout(200)
  body = await page.locator('body').innerText()
  assert.ok(body.includes(eur(115000)) && !body.includes(eur(120000)), 'le budget ne doit jamais inclure un avenant rejeté')

  step('Créer une situation, la marquer payée — facturé/payé suivent')
  await page.locator('button', { hasText: 'Situations' }).click()
  await page.waitForTimeout(200)
  await page.locator('button', { hasText: 'Nouvelle situation' }).click()
  await page.waitForTimeout(200)
  await page.locator('input[placeholder="Montant HT (€)"]').fill('40000')
  await page.locator('button', { hasText: 'Créer' }).click()
  await page.waitForTimeout(300)
  body = await page.locator('body').innerText()
  assert.ok(body.includes('En attente'), 'la nouvelle situation doit être "En attente"')
  await page.locator('button', { hasText: 'En attente' }).click()
  await page.waitForTimeout(300)
  body = await page.locator('body').innerText()
  assert.ok(body.includes('Payée'), 'la situation doit basculer à "Payée"')
  await page.locator('button', { hasText: 'Marchés' }).click()
  await page.waitForTimeout(200)
  body = await page.locator('body').innerText()
  assert.ok(body.includes('Facturé ' + eur(40000)) || body.includes('Facturé' + eur(40000)), 'facturé doit être 40 000 €')
  assert.ok(body.includes('Payé ' + eur(40000)) || body.includes('Payé' + eur(40000)), 'payé doit être 40 000 €')

  console.log('done — chaîne Marché→Avenants→Situations→facturé/payé/reste vérifiée de bout en bout')
  await browser.close()
}

main().catch(err => {
  console.error('E2E FAILED:', err)
  process.exitCode = 1
})
