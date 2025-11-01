# AFNEUS - Remboursement

Plateforme de gestion des remboursements AFNEUS.

## Setup Supabase

1. Va sur https://supabase.com/dashboard/project/revtmvfxvmuwycknesdc/sql/new
2. Copie le contenu de `supabase/migrations/00_RESET_DATABASE.sql`
3. RUN (pour nettoyer)
4. Copie le contenu de `supabase/migrations/01_INIT_COMPLETE.sql`
5. RUN (pour initialiser)

## Déploiement

```bash
git push origin main
```

Vercel déploie automatiquement sur https://remboursement.afneus.org
