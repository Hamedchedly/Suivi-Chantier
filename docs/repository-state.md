# État réel du dépôt — vérification V5

Vérification effectuée sur `feature/v5-data-validation`.

## Références Git disponibles

- `main` est absent du clone local ; aucune modification ne peut lui être appliquée.
- `work` pointe sur `52c2093`.
- `feature/v5-connected` contient `98996b6` et `f1f3628` au-dessus de `52c2093`.
- `feature/v5-data-validation` contient `418ff47` et `d04fbaf` au-dessus de `52c2093`.
- Les identifiants `f1650df`, `18c7dbf`, `0e85eae` et `72c6020` ne sont pas des objets Git dans ce clone.

## Inventaire fonctionnel de la branche de validation

| Élément | État | Emplacement |
| --- | --- | --- |
| Administration | PRÉSENT | `src/components/Administration.tsx` |
| Workflow de visite / saisie de progression | PRÉSENT | `src/components/VisitForm.tsx`, `src/lib/data.ts` |
| Tables visites, progression et historique observations | PRÉSENT | migrations `001`, `002` |
| Import DPGF / `DpgfImport` | ABSENT | Présent uniquement dans `feature/v5-connected` |
| Module `progress` / calculs d'avancement | ABSENT | Présent uniquement dans `feature/v5-connected` |
| Héritage des affectations | ABSENT | Présent uniquement dans `feature/v5-connected` |

Les éléments absents n'ont pas été recopiés : aucune route de la branche de validation ne les référence et les récupérer nécessiterait également une migration de modèle supplémentaire. Ils doivent être intégrés dans une étape dédiée après validation fonctionnelle.

## PWA et environnement

`vite-plugin-pwa` est une dépendance de production et est instancié dans `vite.config.ts`. `src/vite-env.d.ts` référence les types Vite et PWA, ce qui fournit à la fois `ImportMeta.env` et le module virtuel `virtual:pwa-register` au compilateur. Les seules variables frontend attendues sont `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
