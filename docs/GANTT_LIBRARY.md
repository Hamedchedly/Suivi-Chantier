# COMPARAISON LIBRAIRIES GANTT OPEN SOURCE

> Étude réalisée pour choisir la base du moteur Gantt — Septembre 2026  
> Stack cible : React 19 + TypeScript + Supabase

---

## Critères d'évaluation

| Critère | Poids | Raison |
|---|---|---|
| Licence open source | Éliminatoire | Pas de coûts cachés en prod |
| React 19 compatible | Éliminatoire | Stack du projet |
| Drag & drop natif | Critique | CDC §13 |
| Dépendances FS/SS/FF/SF | Critique | CDC §14 |
| WBS / hiérarchie | Critique | CDC §12 |
| Jalons | Haute | CDC §16 |
| Zoom / scroll | Haute | CDC §13 |
| Baseline / comparaison | Haute | CDC §17 |
| Customisation visuelle | Haute | Identité produit |
| Activité maintenue | Haute | Pérénnité |
| CPM intégré | Souhaitable | On peut l'ajouter |
| Export PDF | Souhaitable | CDC §63 |

---

## 1. `gantt-task-react`

**Repo :** https://github.com/MaTeMaTuK/gantt-task-react  
**Licence :** MIT ✅  
**Stars :** ~4 200 | **Dernière release :** 2024  
**Taille bundle :** ~120 KB gzippé

### Points forts
- React natif, TypeScript first
- SVG rendering (pas canvas — lisible et accessible)
- Drag & drop sur les barres ✅
- Resize des barres ✅
- Dépendances (flèches FS uniquement nativement) ⚠️
- WBS / task grouping ✅
- Jalons (`isMilestone`) ✅
- Vue liste + Gantt côte à côte ✅
- Scroll horizontal + zoom ✅
- Personnalisation complète via props TypeScript

### Limites
- Dépendances limitées à FS nativement (SS/FF/SF nécessitent fork ou override)
- Pas de CPM natif (à implémenter dans `src/lib/cpm.ts`)
- Pas de baseline intégrée (à afficher en double-barres custom)
- Drag vertical entre swimlanes : partiel (à implémenter)
- Export PDF : via `html2canvas` ou `jspdf` en surcouche

### Estimation intégration
- Rendu de base fonctionnel : **2–3 jours**
- Drag/resize opérationnel sur données Supabase : **+2 jours**
- Dépendances SS/FF/SF en override : **+3 jours**
- Total phase 2 socle : ~1 semaine

---

## 2. `frappe-gantt`

**Repo :** https://github.com/frappe/gantt  
**Licence :** MIT ✅  
**Stars :** ~3 800 | **Dernière release :** 2024  
**Taille bundle :** ~80 KB gzippé

### Points forts
- Très léger, SVG
- Belles animations
- Dépendances visuelles avec flèches
- Zoom natif (quart jour / demi-jour / jour / semaine / mois)
- Drag & drop ✅

### Limites
- **Pas React natif** — wrapper non officiel à utiliser (risque de désync)
- Pas de WBS / hiérarchie
- Pas de jalons natifs
- Dépendances FS seulement
- Personnalisation plus limitée
- Adapté aux Gantt simples, pas aux projets complexes

### Estimation intégration
- Wrapper React + données Supabase : **3–4 jours**
- Ajout WBS : impossible sans réécriture majeure ❌
- **Verdict : trop limité pour le CDC**

---

## 3. `@dhtmlx/trial-react-gantt` (dhtmlxGantt)

**Repo :** https://github.com/DHTMLX/react-gantt  
**Licence :** Commercial (trial gratuit) ❌ → **Éliminé**

> La version complète nécessite une licence (~$600/dev/an). Fonctionnellement parfaite mais incompatible avec l'objectif open source du projet.

---

## 4. DingPlan (adaptation)

**Repo :** https://github.com/realworldbuilder/dingplan  
**Licence :** MIT ✅  
**Stars :** ~1 800 | **Dernière release :** 2024

### Points forts
- Canvas rendering (performances maximales pour grands plannings)
- Architecture très proche du CDC (tâches, swimlanes, dépendances, CPM, baseline, WBS, jalons, ressources)
- AI Composer intégré (futur)
- Export XER (Primavera) + PDF
- Exactement la référence citée dans le CDC

### Limites
- **Pas une librairie** — c'est une application complète, pas un composant React réutilisable
- Nécessite extraction et réarchitecturage des composants Gantt
- Stack potentiellement différente (à vérifier)
- Coût d'intégration élevé : **8–15 jours** pour en extraire un composant propre
- Risque de maintenance : fork custom à maintenir

### Verdict
Utiliser DingPlan comme **référence de design et de concepts** (swimlanes, structure WBS, CPM, baseline), mais ne pas l'intégrer directement comme librairie.

---

## 5. Solution canvas maison (option DingPlan-inspired)

Construire un moteur Gantt Canvas à partir de zéro, en s'inspirant des concepts de DingPlan.

### Avantages
- Contrôle total sur le rendu
- Performances canvas maximales
- Exactement adapté au modèle de données Supabase existant

### Inconvénients
- **Délai : 4–6 semaines** pour un Gantt robuste
- Complexité : hit-testing, scroll, zoom, drag sur canvas sont difficiles à bien faire
- Risque de bugs long à corriger

### Verdict
Option à retenir **uniquement si** `gantt-task-react` s'avère insuffisant après 2 sprints.

---

## 6. `react-gantt-chart` (brianium)

**Repo :** https://github.com/brianium/react-gantt  
**Licence :** MIT ✅  
**Stars :** ~500 | **Dernière release :** 2022 (abandonné) ❌

---

## Décision recommandée

### 🥇 Phase 2 (MVP Gantt) : `gantt-task-react`

**Raisons :**
1. React 19 + TypeScript natif, zéro friction d'intégration
2. Drag & drop + resize + dépendances visuelles out-of-the-box
3. WBS et jalons natifs
4. SVG rendering = accessible, imprimable, exportable PDF sans canvas tricks
5. API TypeScript claire, facile à connecter à Supabase
6. Délai d'intégration raisonnable (~1 semaine pour le socle)
7. MIT — pas de coûts cachés en production

**Ce qu'on ajoutera par-dessus :**
- CPM (moteur dans `src/lib/cpm.ts` — algorithme topologique maison)
- Dépendances SS/FF/SF (extension de la config de flèches)
- Baseline (double-barre custom via `TaskListHeader` + `TooltipContent`)
- Swimlanes par lot (utilisation des groupes existants)
- Export PDF (jspdf + html2canvas sur le composant SVG)

### 🥈 Phase 3+ (si besoin performances) : Canvas maison inspiré DingPlan

Si le planning dépasse 500 tâches et que les performances SVG se dégradent, migrer vers un rendu canvas. DingPlan servira alors de référence architecturale.

---

## Plan d'intégration `gantt-task-react`

### Semaine 1 — Socle
```bash
npm install gantt-task-react
```

```typescript
// src/components/gantt/GanttPanel.tsx
import { Gantt, Task, ViewMode } from 'gantt-task-react'
import 'gantt-task-react/dist/index.css'

// Mapping ScheduleItem → Task (format gantt-task-react)
function toGanttTask(item: ScheduleItem, lots: Lot[]): Task {
  return {
    id: item.id,
    name: item.title,
    start: item.planned_start ? new Date(item.planned_start) : new Date(),
    end: item.planned_end ? new Date(item.planned_end) : new Date(),
    progress: item.progress ?? 0,
    type: item.is_milestone ? 'milestone' : item.parent_id ? 'task' : 'project',
    project: item.parent_id ?? undefined,
    dependencies: [], // rempli depuis schedule_dependencies
    isDisabled: false,
    styles: {
      progressColor: item.is_critical ? '#ef4444' : '#3b82f6',
      progressSelectedColor: item.is_critical ? '#dc2626' : '#2563eb',
    }
  }
}
```

### Semaine 2 — Dépendances + Drag/Drop
- Connecter `schedule_dependencies` aux flèches
- Implémenter `onDateChange` (mise à jour Supabase)
- Implémenter `onProgressChange`
- Swimlanes par lot via groupes

### Semaine 3 — CPM + Baseline
- Moteur CPM dans `src/lib/cpm.ts`
- Affichage baseline (barre grisée en dessous)
- Coloration chemin critique (rouge)

---

## Références visuelles DingPlan à s'inspirer

Sans copier le code, les éléments visuels de DingPlan à reproduire :

| Élément DingPlan | Implémentation |
|---|---|
| Swimlanes colorées par lot | Groupes `gantt-task-react` + CSS lot |
| Flèches de dépendances courbes | Natif `gantt-task-react` |
| Barre baseline grisée | Double rendu via `TaskListHeader` custom |
| Tâches critiques en rouge | `styles.progressColor` conditionnel |
| Colonne WBS gauche | `taskListComponent` custom |
| Zoom jour/semaine/mois | `ViewMode` natif |
| Jalon losange | `type: 'milestone'` natif |

---

*Ce document guide le choix technique — à mettre à jour après le spike d'intégration de la Phase 2.*
