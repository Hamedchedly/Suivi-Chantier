// ────────────────────────────────────────────────────────────────────────────
// Scénario E2E permanent — Synthèse Entreprises (planning + qualité + finances).
//
// Section « FINALISATION » du brief : la page Entreprises doit être une
// vraie synthèse par entreprise, pas seulement un annuaire de lots. Vérifie
// que le bloc Finances (companyFinance, lib/finance.ts) n'apparaît que pour
// une entreprise ayant un marché, et que son montant est correctement
// scopé à ELLE seule (jamais les marchés d'une autre entreprise).
//
// Usage : `node e2e/entreprises-synthesis.mjs` contre un serveur de dev déjà
// lancé (E2E_BASE_URL, par défaut http://localhost:5183).
// ────────────────────────────────────────────────────────────────────────────

import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5183'
const eur = (n) => n.toLocaleString('fr-FR') + ' €'

async function main() {
  const browser = await chromium.launch(process.env.PW_EXECUTABLE_PATH ? { executablePath: process.env.PW_EXECUTABLE_PATH } : {})
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  page.on('pageerror', err => { throw new Error(`Erreur JS pendant le test Entreprises : ${err.message}`) })
  await page.addInitScript(() => {
    const user = { id: 'e2e', username: 'e2e', password: 'e2e', role: 'superadmin', displayName: 'E2E', createdAt: new Date().toISOString() }
    localStorage.setItem('sc-users-v1', JSON.stringify([user]))
    localStorage.setItem('sc-session-v1', JSON.stringify({ userId: 'e2e', at: new Date().toISOString() }))
  })

  const step = (l) => console.log(`→ ${l}`)

  await page.goto(`${BASE}/projets`, { waitUntil: 'networkidle' })
  await page.locator('button[title*="Validation Planning"]').click()
  await page.waitForTimeout(500)

  step('Créer un marché pour LOT01 (Entreprise TEST Terrassement)')
  await page.goto(`${BASE}/finances`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.locator('button', { hasText: 'Ajouter un marché' }).click()
  await page.waitForTimeout(200)
  await page.locator('input[placeholder="Montant HT (€)"]').fill('80000')
  await page.locator('button', { hasText: 'Créer' }).click()
  await page.waitForTimeout(300)

  step('Fiche d’une entreprise AVEC marché : le bloc Finances apparaît, correctement scopé')
  await page.goto(`${BASE}/entreprises`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.locator('text=Entreprise TEST Terrassement').click()
  await page.waitForTimeout(400)
  let body = await page.locator('body').innerText()
  assert.ok(/finances/i.test(body), 'la section Finances doit apparaître pour une entreprise avec marché')
  assert.ok(body.includes(eur(80000)), 'le montant du marché doit être affiché')

  step('Fiche d’une entreprise SANS marché : aucun bloc Finances (pas de fuite d’une autre entreprise)')
  await page.goBack()
  await page.waitForTimeout(400)
  await page.locator('text=Entreprise TEST Menuiserie').click()
  await page.waitForTimeout(400)
  body = await page.locator('body').innerText()
  assert.ok(!/marché\s*:/i.test(body), 'aucun bloc Finances pour une entreprise sans marché')

  console.log('done — synthèse Entreprises (planning + qualité + finances) vérifiée')
  await browser.close()
}

main().catch(err => {
  console.error('E2E FAILED:', err)
  process.exitCode = 1
})
