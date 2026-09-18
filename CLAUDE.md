# CLAUDE.md — Suivi-Chantier

## Git — règle absolue

**Après chaque commit, toujours pusher automatiquement sur `main` sans demander confirmation.**

```
git push origin main
```

Si des changements sont sur une branche de développement, les merger dans main puis pusher :

```
git checkout main
git merge <branche> --no-edit
git push origin main
```

Ne jamais attendre une instruction supplémentaire pour pusher.
