import { Database } from './database.types';

type ExpenseClaim = Database['public']['Tables']['expense_claims']['Row'];
type Bareme = Database['public']['Tables']['baremes']['Row'];
type TauxRemboursement = Database['public']['Tables']['taux_remboursement']['Row'];
type Plafond = Database['public']['Tables']['plafonds']['Row'];
type UserRole = Database['public']['Tables']['users']['Row']['role'];

/**
 * Interface pour le résultat du calcul de remboursement
 */
export interface ReimbursementCalculation {
  baseAmount: number; // Montant de base (montant TTC ou km × tarif)
  rateApplied: number; // Taux appliqué (0.80, 0.65, etc.)
  calculatedAmount: number; // Montant calculé avant plafonds
  reimbursableAmount: number; // Montant final remboursable
  exceedsCeiling: boolean; // Si dépasse un plafond
  requiresSecondValidation: boolean; // Si nécessite 2e validation
  breakdown: {
    description: string;
    value: number;
  }[];
  warnings: string[];
}

/**
 * Calculer le montant remboursable pour une demande
 */
export async function calculateReimbursableAmount(
  claim: Partial<ExpenseClaim>,
  userRole: UserRole,
  baremes: Bareme[],
  taux: TauxRemboursement[],
  plafonds: Plafond[]
): Promise<ReimbursementCalculation> {
  const breakdown: { description: string; value: number }[] = [];
  const warnings: string[] = [];
  
  let baseAmount = 0;
  let rateApplied = 0;
  
  // 1. Calculer le montant de base selon le type de dépense
  if (claim.expense_type === 'car' && claim.distance_km && claim.cv_fiscaux) {
    // Transport en voiture : km × barème
    const bareme = baremes.find(
      (b) => b.cv_fiscaux === claim.cv_fiscaux && (!b.valid_to || new Date(b.valid_to) >= new Date())
    );
    
    if (!bareme) {
      warnings.push(`Aucun barème trouvé pour ${claim.cv_fiscaux} CV`);
      baseAmount = claim.amount_ttc || 0;
    } else {
      baseAmount = claim.distance_km * parseFloat(bareme.rate_per_km.toString());
      breakdown.push({
        description: `${claim.distance_km} km × ${bareme.rate_per_km}€/km (${claim.cv_fiscaux} CV)`,
        value: baseAmount,
      });
    }
  } else {
    // Autres types : montant TTC réel
    baseAmount = claim.amount_ttc || 0;
    breakdown.push({
      description: `Montant TTC réel`,
      value: baseAmount,
    });
  }
  
  // 2. Appliquer le taux selon le rôle
  const tauxRole = taux.find(
    (t) => 
      (userRole === 'bn_member' && t.role === 'bn_member') ||
      (userRole === 'admin_asso' && t.role === 'admin_asso') ||
      (!['bn_member', 'admin_asso'].includes(userRole) && t.role === 'user')
  );
  
  if (!tauxRole) {
    warnings.push(`Aucun taux trouvé pour le rôle ${userRole}, utilisation de 50% par défaut`);
    rateApplied = 0.50;
  } else {
    rateApplied = parseFloat(tauxRole.taux.toString());
  }
  
  const calculatedAmount = baseAmount * rateApplied;
  
  breakdown.push({
    description: `Application du taux ${(rateApplied * 100).toFixed(0)}% (${userRole})`,
    value: calculatedAmount,
  });
  
  // 3. Vérifier les plafonds
  let reimbursableAmount = calculatedAmount;
  let exceedsCeiling = false;
  let requiresSecondValidation = false;
  
  const plafond = plafonds.find(
    (p) => p.expense_type === claim.expense_type && (!p.valid_to || new Date(p.valid_to) >= new Date())
  );
  
  if (plafond) {
    // Vérifier plafond unitaire
    if (plafond.plafond_unitaire && reimbursableAmount > parseFloat(plafond.plafond_unitaire.toString())) {
      exceedsCeiling = true;
      warnings.push(
        `Montant dépasse le plafond unitaire de ${plafond.plafond_unitaire}€ pour ${claim.expense_type}`
      );
      reimbursableAmount = parseFloat(plafond.plafond_unitaire.toString());
      
      breakdown.push({
        description: `Application du plafond unitaire`,
        value: reimbursableAmount,
      });
    }
    
    // Vérifier si nécessite validation (plafonds ou configuration)
    if (plafond.requires_validation || exceedsCeiling) {
      requiresSecondValidation = true;
    }
  }
  
  // 4. Vérifier le seuil de seconde validation (configurable, ex: 500€)
  const secondValidationThreshold = 500; // À récupérer depuis config
  if (reimbursableAmount >= secondValidationThreshold) {
    requiresSecondValidation = true;
    warnings.push(`Montant ≥ ${secondValidationThreshold}€ : seconde validation requise`);
  }
  
  return {
    baseAmount,
    rateApplied,
    calculatedAmount,
    reimbursableAmount,
    exceedsCeiling,
    requiresSecondValidation,
    breakdown,
    warnings,
  };
}

/**
 * Valider un IBAN (syntaxe uniquement)
 */
export function validateIBAN(iban: string): { valid: boolean; error?: string } {
  const ibanLib = require('iban');
  
  if (!iban || iban.trim().length === 0) {
    return { valid: false, error: 'IBAN vide' };
  }
  
  const cleanIban = iban.replace(/\s/g, '').toUpperCase();
  
  if (!ibanLib.isValid(cleanIban)) {
    return { valid: false, error: 'Format IBAN invalide' };
  }
  
  return { valid: true };
}

/**
 * Extraire le BIC depuis l'IBAN (approximatif, selon pays)
 */
export function extractBICFromIBAN(iban: string): string | null {
  const cleanIban = iban.replace(/\s/g, '').toUpperCase();
  
  // Pour la France (FR), les caractères 5-9 correspondent souvent au code banque
  // Cette fonction est indicative, idéalement utiliser une API externe
  if (cleanIban.startsWith('FR')) {
    // Code banque FR : positions 4-8 (5 digits)
    const bankCode = cleanIban.substring(4, 9);
    // Retourner null car on ne peut pas deviner le BIC complet
    return null;
  }
  
  return null;
}

/**
 * Détecter les doublons suspects
 */
export async function detectDuplicates(
  claim: Partial<ExpenseClaim>,
  allClaims: ExpenseClaim[]
): Promise<{ isDuplicate: boolean; duplicates: ExpenseClaim[] }> {
  const duplicates = allClaims.filter(
    (c) =>
      c.id !== claim.id &&
      c.user_id === claim.user_id &&
      c.expense_date === claim.expense_date &&
      Math.abs((c.amount_ttc || 0) - (claim.amount_ttc || 0)) < 0.01 &&
      !['refused', 'closed'].includes(c.status)
  );
  
  return {
    isDuplicate: duplicates.length > 0,
    duplicates,
  };
}

/**
 * Calculer la distance entre deux points (si OpenRouteService activé)
 */
export async function calculateDistance(
  departure: string,
  arrival: string
): Promise<{ distance_km: number; duration_min: number } | null> {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  
  if (!apiKey) {
    return null;
  }
  
  try {
    // Utiliser OpenRouteService pour calculer la distance
    // Documentation: https://openrouteservice.org/dev/#/api-docs/v2/directions
    const Openrouteservice = require('openrouteservice-js');
    const orsDirections = new Openrouteservice.Directions({ api_key: apiKey });
    
    // Geocoder les adresses (simplification, idéalement utiliser un geocoder)
    // Pour l'instant, retourner null si pas de coordonnées
    return null;
  } catch (error) {
    console.error('Erreur calcul distance:', error);
    return null;
  }
}

/**
 * Formatter un montant en EUR
 */
export function formatCurrency(amount: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(amount);
}

/**
 * Formatter une date
 */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
}

/**
 * Vérifier si l'utilisateur a les permissions requises
 */
export function hasPermission(userRole: UserRole, requiredRoles: UserRole[]): boolean {
  return requiredRoles.includes(userRole);
}

/**
 * Générer un identifiant de demande unique (ex: RBT-2025-001234)
 */
export function generateClaimReference(claimId: string): string {
  const year = new Date().getFullYear();
  const shortId = claimId.substring(0, 8).toUpperCase();
  return `RBT-${year}-${shortId}`;
}
