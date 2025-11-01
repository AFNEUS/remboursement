#!/bin/bash

# Script de nettoyage AFNEUS
# Supprime les fichiers en doublon et obsolètes

echo "🧹 NETTOYAGE AFNEUS - Suppression fichiers obsolètes"
echo "======================================================"
echo ""

# Documentation en doublon
echo "📄 Suppression documentation en doublon..."
rm -f DEPLOIEMENT.md
rm -f DEPLOYMENT.md
rm -f FIXES_APPLIED.md
rm -f GUIDE_CONFIGURATION_AUTH_EMAILS.md
rm -f GUIDE_DEPLOIEMENT.md
rm -f INSTRUCTIONS_FINALES.md
rm -f QUICKSTART.md
rm -f QUICK_START.md
rm -f README_COMPLET.md
rm -f RECAP_FINAL.md
rm -f SETUP_SUPABASE.md
rm -f SQL_FIX_GUIDE.md
rm -f SUPABASE_MIGRATIONS.md
rm -f VERIFICATION_COMPLETE_SYSTEME.md

echo "✅ Documentation nettoyée"

# Migrations obsolètes (on garde que 000_master_init.sql et 010_event_baremes_sncf.sql)
echo ""
echo "📊 Suppression migrations obsolètes..."
rm -f supabase/migrations/001_initial_schema.sql
rm -f supabase/migrations/001_initial_schema_FIXED.sql
rm -f supabase/migrations/002_insert_baremes.sql
rm -f supabase/migrations/003_init_complete.sql
rm -f supabase/migrations/003_optimized_structure.sql
rm -f supabase/migrations/003b_add_event_type.sql
rm -f supabase/migrations/003c_add_users_columns.sql
rm -f supabase/migrations/004_admin_accounts.sql
rm -f supabase/migrations/005_dashboard_and_stats.sql
rm -f supabase/migrations/006_init_bn_members.sql
rm -f supabase/migrations/007_authentication_system.sql
rm -f supabase/migrations/008_email_notifications_system.sql
rm -f supabase/migrations/009_enhanced_authentication_oauth.sql

echo "✅ Migrations nettoyées"

# Fichiers backup
echo ""
echo "🗂️  Suppression fichiers backup..."
rm -f app/claims/new/page.tsx.backup
rm -f app/claims/new/page_COMPLETE.tsx.txt

echo "✅ Backups nettoyés"

# Scripts inutiles
echo ""
echo "🔧 Suppression scripts obsolètes..."
rm -f test_sepa_export.sh
rm -f scripts_sql_utiles.sh

echo "✅ Scripts nettoyés"

echo ""
echo "🎉 NETTOYAGE TERMINÉ !"
echo ""
echo "📁 Fichiers conservés :"
echo "  ├── README_FINAL.md (guide principal)"
echo "  ├── .env.example"
echo "  ├── supabase/migrations/"
echo "  │   ├── 000_master_init.sql (TOUT le schéma)"
echo "  │   └── 010_event_baremes_sncf.sql (barèmes SNCF)"
echo "  ├── app/ (code Next.js)"
echo "  ├── components/"
echo "  ├── lib/"
echo "  └── supabase/functions/send-emails/"
echo ""
echo "✨ Projet nettoyé et optimisé !"
