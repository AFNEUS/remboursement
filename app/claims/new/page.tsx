'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { searchCities, calculateDistance, getEstimatedTrainPrice } from '@/lib/cities-france';
import { calculateKilometricAmount, formatAmount } from '@/lib/calculations';

type ExpenseType = 'car' | 'train' | 'transport' | 'meal' | 'hotel' | 'registration' | 'other';

interface EstimatedRefund {
  amount: number;
  percentage: number;
  maxApplied: number | null;
  description: string;
}

const EXPENSE_TYPES = [
  { value: 'car', label: 'Voiture (frais km)', icon: '🚗', needsJustif: true, needsDistance: true },
  { value: 'train', label: 'Train', icon: '🚄', needsJustif: true, needsDistance: true },
  { value: 'transport', label: 'Bus / Metro', icon: '🚌', needsJustif: true, needsDistance: false },
  { value: 'meal', label: 'Repas', icon: '🍽️', needsJustif: false, needsDistance: false },
  { value: 'hotel', label: 'Hotel', icon: '🏨', needsJustif: true, needsDistance: false },
  { value: 'registration', label: 'Inscription', icon: '📝', needsJustif: true, needsDistance: false },
  { value: 'other', label: 'Autre', icon: '📄', needsJustif: true, needsDistance: false },
];

export default function NewClaimPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);

  // Form fields
  const [expenseType, setExpenseType] = useState<ExpenseType>('train');
  const [motive, setMotive] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [amountTTC, setAmountTTC] = useState<number | ''>('');

  // Transport fields
  const [departure, setDeparture] = useState('');
  const [arrival, setArrival] = useState('');
  const [distance, setDistance] = useState<number | ''>('');
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [fiscalPower, setFiscalPower] = useState(5);

  // Autocomplete
  const [departureSuggestions, setDepartureSuggestions] = useState<any[]>([]);
  const [arrivalSuggestions, setArrivalSuggestions] = useState<any[]>([]);
  const [showDepartureSuggestions, setShowDepartureSuggestions] = useState(false);
  const [showArrivalSuggestions, setShowArrivalSuggestions] = useState(false);

  // Estimation
  const [estimatedRefund, setEstimatedRefund] = useState<EstimatedRefund | null>(null);

  // Files
  const [justificatifs, setJustificatifs] = useState<File[]>([]);

  useEffect(() => {
    loadUser();
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-calculate when relevant fields change
  useEffect(() => {
    calculateEstimate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseType, amountTTC, distance, isRoundTrip, fiscalPower, departure, arrival]);

  async function loadUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }
      setUser(user);
    } catch (error) {
      console.error('Error loading user:', error);
      router.push('/auth/login');
    } finally {
      setCheckingAuth(false);
    }
  }

  async function loadEvents() {
    try {
      const response = await fetch('/api/events', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setEvents(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error loading events:', error);
    }
  }

  function handleCitySearch(value: string, isDepart: boolean) {
    if (value.length >= 2) {
      const suggestions = searchCities(value);
      if (isDepart) {
        setDepartureSuggestions(suggestions);
        setShowDepartureSuggestions(true);
      } else {
        setArrivalSuggestions(suggestions);
        setShowArrivalSuggestions(true);
      }
    } else {
      if (isDepart) setShowDepartureSuggestions(false);
      else setShowArrivalSuggestions(false);
    }
  }

  function selectCity(cityName: string, isDepart: boolean) {
    if (isDepart) {
      setDeparture(cityName);
      setShowDepartureSuggestions(false);
      if (arrival) {
        const dist = calculateDistance(cityName, arrival);
        setDistance(dist);
      }
    } else {
      setArrival(cityName);
      setShowArrivalSuggestions(false);
      if (departure) {
        const dist = calculateDistance(departure, cityName);
        setDistance(dist);
      }
    }
  }

  function calculateEstimate() {
    if (expenseType === 'car' && distance && typeof distance === 'number') {
      // Frais kilométriques
      let totalKm = distance;
      if (isRoundTrip) totalKm *= 2;

      const amount = calculateKilometricAmount(totalKm, fiscalPower);
      setEstimatedRefund({
        amount,
        percentage: 100,
        maxApplied: null,
        description: `${totalKm} km x ${fiscalPower} CV (barème fiscal 2024)`,
      });
      setAmountTTC(amount);
      setDescription(`${departure} → ${arrival} (${isRoundTrip ? 'A/R' : 'Aller'}, ${totalKm}km, ${fiscalPower}CV)`);
    } else if (expenseType === 'train' && distance && amountTTC && typeof distance === 'number' && typeof amountTTC === 'number') {
      // Estimation train basée sur distance
      const trainRefund = estimateTrainRefund(distance, amountTTC);
      setEstimatedRefund(trainRefund);
      if (!description) {
        setDescription(`Train ${departure} → ${arrival} (${isRoundTrip ? 'A/R' : 'Aller'})`);
      }
    } else if (amountTTC && typeof amountTTC === 'number') {
      // Autres types - estimation simple (65% pour BN)
      setEstimatedRefund({
        amount: amountTTC * 0.65,
        percentage: 65,
        maxApplied: null,
        description: 'Estimation basée sur taux membre BN (65%)',
      });
    } else {
      setEstimatedRefund(null);
    }
  }

  function estimateTrainRefund(distanceKm: number, ticketPrice: number): EstimatedRefund {
    // Barèmes intelligents basés sur distance
    const baremes = [
      { min: 0, max: 150, pct: 100, maxAmt: 50, desc: 'Courte distance (<150km) - 100% max 50€' },
      { min: 150, max: 350, pct: 100, maxAmt: 80, desc: 'Moyenne distance (150-350km) - 100% max 80€' },
      { min: 350, max: 550, pct: 95, maxAmt: 120, desc: 'Longue distance (350-550km) - 95% max 120€' },
      { min: 550, max: 800, pct: 90, maxAmt: 160, desc: 'Très longue distance (550-800km) - 90% max 160€' },
      { min: 800, max: 1200, pct: 85, maxAmt: 200, desc: 'Extra-longue distance - 85% max 200€' },
      { min: 1200, max: 10000, pct: 80, maxAmt: 250, desc: 'DOM-TOM/Très loin - 80% max 250€' },
    ];

    const bareme = baremes.find(b => distanceKm >= b.min && distanceKm < b.max) || baremes[baremes.length - 1];
    const calculated = ticketPrice * (bareme.pct / 100);
    const refund = Math.min(calculated, bareme.maxAmt);

    return {
      amount: Math.round(refund * 100) / 100,
      percentage: bareme.pct,
      maxApplied: bareme.maxAmt,
      description: bareme.desc,
    };
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setJustificatifs(prev => [...prev, ...files]);
  }

  function removeFile(index: number) {
    setJustificatifs(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!motive.trim()) {
      alert('Veuillez indiquer le motif de la demande');
      return;
    }

    if (!amountTTC || amountTTC <= 0) {
      alert('Veuillez indiquer le montant');
      return;
    }

    if ((expenseType === 'car' || expenseType === 'train') && (!departure || !arrival)) {
      alert('Veuillez indiquer les villes de départ et d\'arrivée');
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Session expirée. Veuillez vous reconnecter.');
        router.push('/auth/login');
        return;
      }

      const claimData = {
        event_id: selectedEvent || null,
        expense_type: expenseType,
        expense_date: expenseDate,
        motive: motive,
        description: description || `${EXPENSE_TYPES.find(t => t.value === expenseType)?.label} - ${motive}`,
        merchant_name: '',
        amount_ttc: amountTTC,
        currency: 'EUR',
        departure_location: departure || null,
        arrival_location: arrival || null,
        distance_km: (expenseType === 'car' || expenseType === 'train') && distance
          ? (isRoundTrip && expenseType === 'train' ? (distance as number) * 2 : distance)
          : null,
        cv_fiscaux: expenseType === 'car' ? fiscalPower : null,
      };

      const response = await fetch('/api/claims/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify(claimData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la création');
      }

      const claim = result.claim;

      // Upload justificatifs
      if (justificatifs.length > 0) {
        for (const file of justificatifs) {
          const path = `${claim.id}/${Date.now()}_${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from('justificatifs')
            .upload(path, file);

          if (!uploadError) {
            // Cast to any to bypass TypeScript type issues with generated types
            await (supabase.from('justificatifs') as any).insert({
              expense_claim_id: claim.id,
              file_name: file.name,
              file_path: path,
              file_type: file.type,
              file_size: file.size,
            });
          }
        }
      }

      alert(`Demande créée ! Remboursement estimé : ${formatAmount(result.calculation.reimbursableAmount)}`);
      router.push('/claims');
    } catch (error: any) {
      console.error('Submit error:', error);
      alert('Erreur : ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  const selectedExpenseType = EXPENSE_TYPES.find(t => t.value === expenseType);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
        >
          ← Retour
        </button>
      </div>

      <h1 className="text-3xl font-bold mb-6">Nouvelle demande de remboursement</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type de dépense - Style Cards */}
        <div className="bg-white rounded-lg shadow p-6">
          <label className="block text-lg font-semibold mb-4">Type de dépense</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {EXPENSE_TYPES.map(type => (
              <button
                key={type.value}
                type="button"
                onClick={() => setExpenseType(type.value as ExpenseType)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  expenseType === type.value
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <div className="text-2xl mb-2">{type.icon}</div>
                <div className="text-sm font-medium">{type.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Motif et événement */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div>
            <label className="block font-semibold mb-2">Motif de la demande *</label>
            <input
              type="text"
              value={motive}
              onChange={(e) => setMotive(e.target.value)}
              placeholder="Ex: Formation AFNEUS 2024, Réunion BN Paris..."
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block font-semibold mb-2">Événement lié (optionnel)</label>
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Aucun événement</option>
              {events.map(event => (
                <option key={event.id} value={event.id}>
                  {event.name} - {new Date(event.start_date).toLocaleDateString('fr-FR')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold mb-2">Date de la dépense *</label>
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        {/* Trajet (Voiture ou Train) */}
        {selectedExpenseType?.needsDistance && (
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              {selectedExpenseType.icon} Configuration du trajet
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block font-medium mb-2">Ville de départ *</label>
                <input
                  type="text"
                  value={departure}
                  onChange={(e) => {
                    setDeparture(e.target.value);
                    handleCitySearch(e.target.value, true);
                  }}
                  onBlur={() => setTimeout(() => setShowDepartureSuggestions(false), 200)}
                  placeholder="Ex: Paris, Lyon, Marseille..."
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                {showDepartureSuggestions && departureSuggestions.length > 0 && (
                  <div className="absolute z-20 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {departureSuggestions.map((city, i) => (
                      <div
                        key={i}
                        onMouseDown={() => selectCity(city.name, true)}
                        className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b"
                      >
                        <div className="font-medium">{city.name}</div>
                        <div className="text-xs text-gray-500">{city.code} - {city.region}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <label className="block font-medium mb-2">Ville d&apos;arrivée *</label>
                <input
                  type="text"
                  value={arrival}
                  onChange={(e) => {
                    setArrival(e.target.value);
                    handleCitySearch(e.target.value, false);
                  }}
                  onBlur={() => setTimeout(() => setShowArrivalSuggestions(false), 200)}
                  placeholder="Ex: Paris, Lyon, Marseille..."
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                {showArrivalSuggestions && arrivalSuggestions.length > 0 && (
                  <div className="absolute z-20 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {arrivalSuggestions.map((city, i) => (
                      <div
                        key={i}
                        onMouseDown={() => selectCity(city.name, false)}
                        className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b"
                      >
                        <div className="font-medium">{city.name}</div>
                        <div className="text-xs text-gray-500">{city.code} - {city.region}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-medium mb-2">Distance (km)</label>
                <input
                  type="number"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value ? parseFloat(e.target.value) : '')}
                  placeholder="Auto-calculé"
                  className="w-full px-4 py-3 border rounded-lg bg-gray-50"
                />
                {distance && (
                  <p className="text-xs text-green-600 mt-1">
                    ✓ Distance calculée automatiquement (coeff. routier 1.3x)
                  </p>
                )}
              </div>

              {expenseType === 'car' && (
                <div>
                  <label className="block font-medium mb-2">Puissance fiscale</label>
                  <select
                    value={fiscalPower}
                    onChange={(e) => setFiscalPower(parseInt(e.target.value))}
                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={3}>3 CV - 0.529 €/km</option>
                    <option value={4}>4 CV - 0.606 €/km</option>
                    <option value={5}>5 CV - 0.636 €/km</option>
                    <option value={6}>6 CV - 0.665 €/km</option>
                    <option value={7}>7 CV+ - 0.697 €/km</option>
                  </select>
                </div>
              )}

              <div className="flex items-end">
                <label className="flex items-center gap-3 px-4 py-3 border rounded-lg cursor-pointer hover:bg-gray-50 w-full">
                  <input
                    type="checkbox"
                    checked={isRoundTrip}
                    onChange={(e) => setIsRoundTrip(e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <span className="font-medium">Aller-retour</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Montant */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <div>
            <label className="block font-semibold mb-2">
              {expenseType === 'car' ? 'Montant calculé (€)' : 'Montant TTC (€) *'}
            </label>
            <input
              type="number"
              step="0.01"
              value={amountTTC}
              onChange={(e) => setAmountTTC(e.target.value ? parseFloat(e.target.value) : '')}
              placeholder={expenseType === 'car' ? 'Calculé automatiquement' : 'Prix réel payé'}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 text-lg ${
                expenseType === 'car' ? 'bg-gray-50' : ''
              }`}
              required={expenseType !== 'car'}
              readOnly={expenseType === 'car'}
            />
            {expenseType === 'train' && (
              <p className="text-sm text-gray-600 mt-2">
                Indiquez le prix total payé pour votre billet SNCF
              </p>
            )}
          </div>

          {/* Estimation du remboursement */}
          {estimatedRefund && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-green-800">Remboursement estimé</span>
                <span className="text-2xl font-bold text-green-700">
                  {formatAmount(estimatedRefund.amount)}
                </span>
              </div>
              <p className="text-sm text-green-700">{estimatedRefund.description}</p>
              {estimatedRefund.maxApplied && (
                <p className="text-xs text-green-600 mt-1">
                  Plafond appliqué : {formatAmount(estimatedRefund.maxApplied)}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block font-medium mb-2">Description (optionnel)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Détails supplémentaires..."
              rows={2}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Justificatifs */}
        <div className="bg-white rounded-lg shadow p-6">
          <label className="block font-semibold mb-2">
            Justificatifs {selectedExpenseType?.needsJustif && '*'}
          </label>
          <p className="text-sm text-gray-600 mb-4">
            {expenseType === 'car' && 'Facture essence, ticket péage, carte grise...'}
            {expenseType === 'train' && 'Billet SNCF (PDF ou photo)'}
            {expenseType === 'hotel' && 'Facture hôtel'}
            {expenseType === 'meal' && 'Ticket de caisse (optionnel pour les repas)'}
            {!['car', 'train', 'hotel', 'meal'].includes(expenseType) && 'Facture ou reçu'}
          </p>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
            <input
              type="file"
              onChange={handleFileUpload}
              multiple
              accept="image/*,.pdf"
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="text-4xl mb-2">📎</div>
              <div className="font-medium text-blue-600">Cliquez pour ajouter des fichiers</div>
              <div className="text-sm text-gray-500">ou glissez-déposez vos justificatifs ici</div>
            </label>
          </div>

          {justificatifs.length > 0 && (
            <div className="mt-4 space-y-2">
              {justificatifs.map((file, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                  <span className="text-sm truncate flex-1">📄 {file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="text-red-600 hover:text-red-800 ml-2"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 px-6 py-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-semibold"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Envoi...
              </span>
            ) : (
              'Créer la demande'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
