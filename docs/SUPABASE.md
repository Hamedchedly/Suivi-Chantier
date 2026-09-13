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

## Limite connue

Modèle **serveur-autoritaire** à l'hydratation : une édition faite **hors-ligne**
puis écrasée par l'état serveur au rechargement n'est pas fusionnée (pas de
résolution de conflit par horodatage). Acceptable pour un usage mono-session en
ligne ; à renforcer si l'usage hors-ligne devient courant.

## Sécurité

- Seules l'URL et la **clé publiable** vivent dans le frontend ; jamais
  `service_role`.
- RLS : chaque ligne est privée à son `user_id` (`= auth.uid()`).
- Aucun secret dans le dépôt (`.env.local` est ignoré par Git).
