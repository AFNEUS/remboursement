#!/bin/bash
# =====================================================================
# COMMANDES DE BACKUP SUPABASE
# =====================================================================
# À exécuter AVANT toute modification DB
# =====================================================================

set -e

BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql"

# Créer le dossier de backup
mkdir -p "$BACKUP_DIR"

echo "🔒 BACKUP COMPLET DE LA BASE DE DONNÉES"
echo "========================================"
echo ""

# Méthode 1 : Via Supabase CLI (RECOMMANDÉ)
echo "📦 Méthode 1 : Supabase CLI"
echo "Commande :"
echo "  supabase db dump --db-url 'postgresql://postgres:[PASSWORD]@db.revtmvfxvmuwycknesdc.supabase.co:5432/postgres' > ${BACKUP_FILE}"
echo ""

# Méthode 2 : Via pg_dump direct
echo "📦 Méthode 2 : pg_dump direct"
echo "Commande :"
cat << 'EOF'
  pg_dump "postgresql://postgres:[PASSWORD]@db.revtmvfxvmuwycknesdc.supabase.co:5432/postgres" \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    --format=plain \
    --file="${BACKUP_FILE}"
EOF
echo ""

# Méthode 3 : Via UI Supabase
echo "📦 Méthode 3 : Supabase Dashboard UI"
echo "  1. Aller sur https://supabase.com/dashboard"
echo "  2. Sélectionner le projet AFNEUS"
echo "  3. Database → Backups"
echo "  4. Cliquer sur 'Create backup now'"
echo "  5. Télécharger le backup créé"
echo ""

echo "⚠️  REMPLACER [PASSWORD] par le mot de passe réel de la base"
echo "⚠️  Le backup sera sauvegardé dans : ${BACKUP_FILE}"
echo ""
echo "✅ Une fois le backup effectué, vérifier la taille du fichier :"
echo "   ls -lh ${BACKUP_FILE}"
echo ""
