import { calculateReimbursableAmount, validateIBAN, detectDuplicates } from '@/lib/reimbursement';
import { Database } from '@/lib/database.types';

type Bareme = Database['public']['Tables']['baremes']['Row'];
type TauxRemboursement = Database['public']['Tables']['taux_remboursement']['Row'];
type Plafond = Database['public']['Tables']['plafonds']['Row'];

describe('Reimbursement calculations', () => {
  const mockBaremes: Bareme[] = [
    {
      id: '1',
      cv_fiscaux: 5,
      rate_per_km: 0.636,
      valid_from: '2024-01-01',
      valid_to: null,
      created_at: '2024-01-01T00:00:00Z',
    },
  ];
  
  const mockTaux: TauxRemboursement[] = [
    {
      id: '1',
      role: 'bn_member',
      taux: 0.80,
      valid_from: '2024-01-01',
      valid_to: null,
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: '2',
      role: 'admin_asso',
      taux: 0.65,
      valid_from: '2024-01-01',
      valid_to: null,
      created_at: '2024-01-01T00:00:00Z',
    },
  ];
  
  const mockPlafonds: Plafond[] = [
    {
      id: '1',
      expense_type: 'car',
      plafond_unitaire: null,
      plafond_journalier: 500.00,
      plafond_mensuel: null,
      requires_validation: true,
      valid_from: '2024-01-01',
      valid_to: null,
      created_at: '2024-01-01T00:00:00Z',
    },
  ];
  
  test('calculate car expense for BN member', async () => {
    const claim = {
      expense_type: 'car' as const,
      distance_km: 200,
      cv_fiscaux: 5,
      amount_ttc: 0,
    };
    
    const result = await calculateReimbursableAmount(
      claim,
      'bn_member',
      mockBaremes,
      mockTaux,
      mockPlafonds
    );
    
    // 200 km × 0.636 = 127.20
    expect(result.baseAmount).toBeCloseTo(127.20, 2);
    
    // 127.20 × 0.80 = 101.76
    expect(result.reimbursableAmount).toBeCloseTo(101.76, 2);
    
    expect(result.rateApplied).toBe(0.80);
  });
  
  test('calculate train expense for admin_asso', async () => {
    const claim = {
      expense_type: 'train' as const,
      amount_ttc: 150.00,
    };
    
    const result = await calculateReimbursableAmount(
      claim,
      'admin_asso',
      mockBaremes,
      mockTaux,
      mockPlafonds
    );
    
    expect(result.baseAmount).toBe(150.00);
    
    // 150 × 0.65 = 97.50
    expect(result.reimbursableAmount).toBeCloseTo(97.50, 2);
    
    expect(result.rateApplied).toBe(0.65);
  });
});

describe('IBAN validation', () => {
  test('validate correct French IBAN', () => {
    const result = validateIBAN('FR76 3000 1007 9412 3456 7890 185');
    expect(result.valid).toBe(true);
  });
  
  test('reject invalid IBAN', () => {
    const result = validateIBAN('FR00 0000 0000 0000 0000 0000 000');
    expect(result.valid).toBe(false);
  });
  
  test('reject empty IBAN', () => {
    const result = validateIBAN('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('IBAN vide');
  });
});

describe('Duplicate detection', () => {
  const mockClaims = [
    {
      id: '1',
      user_id: 'user1',
      expense_date: '2024-10-15',
      amount_ttc: 50.00,
      status: 'validated',
    },
    {
      id: '2',
      user_id: 'user1',
      expense_date: '2024-10-15',
      amount_ttc: 50.00,
      status: 'submitted',
    },
  ] as any[];
  
  test('detect duplicate claim', async () => {
    const newClaim = {
      user_id: 'user1',
      expense_date: '2024-10-15',
      amount_ttc: 50.00,
    };
    
    const result = await detectDuplicates(newClaim, mockClaims);
    
    expect(result.isDuplicate).toBe(true);
    expect(result.duplicates.length).toBe(2);
  });
  
  test('no duplicate for different amount', async () => {
    const newClaim = {
      user_id: 'user1',
      expense_date: '2024-10-15',
      amount_ttc: 75.00,
    };
    
    const result = await detectDuplicates(newClaim, mockClaims);
    
    expect(result.isDuplicate).toBe(false);
  });
});
