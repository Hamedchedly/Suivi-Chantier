# Suivi-Chantier V5

Application mobile-first/PWA de suivi de chantier, conçue pour gérer plusieurs opérations configurables et se connecter à Supabase.

## Démarrer

1. Créez un projet Supabase puis exécutez la migration dans `supabase/migrations/` (Supabase CLI ou SQL Editor).
2. Copiez `.env.example` en `.env` et renseignez l’URL et la clé anon du projet. Ne versionnez jamais ce fichier.
3. Installez puis lancez l’application :

```bash
npm install
npm run dev
```

## Socle livré

- liste et création d’opérations depuis PostgreSQL via Supabase, sans jeu de données codé en dur ;
- modèle SQL initial multi-opération : membres, niveaux configurables, lots, tâches et observations ;
- politiques RLS et historique append-only des observations ;
- PWA installable avec mise à jour automatique et navigation mobile-first.

Les médias (photos, vidéos, PDF) ne doivent jamais être ajoutés au dépôt : ils sont destinés à Supabase Storage.
