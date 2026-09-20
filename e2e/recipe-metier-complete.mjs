// ────────────────────────────────────────────────────────────────────────────
// Scénario E2E permanent — Recette métier complète sur l'opération TEST.
//
// Parcourt le cycle métier de bout en bout, sur l'opération TEST dédiée
// (src/lib/testOperationData.ts) : AUCUNE donnée réelle n'est lue ni modifiée
// (jamais Gambetta) :
//   visite → logement → lot → avancement 0→50→100→60 → création tâche →
//   création sous-tâche → observation → action → blocage → N/A →
//   retour logement → clôture (snapshot CR) → planning → forecast → dashboard
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
  const setSlider = async (locator, value) => {
    await locator.evaluate((el, v) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(el, String(v))
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }, value)
  }

  step('Charger opération TEST')
  await page.goto(`${BASE}/projets`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.locator('button[title*="Validation Planning"]').click()
  await page.waitForTimeout(500)

  step('Démarrer une visite')
  await page.goto(`${BASE}/visite`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.locator('text=Nouvelle visite ou réunion').click()
  await page.waitForTimeout(400)
  await page.locator('text=Démarrer la visite').click()
  await page.waitForTimeout(500)

  step('Logement A-101 -> LOT03 -> Pose fenêtres A-101 : avancement 0 -> 50 -> 100 -> 60')
  await page.locator('text=Logement A-101').first().click()
  await page.waitForTimeout(400)
  await page.locator('text=LOT03 — LOT 03 — Menuiserie').first().click()
  await page.waitForTimeout(400)

  const slider = page.locator('input.task-slider').first()
  await setSlider(slider, 50)
  await page.waitForTimeout(300)
  let body = await page.locator('body').innerText()
  assert.match(body, /50\s?%/, '50% doit apparaître après le premier passage du curseur')

  await setSlider(slider, 100)
  await page.waitForTimeout(300)
  body = await page.locator('body').innerText()
  assert.match(body, /100\s?%/, '100% doit apparaître')

  await setSlider(slider, 60)
  await page.waitForTimeout(300)
  body = await page.locator('body').innerText()
  assert.match(body, /60\s?%/, '60% doit apparaître après être redescendu depuis 100%')
  assert.ok(!body.includes('Terminé'), 'le badge de tournée ne doit jamais dire "Terminé" (mesure la tournée de contrôle, pas l’avancement physique)')

  step('Création tâche depuis la visite (LOT03)')
  await page.locator('button', { hasText: 'Ajouter une tâche à ce lot' }).click()
  await page.waitForTimeout(300)
  await page.locator('input[placeholder="Intitulé de la tâche"]').fill('E2E — tâche créée pendant visite')
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
  await page.waitForTimeout(400)
  body = await page.locator('body').innerText()
  assert.ok(body.includes('E2E — tâche créée pendant visite'), 'la nouvelle tâche doit apparaître dans le lot')
  assert.match(body, /Tâches \d\/7/, 'le compteur de tâches du logement doit passer à 7 (6 + la nouvelle)')

  step('Création sous-tâche depuis la visite, sur la tâche qu’on vient de créer')
  await page.locator('button[title="Ajouter une sous-tâche"]').first().click()
  await page.waitForTimeout(300)
  await page.locator('input[placeholder="Intitulé de la sous-tâche"]').fill('E2E — sous-tâche visite')
  await page.locator('button', { hasText: 'Ajouter' }).first().click()
  await page.waitForTimeout(400)
  body = await page.locator('body').innerText()
  assert.ok(body.includes('E2E — sous-tâche visite'), 'la sous-tâche doit être créée')

  // Vérifier dans le vrai planning que la tâche et la sous-tâche existent (pas un faux positif d'UI).
  const projectId = await page.evaluate(() => localStorage.getItem('sc-current-project-v1')?.replace(/^"|"$/g, ''))
  const rawGantt = await page.evaluate((pid) => localStorage.getItem(`sc-gantt-v2::${pid}`), projectId)
  const ganttTasks = JSON.parse(rawGantt)
  const lot03 = ganttTasks.find(t => t.lot_id === 'LOT03')
  const newTask = lot03.children.find(c => c.title === 'E2E — tâche créée pendant visite')
  assert.ok(newTask, 'la tâche doit exister dans le vrai planning (pas seulement à l’écran)')
  assert.ok(newTask.children?.some(c => c.title === 'E2E — sous-tâche visite'), 'la sous-tâche doit exister comme vrai enfant de la tâche dans le planning')

  step('Retour logement -> LOT02 (Fondations / Élévation R+1 / Dalle R+2)')
  await page.locator('button', { hasText: 'Tous les lots' }).click()
  await page.waitForTimeout(300)
  await page.locator('text=LOT02 — LOT 02 — Gros œuvre').first().click()
  await page.waitForTimeout(400)

  step('Action sur "Fondations" (Alerte, avec échéance)')
  await page.getByRole('button', { name: 'Alerte', exact: true }).nth(0).click()
  await page.waitForTimeout(300)
  await page.locator('textarea[placeholder*="Reprendre le joint"]').fill('E2E — Action : reprendre le ferraillage avant coulage')
  await page.locator('input[type="date"]').last().fill('2026-10-01')
  await page.locator('button', { hasText: 'Enregistrer' }).click()
  await page.waitForTimeout(400)
  body = await page.locator('body').innerText()
  assert.ok(body.includes('E2E — Action : reprendre le ferraillage avant coulage'), 'l’action doit apparaître sous la tâche Fondations')

  step('Blocage sur "Élévation R+1"')
  await page.locator('button', { hasText: 'Blocage' }).nth(1).click()
  await page.waitForTimeout(300)
  await page.locator('text=LOT01 — LOT 01 — Terrassement').click()
  await page.waitForTimeout(300)
  await page.locator('button', { hasText: 'Réception terrassement' }).first().click()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: 'Terminé', exact: true }).click()
  await page.waitForTimeout(400)
  body = await page.locator('body').innerText()
  assert.ok(body.includes('Bloqué'), 'l’état de la tâche doit refléter le blocage')

  step('Observation sur "Dalle R+2" (Note, non importante)')
  await page.getByRole('button', { name: 'Note', exact: true }).last().click()
  await page.waitForTimeout(300)
  await page.locator('textarea[placeholder="Saisir une note…"]').fill('E2E — Observation : légère fissure superficielle constatée')
  await page.getByRole('button', { name: 'Ajouter', exact: true }).last().click()
  await page.waitForTimeout(400)
  body = await page.locator('body').innerText()
  assert.ok(body.includes('E2E — Observation : légère fissure superficielle constatée'), 'l’observation doit apparaître sous Dalle R+2')

  step('Retour logement -> LOT01 -> N/A sur "Réception terrassement"')
  await page.locator('button', { hasText: 'Tous les lots' }).click()
  await page.waitForTimeout(300)
  await page.locator('text=LOT01 — LOT 01 — Terrassement').first().click()
  await page.waitForTimeout(400)
  await page.locator('button[title="Plus d’options"], button[title="Plus d\'options"]').first().click()
  await page.waitForTimeout(300)
  await page.locator('button', { hasText: 'Marquer N/A' }).click()
  await page.waitForTimeout(400)
  body = await page.locator('body').innerText()
  assert.ok(body.includes('N/A'), 'la tâche doit être marquée N/A')
  assert.ok(body.includes('non concerné'), 'le message N/A doit expliquer l’exclusion du calcul d’avancement')

  step('Retour tournée -> clôture de la visite')
  await page.locator('button', { hasText: 'Tous les lots' }).click()
  await page.waitForTimeout(300)
  await page.locator('text=← Tableau de bord').click()
  await page.waitForTimeout(400)
  const beforeClose = await page.locator('body').innerText()
  assert.ok(!beforeClose.includes('u-test-A101'), 'le relevé de session ne doit jamais afficher l’id brut de zone')
  assert.ok(beforeClose.includes('Logement A-101'), 'le relevé doit afficher le libellé humain du logement')

  step('Clôture de la visite')
  await page.locator('button', { hasText: 'Terminer et enregistrer' }).click()
  await page.waitForTimeout(600)
  body = await page.locator('body').innerText()
  assert.ok(body.includes('Logement A-101 (A-101)'), 'le CR figé doit aussi porter le libellé humain, pas l’id brut')
  assert.ok(body.includes('Entreprise TEST Gros Œuvre'), 'toutes les entreprises touchées doivent être listées')
  assert.ok(body.includes('Entreprise TEST Menuiserie'), 'toutes les entreprises touchées doivent être listées')
  assert.ok(body.includes('Entreprise TEST Terrassement'), 'toutes les entreprises touchées doivent être listées')

  step('Planning : vérifier que tout ce qui a été fait en visite s’y reflète')
  await page.goto(`${BASE}/planning`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  await page.locator('input[placeholder="Rechercher une tâche…"]').fill('Pose fenêtres A-101')
  await page.waitForTimeout(300)
  body = await page.locator('body').innerText()
  assert.match(body, /60\s?%/, 'Pose fenêtres A-101 doit être à 60% dans le planning après clôture')

  await page.locator('input[placeholder="Rechercher une tâche…"]').fill('Élévation R+1')
  await page.waitForTimeout(300)
  await page.locator('text=Élévation R+1').last().click()
  await page.waitForTimeout(300)
  body = await page.locator('body').innerText()
  assert.ok(body.includes('Bloqué') || body.includes('bloqué'), 'Élévation R+1 doit apparaître bloquée dans le planning après clôture')
  await page.mouse.click(700, 50)
  await page.waitForTimeout(200)

  await page.locator('input[placeholder="Rechercher une tâche…"]').fill('Réception terrassement')
  await page.waitForTimeout(300)
  await page.locator('text=Réception terrassement').last().click()
  await page.waitForTimeout(300)
  body = await page.locator('body').innerText()
  assert.match(body, /40\s?%/, 'Réception terrassement (marquée N/A pendant la visite) doit garder son avancement d’origine (40%), jamais être remis à zéro ni faussé')

  step('Forecast : Analyse du planning après ces changements')
  await page.mouse.click(700, 50) // ferme le panneau détail resté ouvert
  await page.waitForTimeout(200)
  await page.locator('input[placeholder="Rechercher une tâche…"]').first().fill('')
  await page.waitForTimeout(200)
  await page.locator('button', { hasText: 'Analyse' }).click()
  await page.waitForTimeout(400)
  body = await page.locator('body').innerText()
  assert.match(body, /\b3\b[\s\S]{0,20}En dérive|En dérive[\s\S]{0,10}\b3\b/, 'l’analyse doit compter les tâches en dérive (Élévation R+1 bloquée, Réception terrassement en retard, +1)')
  assert.ok(body.includes('LOT 01') && body.includes('LOT 02') && body.includes('LOT 03'), 'les 3 lots touchés doivent apparaître dans les principaux écarts')

  step('Dashboard : reflète blocage, retard, actions ouvertes, avancement')
  await page.mouse.click(700, 50) // ferme le panneau Analyse resté ouvert
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: 'Accueil', exact: true }).click()
  await page.waitForTimeout(400)
  body = await page.locator('body').innerText()
  assert.ok(body.includes('Élévation R+1 bloquée'), 'la section Risques chantier doit signaler le point bloquant (Élévation R+1)')
  assert.ok(/actions ouvertes[\s\S]{0,10}1/i.test(body), 'l’action créée pendant la visite doit compter comme action ouverte')
  assert.ok(/observations ouvertes[\s\S]{0,10}1/i.test(body), 'l’observation créée pendant la visite doit compter comme observation ouverte')

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
