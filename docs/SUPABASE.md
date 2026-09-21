# Synchronisation Supabase — plan d'intégration

Objectif : **tout est synchronisé sur le serveur** (multi-appareils, sauvegarde),
sans réécrire les écrans. État : la **fondation est posée** (client, table de
sync + RLS, variables d'env) ; il reste le **câblage authentification + hydratation**,
décrit ici.

## Pourquoi l'auth est un prérequis

La table de sync (`app_state`) est protégée par RLS sur `auth.uid()`. Sans
utilisateur authentifié côté Supabase, aucune ligne ne peut être lue ni écrite.
La synchronisation **nécessite donc Supabase Auth** — l'auth « prototype »
actuelle (`src/lib/auth.ts`, comptes en `localStorage`) ne donne pas de session
serveur.

## Modèle de données retenu

`public.app_state (user_id, k, v jsonb, updated_at)` — une ligne par clé du
modèle local. La clé `k` reprend telle quelle les clés de `repo.ts`
(`sc-projects-v1`, `sc-gantt-v2::<projectId>`, …). Avantage : le miroir serveur
est **une copie 1:1** du modèle existant, la couche de sync reste mince, et les
tables métier normalisées (`operations`, `tasks`, …) restent disponibles pour un
usage analytique ou un futur back-office.

## Déjà en place (côté serveur, déployé)

- **`app_state`** — table de synchronisation clé-valeur (RLS `auth.uid()`).
- **`profiles`** — rôle (`user` / `superadmin`), `disabled`, `features[]`,
  `display_name`, e-mail. RLS : lecture de son profil, tout pour un super-admin ;
  écritures directes réservées au super-admin. Fonction `is_superadmin()` et
  trigger `handle_new_user` (provisionne un profil à l'inscription).
- **Fonction Edge `admin-users`** (ACTIVE, `verify_jwt`) — actions `list`,
  `create`, `setPassword`, `update`, `delete`, exécutées en service_role après
  vérification que l'appelant est super-admin. C'est le seul chemin pour créer un
  compte ou changer le mot de passe d'un autre utilisateur.
- **`src/lib/supabaseAuth.ts`** — adaptateur client : `signInEmail`,
  `signOutRemote`, `currentProfileUser`, `changeOwnPasswordRemote`, et les appels
  `admin*` vers la fonction Edge.

## Câblage interface — FAIT

Tout le câblage ci-dessous est implémenté et **vérifié par une vraie connexion**
sur le backend déployé (connexion, hydratation, write-through, suppression).

1. **Config** : `cp .env.example .env.local`, renseigner la clé publiable ; côté
   Vercel, définir `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`. ✅
2. **Amorçage** : premier super-admin créé (dashboard → Auth), profil promu
   (`update public.profiles set role='superadmin' …`). ✅
3. **Login** (`Login.tsx`) : formulaire e-mail + mot de passe → `signInEmail`
   quand `isSupabaseConfigured` ; repli local sinon. ✅
4. **Session** (`src/App.tsx`) : cycle de vie piloté par `onAuthChange`
   (INITIAL_SESSION / SIGNED_IN / SIGNED_OUT), écran de chargement. ✅
5. **Comptes / MonCompte** : branchés sur `adminListUsers/adminCreateUser/
   adminSetPassword/adminUpdateUser/adminDeleteUser` et `changeOwnPasswordRemote`. ✅
6. **Synchro données** (`src/lib/sync.ts`) : ✅
   - **Hydratation** à la connexion : `clearLocalAppState()` (jamais de mélange
     entre comptes sur un même navigateur) puis `hydrateFromRemote(uid)` recopie
     `app_state` dans localStorage (le serveur fait autorité).
   - **Write-through** débouncé (800 ms) : chaque `saveState`/`removeState`
     (observés via les notificateurs de `storage.ts`) est répercuté en
     `upsert`/`delete` sur `app_state`. Les lectures des composants sont
     inchangées (localStorage = cache synchrone).
   - Résilience : file conservée en cas d'échec réseau, backoff exponentiel
     plafonné ; `v` est nullable (une valeur `null` légitime ne fait plus
     échouer le lot).
   - Clés `sc-users-v1` / `sc-session-v1` **exclues** (gérées par Supabase Auth).

## Limite connue — confirmée en direct sur la base réelle (21/09/2026)

L'hydratation fusionne bien clé par clé par horodatage (`initRemoteSession`,
`sync.ts`) — ce paragraphe a été corrigé, la version précédente de ce document
affirmait à tort qu'aucune fusion n'existait.

La vraie limite, **prouvée contre la base Supabase de production** (compte de
test jetable, requêtes SQL exécutées avec `role authenticated` + `request.jwt.claims`
pour respecter RLS comme le ferait le vrai front, aucune trace laissée après
coup) : la granularité de sync est la **clé entière**, jamais le champ. Deux
appareils EN LIGNE tous les deux, partis du même état, qui modifient chacun un
champ différent d'un même enregistrement, puis flushent chacun leur copie
locale complète : le second `upsert` écrase intégralement la valeur du
premier, y compris le champ que le second appareil n'a jamais touché — sans
erreur, sans conflit visible, la donnée est juste perdue silencieusement.
Scénario rejoué tel quel :
1. État initial poussé : Tâche A `in_progress/50`, Tâche B `not_started/0`.
2. Appareil 1 : Tâche A → `done/100`, flush (upsert de tout le tableau).
3. Appareil 2 (resté sur l'état initial) : Tâche B → `blocked`, flush.
4. Lecture finale : Tâche A repasse `in_progress/50` (la mise à jour de
   l'appareil 1 a disparu), Tâche B est bien `blocked`.

Seule protection avant flush : l'auteur du bug 3 plus haut (unicité de la
tâche visée). Pour deux tâches différentes de la même opération, rien
n'empêche la perte. `sync.test.ts` documentait déjà ce comportement contre un
mock ; c'est désormais vérifié contre la vraie base. Correction possible sans
réécrire le modèle : réduire la granularité de `k` (une ligne par tâche plutôt
que par opération) pour les domaines à forte contention, ou un merge JSON
côté `flush()` avant l'upsert.

## Sécurité

- Seules l'URL et la **clé publiable** vivent dans le frontend ; jamais
  `service_role`.
- RLS : chaque ligne est privée à son `user_id` (`= auth.uid()`).
- Aucun secret dans le dépôt (`.env.local` est ignoré par Git).

### Compte créé « en attente » — le trigger seul ne suffit pas (vérifié 21/09/2026)

`public.profiles.disabled` a `DEFAULT false`, et le trigger `handle_new_user()`
insère la ligne de profil sans jamais fixer `disabled` — vérifié en créant un
utilisateur réel dans `auth.users` : son profil sort du trigger avec
`disabled = false`. La mise en attente (« compte créé, en attente de
validation ») n'est donc appliquée **que côté applicatif**, par la fonction Edge
`demo-signup` (`UPDATE profiles SET disabled = true` juste après
`admin.auth.admin.createUser`) — jamais au niveau de la base ou du trigger.

Tant que seule cette fonction Edge crée des comptes, le comportement observé
est correct. Mais si l'auto-inscription native de Supabase Auth
(`supabase.auth.signUp`, joignable avec la seule clé publiable, activée par
défaut sauf désactivation explicite dans Authentication → Providers → Email)
est encore ouverte sur ce projet, n'importe qui peut créer un compte **déjà
activé** en contournant entièrement `demo-signup` et la validation
super-admin — la base ne s'y oppose pas. Non vérifiable en SQL (c'est un
réglage de la plateforme Auth, pas une table) : à confirmer dans le dashboard
Supabase. Si l'auto-inscription native est ouverte, la couvrir en profondeur
est peu coûteux : `alter table public.profiles alter column disabled set default true;`
et faire pointer `handle_new_user()` sur cette valeur par défaut au lieu de
compter sur la fonction Edge seule.
