# Suivi-Chantier V5

Application **mobile-first / PWA** de suivi de chantier bâtiment. Elle réunit,
pour une opération, le planning, les visites de terrain, les réserves, les
entreprises et les finances — pensée pour le **conducteur de travaux** comme pour
la **maîtrise d'ouvrage (MOA)** et la **maîtrise d'œuvre (MOE)**.

> État actuel : **prototype fonctionnel mono-poste**. Les données sont persistées
> localement dans le navigateur (`localStorage` + IndexedDB pour les photos).
> La synchronisation serveur (Supabase) est le prochain chantier — voir
> [Feuille de route](#feuille-de-route).

## Démarrer

```bash
npm install
npm run dev      # serveur de dev (http://localhost:5173)
npm run build    # tsc -b && vite build  → dist/
npm run preview  # sert le build
npm run lint     # eslint
npm run test     # vitest (suite complète)
```

Aucune variable d'environnement n'est requise pour lancer l'app en l'état :
elle fonctionne entièrement en local. Les variables `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` ne servent qu'au futur sprint backend et ne doivent
contenir que l'URL du projet et la **clé anon publique** (jamais `service_role`).

## Ce que fait l'application

| Module | Rôle |
|--------|------|
| **Accueil** | Tableau de bord : avancement, dérive, retards, réserves ; guide de configuration pour un projet neuf. |
| **Planning / Gantt** | Lots & tâches saisis à la main, dates contractuelles, CPM (chemin critique), semaines ISO, congés. Le contractuel *est* le prévisionnel ; le réel se cale sur l'avancement constaté. |
| **Visites** | Une session par visite : bâtiment → logement → lot → tâche, relevé d'avancement qui alimente le Gantt, notes, photos annotées, CR figé et diffusable. |
| **Bâtiments & zones** | Décrit la structure (bâtiments, niveaux, logements, communs) et rattache les tâches aux zones, dans les deux sens. |
| **Réserves** | Observations / actions, priorisées, localisées, photographiées, levées ou rouvertes ; sélection et suppression en lot. |
| **Entreprises** | Un lot, une entreprise, ses engagements et son historique. |
| **Finances** | Marchés, avenants, situations (facturé / payé / reste) ; DPGF quantitatif. |
| **Mes opérations** | Plusieurs chantiers par utilisateur ; création, bascule, projet d'exemple. |

Un **bouton « Charger un exemple »** (page *Mes opérations*) crée un projet fictif
pré-rempli (« Résidence Les Tilleuls ») pour découvrir l'app ou faire une démo.

## Architecture

- **React 18 + TypeScript + Vite 7**, PWA (`vite-plugin-pwa`). Pas de routeur :
  la navigation est un état React (`src/App.tsx`).
- **Frontière de persistance unique : `src/lib/repo.ts`.** C'est le *seul*
  endroit qui lit/écrit les données. Les composants n'accèdent jamais au
  stockage directement.
  - Données **cloisonnées par projet** : chaque clé métier est suffixée
    `…::<projectId>`. Basculer d'opération recharge tout, sans rien déplacer.
  - Clés **globales** (hors projet) : comptes, session, registre des projets,
    projet courant.
- **Domaine pur et testé** dans `src/lib/` : `schedule` (CPM, dérive, retards),
  `visits`, `planning`, `units`, `projects`, `reserves`, `commitments`,
  `finance`, `actualDates`, `selection`, `weeks`… — fonctions sans I/O,
  couvertes par vitest.
- **Sérialisation date-aware** (`src/lib/storage.ts`) : les `Date` survivent au
  round-trip JSON (marqueur `__date`). Réutilisée par le lien de partage MOA
  (`src/lib/share.ts`, compression lz-string dans le hash d'URL).
- **Auth (prototype)** : `src/lib/auth.ts` — contrôle d'accès **d'interface**,
  pas de sécurité. Comptes de test : `user`/`user`, `superadmin`/`superadmin`.

### Où brancher Supabase

Le backend est déjà modélisé côté Supabase (tables + RLS). L'intégration
consiste à remplacer le corps des fonctions de `repo.ts` par des requêtes
Supabase, derrière une couche de cache qui préserve l'API synchrone actuelle
(les composants restent inchangés). L'authentification passera par Supabase Auth,
et RLS (`auth.uid()`) fera respecter les droits côté serveur.

## Tests

```bash
npm run test
```

375+ tests unitaires (vitest), centrés sur le domaine pur et le câblage des
écrans clés. Toute logique métier nouvelle arrive avec ses tests.

## Déploiement

Build statique (`dist/`) déployable sur Vercel (SPA fallback via `vercel.json`).
`railway.toml` subsiste pour l'ancien hébergement.

## Feuille de route

- **P0 — Fondation** : Supabase Auth + RLS, migration de `repo.ts` vers le
  serveur (synchronisation multi-appareils).
- **P1 — Collaboration** : multi-utilisateurs réels, photos synchronisées,
  sauvegarde serveur.
- **P2 — Fonctionnel** : export PDF/impression des CR, import DPGF Excel,
  notifications d'échéances, vues Logement / Tâche dédiées.
- **P3 — Qualité** : tests end-to-end (Playwright), hors-ligne PWA robuste,
  thème sombre, i18n.

## Structure du dépôt

```
src/
  App.tsx                  orchestration, navigation, session, projets
  components/
    layout/                barres, navigation, menu de compte
    pages/                 un composant par écran
    gantt/ visite/ common/ briques réutilisables
  lib/                     domaine pur + repo.ts (persistance) + supabase.ts
  data/                    jeux d'essai (tests, imports)
  types/                   types partagés (GanttTask…)
```
