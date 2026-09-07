# Revue V5 — validation du socle

## État des migrations

Les migrations `202609070001` puis `202609070002` sont ordonnées et créent d'abord les tables référencées avant les politiques RLS. La migration `202609070003` ajoute uniquement des index et des contrôles d'intégrité non destructifs.

Les écritures historiques sont append-only par RLS pour `progress_entries`, `observation_history` et `observation_events` : aucune politique `UPDATE` ou `DELETE` n'est définie pour ces tables. Les visites conservent toutefois une politique `UPDATE` pour les métadonnées ; ce n'est pas une réécriture d'une saisie de progression.

## Points vérifiés et limites connues

- Le modèle représente bien opération → unité arborescente (bâtiment, logement, partie commune, extérieur) → lot → tâche.
- Les références croisées n'étaient pas toutes garanties dans la même opération par les clés étrangères seules ; la migration d'audit ajoute ces contrôles côté base et des index de lecture.
- La fonction de calcul côté client et le tableau de bord ne sont pas encore présents dans cette version de `main` ; ils doivent être ajoutés lors de l'étape avancement, avec tests de données réelles.
- L'import DPGF, planning, CR et plans ne sont pas présents dans le `main` inspecté. Aucun fichier source Gambetta n'a été trouvé dans l'environnement, donc aucun contenu n'a été simulé ni importé.
- Une clé anon est attendue par le frontend. Aucun secret Supabase/service-role, ni secret Railway, n'est suivi dans le dépôt.
