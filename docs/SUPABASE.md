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

## Étapes restantes (dans l'ordre)

1. **Config** : `cp .env.example .env.local`, renseigner la clé publiable ; côté
   Vercel, définir `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
2. **Auth** (`src/lib/auth.ts` + `Login.tsx`) : quand `isSupabaseConfigured`,
   utiliser `supabase.auth.signInWithPassword` / `signUp` (e-mail + mot de passe)
   au lieu des comptes locaux. Conserver le mode démo local en repli.
3. **Hydratation** (`src/App.tsx`) : au montage, si une session existe, charger
   toutes les lignes `app_state` de l'utilisateur dans `localStorage` **avant**
   le premier rendu (écran de chargement bref).
4. **Write-through** (`src/lib/repo.ts`) : `saveState` écrit `localStorage` puis
   `upsert` dans `app_state` (débounce ~500 ms, file d'attente hors-ligne). Les
   lectures restent synchrones depuis le cache local — les composants ne changent
   pas.
5. **Multi-appareils** : `updated_at` + résolution « dernière écriture gagne » au
   niveau de la clé ; abonnement Realtime optionnel pour le temps réel.

## Sécurité

- Seules l'URL et la **clé publiable** vivent dans le frontend ; jamais
  `service_role`.
- RLS : chaque ligne est privée à son `user_id` (`= auth.uid()`).
- Aucun secret dans le dépôt (`.env.local` est ignoré par Git).
