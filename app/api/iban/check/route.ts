import { NextRequest, NextResponse } from 'next/server';
import { validateIBAN } from '@/lib/reimbursement';

/**
 * POST /api/iban/check
 * Vérifier la validité d'un IBAN
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const iban = body.iban;
    
    if (!iban) {
      return NextResponse.json({ error: 'IBAN requis' }, { status: 400 });
    }
    
    // Validation syntaxique
    const validation = validateIBAN(iban);
    
    if (!validation.valid) {
      return NextResponse.json({
        valid: false,
        error: validation.error,
      });
    }
    
    // Validation externe (optionnel, si API key configurée)
    let externalValidation = null;
    if (process.env.IBAN_VALIDATION_API_KEY) {
      try {
        // Exemple avec un service comme ibanapi.com ou iban.com
        const response = await fetch(`https://openiban.com/validate/${iban}?getBIC=true&validateBankCode=true`);
        const data = await response.json();
        
        externalValidation = {
          valid: data.valid,
          bank_data: data.bankData,
          bic: data.bankData?.bic,
        };
      } catch (error) {
        console.error('Erreur validation IBAN externe:', error);
        // Continuer même si l'API externe échoue
      }
    }
    
    return NextResponse.json({
      valid: true,
      iban: iban.replace(/\s/g, '').toUpperCase(),
      country: iban.substring(0, 2),
      external_validation: externalValidation,
    });
  } catch (error) {
    console.error('Erreur POST /api/iban/check:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
