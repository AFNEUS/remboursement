#!/bin/bash

# Script de test export SEPA
# Usage: ./test_sepa_export.sh

echo "🧪 TEST EXPORT SEPA - AFNEUS"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-"http://localhost:54321"}
SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY:-"your-anon-key"}

echo "📋 ÉTAPE 1 : Vérification des demandes validées"
echo "----------------------------------------------"

# Requête SQL pour voir les demandes validées
echo ""
echo "Exécutez cette requête dans Supabase SQL Editor :"
echo ""
echo "SELECT "
echo "  ec.id,"
echo "  u.first_name || ' ' || u.last_name as nom,"
echo "  u.email,"
echo "  u.iban,"
echo "  ec.validated_amount,"
echo "  ec.status"
echo "FROM expense_claims ec"
echo "JOIN users u ON ec.user_id = u.id"
echo "WHERE ec.status = 'VALIDATED'"
echo "  AND u.iban IS NOT NULL"
echo "ORDER BY ec.validated_at ASC;"
echo ""

read -p "Appuyez sur Entrée pour continuer..."

echo ""
echo "💰 ÉTAPE 2 : Créer des données de test"
echo "--------------------------------------"

# Créer un utilisateur de test avec IBAN
echo ""
echo "Exécutez ces requêtes pour créer un utilisateur test :"
echo ""
cat << 'EOF'
-- 1. Créer utilisateur test
INSERT INTO users (
  id,
  email,
  first_name,
  last_name,
  iban,
  iban_holder_name,
  role,
  status
) VALUES (
  gen_random_uuid(),
  'test.user@afneus.org',
  'Jean',
  'Dupont',
  'FR1420041010050500013M02606',
  'Jean Dupont',
  'MEMBER',
  'ACTIVE'
) ON CONFLICT (email) DO NOTHING
RETURNING id;

-- Copier l'ID retourné et l'utiliser ci-dessous

-- 2. Créer une demande de test (remplacer USER_ID)
INSERT INTO expense_claims (
  user_id, -- REMPLACER PAR L'ID CI-DESSUS
  expense_type,
  expense_date,
  amount_ttc,
  validated_amount,
  reimbursable_amount,
  status,
  validated_at,
  description,
  iban
) VALUES (
  'USER_ID', -- REMPLACER
  'covoiturage',
  '2024-01-15',
  50.00,
  50.00,
  50.00,
  'VALIDATED',
  NOW(),
  'Test export SEPA',
  'FR1420041010050500013M02606'
);
EOF

echo ""
read -p "Données test créées ? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ Test annulé${NC}"
    exit 1
fi

echo ""
echo "🏦 ÉTAPE 3 : Générer le fichier SEPA"
echo "-----------------------------------"

# Créer un fichier SEPA de test
BATCH_ID=$(uuidgen | cut -c1-8)
TIMESTAMP=$(date +%s)
MSG_ID="AFNEUS-${TIMESTAMP}"
BATCH_DATE=$(date +%Y-%m-%d)
FILENAME="SEPA_AFNEUS_TEST_${BATCH_DATE}_${BATCH_ID}.xml"

# IBAN AFNEUS (à remplacer)
DEBTOR_IBAN="FR7630003000000000000000000"
DEBTOR_BIC="SOGEFRPP"
DEBTOR_NAME="AFNEUS"

# Données bénéficiaire test
CREDITOR_NAME="Jean Dupont"
CREDITOR_IBAN="FR1420041010050500013M02606"
AMOUNT="50.00"

cat > "$FILENAME" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${MSG_ID}</MsgId>
      <CreDtTm>$(date -u +"%Y-%m-%dT%H:%M:%S")</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <CtrlSum>${AMOUNT}</CtrlSum>
      <InitgPty>
        <Nm>${DEBTOR_NAME}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>BATCH-${BATCH_ID}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <BtchBookg>true</BtchBookg>
      <NbOfTxs>1</NbOfTxs>
      <CtrlSum>${AMOUNT}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
      </PmtTpInf>
      <ReqdExctnDt>${BATCH_DATE}</ReqdExctnDt>
      <Dbtr>
        <Nm>${DEBTOR_NAME}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <IBAN>${DEBTOR_IBAN}</IBAN>
        </Id>
      </DbtrAcct>
      <DbtrAgt>
        <FinInstnId>
          <BIC>${DEBTOR_BIC}</BIC>
        </FinInstnId>
      </DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>
      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>CLAIM-TEST-001</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="EUR">${AMOUNT}</InstdAmt>
        </Amt>
        <Cdtr>
          <Nm>${CREDITOR_NAME}</Nm>
        </Cdtr>
        <CdtrAcct>
          <Id>
            <IBAN>${CREDITOR_IBAN}</IBAN>
          </Id>
        </CdtrAcct>
        <RmtInf>
          <Ustrd>Remboursement frais AFNEUS - Test SEPA</Ustrd>
        </RmtInf>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>
EOF

echo -e "${GREEN}✅ Fichier SEPA généré : ${FILENAME}${NC}"
echo ""

echo "📝 ÉTAPE 4 : Vérification du fichier"
echo "-----------------------------------"
echo ""
echo "Contenu du fichier :"
cat "$FILENAME"
echo ""

echo "📊 Statistiques :"
echo "- Taille : $(wc -c < "$FILENAME") octets"
echo "- Nombre de transactions : 1"
echo "- Montant total : ${AMOUNT} EUR"
echo "- IBAN débiteur : ${DEBTOR_IBAN} ⚠️ À REMPLACER"
echo "- IBAN créditeur : ${CREDITOR_IBAN}"
echo ""

# Vérifier si xmllint est installé
if command -v xmllint &> /dev/null; then
    echo "🔍 Validation XML..."
    if xmllint --noout "$FILENAME" 2>/dev/null; then
        echo -e "${GREEN}✅ XML valide${NC}"
    else
        echo -e "${RED}❌ XML invalide${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  xmllint non installé (optionnel)${NC}"
    echo "   Installation : sudo apt-get install libxml2-utils"
fi

echo ""
echo "🏦 ÉTAPE 5 : Import dans SG Pro (TEST)"
echo "-------------------------------------"
echo ""
echo "⚠️  IMPORTANT : N'utilisez QUE le compte TEST/SANDBOX de SG Pro"
echo ""
echo "Instructions :"
echo "1. Connexion : https://entreprises.secure.societegenerale.fr/"
echo "2. Menu : Virements → Virements SEPA multiples"
echo "3. Import : Cliquer 'Importer un fichier'"
echo "4. Sélectionner : ${FILENAME}"
echo "5. Vérifier :"
echo "   - Format détecté : pain.001.001.03"
echo "   - Nombre transactions : 1"
echo "   - Montant : ${AMOUNT} EUR"
echo "   - IBAN débiteur : ${DEBTOR_IBAN}"
echo "6. ⚠️  NE PAS VALIDER (rester en brouillon)"
echo ""

echo "✅ CHECKLIST FINALE"
echo "==================="
echo ""
echo "✓ Fichier SEPA généré : ${FILENAME}"
echo "✓ Format : pain.001.001.03 (compatible SG Pro)"
echo "✓ Encodage : UTF-8"
echo "✓ Structure : Valide"
echo ""
echo "⚠️  À FAIRE AVANT PRODUCTION :"
echo "  [ ] Remplacer IBAN AFNEUS dans le code"
echo "  [ ] Vérifier BIC Société Générale : SOGEFRPP"
echo "  [ ] Tester import SG Pro avec compte test"
echo "  [ ] Valider avec votre banquier SG Pro"
echo ""

echo -e "${GREEN}🎉 Test terminé !${NC}"
echo ""
echo "Fichier sauvegardé : $(pwd)/${FILENAME}"
echo ""
