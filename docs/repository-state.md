# État du dépôt — Suivi-Chantier V5

Vérification effectuée le 7 septembre 2026.

## Références Git

- `main` — `9845009` — « Initial commit » (README seul, branche par défaut, non modifiée(
- `work/v5-recovery` — `13fb6e9` — récupération du travail Codex (upstream : `codex/inspecter-le-depot-et-etablir-socle-v5-fvx7cb`(
- `feature/v5-dpgf-import` — `dbdb123` — fondation d'import DPGF conservée localement, non poussée(
- `feature/v5-operation-structure` — branche courante — structure d'opération générique et tâches DPGF hiérarchiques.



## Migrations (supabase/migrations/)

- `202609070001_initial_v5.sql` — fondations multi-opérations(opérations, unités, lots, tâches, observations, RLS(
- `202609070002_v5_business_model.sql` — entreprises, affectations, visites, progression, événements d'observations, rôles owner/admin/member/viewer(
- `202609070003_audit_integrity_and_indexes.sql` — index et contrôles `assert_same_operation`(
- `202609070004_dpgf_import_and_assignment_inheritance.sql` — import DPGF(`dpgf_imports`, traçabilité sur `tasks`, héritage des affectations(
- `202609070005_fix_assert_same_operation_and_prepare_gambetta_seed.sql` — correction du trigger et helper de seed restreint(aucune donnée injectée automatiquement(
- `202609070006_dpgf_semantics_schedule_and_finance.sql` — `task_type`, `source_payload`, planning(`schedule_items`, `schedule_dependencies`) et financier(`markets`, `market_amendments`, `market_situations`(



## Périmètre

- Structure générique : opération → unités(building, dwelling, common_area, exterior, zone(→ lots → tâches section/item hiérarchiques(
- Visites de chantier et saisie d'avancement par lot(
- Gestion admin des unités, entreprises, lots et tâches DPGF(saisie manuelle, copier/coller avec prévisualisation(
- PWA et déploiement Railway préconfigurés(



## Limites

- Planning, financier, observations : schéma SQL présent, interfaces non développées à ce stade(
- Aucune donnée Gambetta importée ni fabriquée(