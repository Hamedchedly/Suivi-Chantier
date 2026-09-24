# MISSION GANTT — AUDIT INITIAL

**Date:** 2026-09-24  
**Branche:** mission-gantt-cleanup  
**Objectif:** Corriger et fiabiliser en profondeur le Gantt et le planning

## 1. BUG CRITIQUE — SLIDER D'AVANCEMENT

### Symptôme
Quand on sélectionne le slider de la première tâche et qu'on le déplace, la valeur ne modifie parfois pas la tâche sélectionnée mais une autre tâche plus bas dans le planning.

### Chaîne de données concernée
1. **pages/Gantt.tsx**
   - handleProgress() — ligne 202
   - mapTaskInList() — applique la mise à jour sur ganttTasks
   - ganttTasks state — source de vérité

2. **gantt/v2/Gantt.tsx** — orchestrateur
   - selectedId — gestion de la sélection — ligne 73
   - selectedTask — lookup depuis planningById — ligne 154
   - planningById — indexé depuis planningTasks — ligne 114
   - planningTasks — dérivé depuis tasks (props) via toPlanningTasks() — ligne 91
   - tasks (props) — displayTasks de pages/Gantt.tsx

3. **gantt/v2/GanttDetails.tsx** — panneau détail
   - onProgress callback — ligne 27
   - localProgress state — ligne 46
   - Slider — onMouseUp/onTouchEnd/onKeyUp — ligne 78-80

### Probable cause (hyp. 1) : Synthetic IDs en mode "Par logement"

**Problème :** En mode "Par logement", buildLogementTree() crée des tâches synthétiques avec IDs :
```typescript
`grp-lg-${z.id}-${lotId}` // e.g., "grp-lg-A-101-L03"
```

Ces IDs n'existent pas dans ganttTasks (source de vérité). Quand on sélectionne une tâche synthétique et qu'on appelle handleProgress() avec cet ID, mapTaskInList() ne trouve rien et ne modifie rien.

**Contre-vérification :** Mais le bug rapporte que quelque chose EST modifié, juste la mauvaise tâche. Donc ce n'est pas juste "rien ne change".

### Probable cause (hyp. 2) : Closure stale dans onProgress

**Problème :** Si GanttDetails ne se re-render pas quand selectedTask change, la closure onProgress capture un selectedTask.id obsolète.

**Vérification :**
- Ligne 322 : `key={selectedTask.id}` devrait forcer unmount/remount
- Mais il y a une useEffect à ligne 47 qui synce localProgress
- Et des callbacks à ligne 78-80 qui appellent onProgress

Si la clé change mais que le composant n'unmount pas correctement, la closure pourrait être stale.

### Probable cause (hyp. 3) : Race condition dans toPlanningTasks()

**Problème :** toPlanningTasks() transforme ganttTasks en planningTasks. Les IDs devrait être identiques, mais si cette transformation crée de nouveaux IDs ou reorder les tâches, il pourrait y avoir une divergence.

### À investiguer
1. ✓ Lire toPlanningTasks() et comprendre sa transformation
2. ✓ Lire planningEngine.ts pour voir si des IDs nouveaux sont créés
3. Créer un test de régression qui sélectionne A, modifie 50%, puis B, modifie 75%, puis vérify que A=50, B=75
4. Vérifier que selectedTask est correctement maintenu pendant les mises à jour
5. Vérifier que displayTasks vs ganttTasks ne divergent jamais sur les IDs

## 2. LOGIQUE DE REPLI DES TÂCHES TERMINÉES

### État actuel
- Collapse automatique au chargement des tâches 100% — ligne 139-144 (Gantt.tsx)
- collapseInitDone guard pour une seule exécution
- Mais pas de repli quand une tâche DEVIENT 100% après modification

### Problème
Un lot passe de 65% à 100%, mais il ne se replie pas automatiquement.

### À faire
1. Ajouter un useEffect qui collapse les tâches  qui deviennent 100%
2. Distinguer "état calculé terminé" vs "préférence d'affichage collapsed"
3. Permettre à l'utilisateur de rouvrir manuellement
4. Ne pas écras la préférence manuelle avec un useEffect trop agressif

## 3. HIÉRARCHIE LOT → TÂCHE → SOUS-TÂCHE

### État actuel
- GanttRowLabel affiche chevron + indentation
- buildLogementTree() crée une hiérarchie synthétique en mode "logement"
- Mais il y a ambiguïté entre affichage du Gantt et affichage de "Modifier le planning"

### Problème
La hiérarchie ne doit pas être dupliquée / divergente entre Gantt et PlanningConfig

### À faire
1. Auditer GanttRow* pour vérifier l'indentation et les chevrons
2. Auditer PlanningConfig pour vérifier qu'il respecte la même hiérarchie
3. Documenter où la hiérarchie est définie (une seule source de vérité)

## 4. N/A ≠ 0%

### État actuel
- is_na: true exclut une tâche du weightedProgress()
- Mais la chaîne affichage Gantt doit vérifier que N/A n'apparaît pas comme 0%

### À faire
1. Vérifier que GanttRow affiche N/A distinctement
2. Vérifier que weightedProgress exclut correctement N/A
3. Tests : 2 tâches 100% + 1 N/A → parent 100%

## 5. DÉPENDANCES BIDIRECTIONNELLES

### État actuel
- dependencies: string[] — IDs des tâches dont dépend celle-ci
- blocks?: string[] — IDs des tâches bloquées par celle-ci (symétrique) — types/gantt.ts:77

### Problème
Il faut une SOURCE DE VÉRITÉ unique. Si blocks est dérivé, il doit l'être systématiquement.

### À faire
1. Auditer si blocks est déduit ou stocké
2. Si dérivé, vérifier qu'il est cohérent partout (CPM, affichage, GanttDetails)
3. Un seul système de dépendances, pas deux

## 6. MODIFICATION DU PLANNING DIRECTEMENT DEPUIS LE GANTT

### État actuel
- Bouton "Plus" → configuration du planning — section 7 ou plus
- Mais pas de chemin direct "Modifier le planning"

### Demande
Ajouter un bouton "Modifier le planning" qui ouvre PlanningConfig pour l'opération courante.

### À faire
1. Ajouter un bouton dans Gantt.tsx (ou barre d'outils)
2. Navigation vers PlanningConfig avec le projectId
3. Retour auto au Gantt avec mise à jour immédiate

## 7. MEMOIZATION & PERFORMANCE

### État actuel
- React.memo sur GanttRowLabel, GanttRowTimeline, GanttBar
- sameRenderTask() — comparateur personnalisé
- flattenRows, indexById — optimisations

### Problème
Un comparateur "optimisé" peut devenir dangereux s'il oublie des dépendances.

### À faire
1. Auditer sameRenderTask() et vérifier qu'il compare tout
2. Vérifier que children, progress, status, dates, commitments, dependencies sont tous vérifiés
3. Tester que memoization n'empêche pas les mises à jour légitimes

## 8. CODE MORT & NETTOYAGE

### À chercher
1. Anciennes implémentations du Gantt (y a-t-il plusieurs Gantt.tsx?)
2. Callbacks devenues inutiles
3. États devenues inutiles
4. Imports inutilisés
5. Commentaires faux

### À faire
1. Supprimer tout ce qui n'est pas utilisé
2. Fusionner les systèmes parallèles
3. Documenter une seule source de vérité pour chaque concept

---

## Plan de travail

### Phase 1 : Tests de régression
- [ ] Créer test-slider.test.ts avec 3 tâches A/B/C
- [ ] Tester A→50%, B→75%, C→25%, puis vérifier valeurs
- [ ] Tester cycle sélection A→modif→fermer→sélection B→modif

### Phase 2 : Audit du slider bug
- [ ] Lire toPlanningTasks() complet
- [ ] Vérifier que selectedTask.id existe dans ganttTasks
- [ ] Créer diagnostic pour chaque hypothèse

### Phase 3 : Fix du slider bug
- [ ] Implémenter la correctif
- [ ] Passer tous les tests de régression

### Phase 4 : Repli automatique 100%
- [ ] Implémenter auto-collapse quand une tâche passe à 100%
- [ ] Tests

### Phase 5 : Hiérarchie & N/A & dépendances
- [ ] Vérifier et documenter

### Phase 6 : Nettoyage du code
- [ ] Supprimer code mort
- [ ] Fusionner systèmes parallèles

### Phase 7 : Validation technique
- [ ] npm test
- [ ] TypeScript
- [ ] Lint
- [ ] Build
- [ ] Tests spécifiques Gantt/planning

---

**Statut:** En cours (Phase 2/7)
**Avancement:**
- [x] Phase 1: Tests de régression setup
- [x] Phase 2: Fix bug slider + guards
- [x] Phase 3: Auto-collapse 100%
- [ ] Phase 4: Hiérarchie & N/A visibility
- [ ] Phase 5: Dépendances & bonds
- [ ] Phase 6: Nettoyage code mort
- [ ] Phase 7: Validation finale

**Changements effectués:**
1. ✓ Ajout guard dans handleProgress pour vérifier task ID existe en ganttTasks
2. ✓ Désactivation édition progress pour tâches avec children (parents synthétiques)
3. ✓ Auto-collapse implémenté pour tâches atteignant 100%

**Prochaine étape:** Vérifications hiérarchie et N/A visibility
