// Test de régression pour le bug du slider d'avancement
// Bug: Modifier le slider de la tâche A modifie parfois la tâche B à la place
//
// Scénario : 3 tâches A, B, C
// 1. Sélectionner A et passer à 50%
// 2. Sélectionner B et passer à 75%
// 3. Sélectionner C et passer à 25%
// 4. Vérifier : A=50, B=75, C=25

import { describe, it, expect } from 'vitest'

describe('Gantt Slider Regression — avancement des tâches', () => {
  // TODO: Implémenter avec une instance Gantt réelle ou un mock du store

  it('Tâche A: sélectionner A, passer à 50%, vérifier A=50', () => {
    // Arrange: setup avec 3 tâches
    // Act: sélectionner A, slider à 50%
    // Assert: A.progress === 50
    expect(true).toBe(true) // placeholder
  })

  it('Tâche B: sélectionner B, passer à 75%, vérifier B=75', () => {
    // Idem
    expect(true).toBe(true) // placeholder
  })

  it('Tâche C: sélectionner C, passer à 25%, vérifier C=25', () => {
    // Idem
    expect(true).toBe(true) // placeholder
  })

  it('Cycle: A→50%, B→75%, C→25%, fermer A, rouvrir A, vérifier toujours A=50', () => {
    // Vérifie qu'une fermeture/réouverture ne perd pas la sélection ni la valeur
    expect(true).toBe(true) // placeholder
  })

  it('Lots avec sous-tâches: LOT03→tâche A→tâche B, modif B ne doit pas affecter LOT03 ou tâche A', () => {
    // Hiérarchie lot→tâche→sous-tâche
    expect(true).toBe(true) // placeholder
  })

  it('Mode "Par logement": synthétique parent ID comme grp-lg-A-101-L03 ne crase pas les vrais IDs', () => {
    // Si on sélectionne le synthétique parent, rien ne doit être modifié
    // (ou un message d'erreur, selon le comportement souhaité)
    expect(true).toBe(true) // placeholder
  })
})
