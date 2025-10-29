/**
 * Calcul de distance à vol d'oiseau entre deux points GPS
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calcul du montant remboursable pour frais kilométriques
 * Barème fiscal 2024
 */
export function calculateKilometricAmount(
  distance: number,
  fiscalPower: number
): number {
  // Barème simplifié (jusqu'à 5000km)
  let rate = 0;
  
  if (fiscalPower <= 3) {
    rate = distance <= 5000 ? 0.529 : 0.316;
  } else if (fiscalPower === 4) {
    rate = distance <= 5000 ? 0.606 : 0.340;
  } else if (fiscalPower === 5) {
    rate = distance <= 5000 ? 0.636 : 0.357;
  } else if (fiscalPower === 6) {
    rate = distance <= 5000 ? 0.665 : 0.374;
  } else {
    rate = distance <= 5000 ? 0.697 : 0.394;
  }
  
  return Math.round(distance * rate * 100) / 100;
}

/**
 * Validation IBAN français
 */
export function validateIBAN(iban: string): boolean {
  // Enlever les espaces
  const cleanIban = iban.replace(/\s/g, '').toUpperCase();
  
  // Vérifier format français (27 caractères)
  if (!/^FR\d{2}[A-Z0-9]{23}$/.test(cleanIban)) {
    return false;
  }
  
  // Algorithme de vérification IBAN
  const rearranged = cleanIban.slice(4) + cleanIban.slice(0, 4);
  const numeric = rearranged
    .split('')
    .map(char => {
      const code = char.charCodeAt(0);
      return code >= 65 && code <= 90 ? (code - 55).toString() : char;
    })
    .join('');
  
  // Vérification modulo 97
  let remainder = numeric.slice(0, 9);
  for (let i = 9; i < numeric.length; i += 7) {
    remainder = (parseInt(remainder + numeric.slice(i, i + 7)) % 97).toString();
  }
  
  return parseInt(remainder) === 1;
}

/**
 * Formattage IBAN pour affichage
 */
export function formatIBAN(iban: string): string {
  const clean = iban.replace(/\s/g, '').toUpperCase();
  return clean.match(/.{1,4}/g)?.join(' ') || clean;
}

/**
 * Calcul du taux de remboursement selon le barème
 */
export function getReimbursementRate(
  categoryCode: string,
  userBareme: 'BN' | 'ADMIN' | 'OTHER'
): number {
  // Ces valeurs devraient venir de la DB (table taux_remboursement)
  const rates: Record<string, Record<string, number>> = {
    BN: { FUEL: 0.80, TOLL: 0.80, MEAL: 0.80, TRAIN: 0.80, BUS: 0.80 },
    ADMIN: { FUEL: 0.65, TOLL: 0.65, MEAL: 0.65, TRAIN: 0.65, BUS: 0.65 },
    OTHER: { FUEL: 0.50, TOLL: 0.50, MEAL: 0.50, TRAIN: 0.50, BUS: 0.50 },
  };
  
  return rates[userBareme]?.[categoryCode] || 0.50;
}

/**
 * Vérification des plafonds
 */
export function checkCeiling(
  categoryCode: string,
  amount: number
): { exceeded: boolean; limit: number; message?: string } {
  // Ces valeurs devraient venir de la DB (table plafonds)
  const ceilings: Record<string, { daily?: number; monthly?: number }> = {
    MEAL: { daily: 50, monthly: 500 },
    FUEL: { monthly: 500 },
    TOLL: { monthly: 200 },
  };
  
  const ceiling = ceilings[categoryCode];
  if (!ceiling) return { exceeded: false, limit: 0 };
  
  if (ceiling.daily && amount > ceiling.daily) {
    return {
      exceeded: true,
      limit: ceiling.daily,
      message: `Plafond journalier dépassé (${ceiling.daily}€)`,
    };
  }
  
  return { exceeded: false, limit: ceiling.monthly || 0 };
}

/**
 * Génération d'une référence unique pour une demande
 */
export function generateClaimReference(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `RMB-${year}${month}-${random}`;
}

/**
 * Formattage de montant en euros
 */
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

/**
 * Formattage de date
 */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

/**
 * Formattage de date et heure
 */
export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}
