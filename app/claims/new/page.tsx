'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { searchCities, calculateDistance } from '@/lib/cities-france';
import { calculateKilometricAmount, formatAmount } from '@/lib/calculations';
import { toast } from 'sonner';

type ExpenseType = 'car' | 'train' | 'transport' | 'meal' | 'hotel' | 'registration' | 'other';

interface UserProfile {
  id: string;
  role: string;
  full_name: string;
  email: string;
}

interface EventData {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location: string;
  max_train_amount?: number;
  max_hotel_per_night?: number;
  max_meal_amount?: number;
  custom_km_cap?: number;
}

interface ReimbursementRules {
  userRate: number; // Taux selon rôle (0.80, 0.65, 0.50)
  roleName: string;
  maxTrain: number;
  maxHotel: number;
  maxMeal: number;
  kmRate: number;
}

interface TransportComparison {
  trainCost: number;
  trainRefund: number;
  carCost: number;
  carRefund: number;
  recommendation: 'train' | 'car' | 'equal';
  savings: number;
  message: string;
}

const EXPENSE_TYPES = [
  { value: 'train', label: 'Train SNCF', icon: '🚄', description: 'Recommandé pour longues distances' },
  { value: 'car', label: 'Voiture', icon: '🚗', description: 'Frais kilométriques + covoiturage' },
  { value: 'transport', label: 'Bus / Metro', icon: '🚌', description: 'Transports en commun' },
  { value: 'meal', label: 'Repas', icon: '🍽️', description: 'Forfait selon barème' },
  { value: 'hotel', label: 'Hébergement', icon: '🏨', description: 'Plafond par nuitée' },
  { value: 'other', label: 'Autre', icon: '📄', description: 'Dépenses exceptionnelles' },
];

export default function NewClaimPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [rules, setRules] = useState<ReimbursementRules | null>(null);

  // Form
  const [expenseType, setExpenseType] = useState<ExpenseType>('train');
  const [motive, setMotive] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [amountTTC, setAmountTTC] = useState<number | ''>('');

  // Transport
  const [departure, setDeparture] = useState('');
  const [arrival, setArrival] = useState('');
  const [distance, setDistance] = useState<number | ''>('');
  const [isRoundTrip, setIsRoundTrip] = useState(true);
  const [fiscalPower, setFiscalPower] = useState(5);
  const [carpoolCount, setCarpoolCount] = useState(1); // Nombre de personnes (1 = conducteur seul)

  // UI
  const [departureSuggestions, setDepartureSuggestions] = useState<any[]>([]);
  const [arrivalSuggestions, setArrivalSuggestions] = useState<any[]>([]);
  const [showDepartureSuggestions, setShowDepartureSuggestions] = useState(false);
  const [showArrivalSuggestions, setShowArrivalSuggestions] = useState(false);
  const [transportComparison, setTransportComparison] = useState<TransportComparison | null>(null);
  const [estimatedRefund, setEstimatedRefund] = useState<number>(0);
  const [justificatifs, setJustificatifs] = useState<File[]>([]);
  const [filePreview, setFilePreview] = useState<{[key: string]: string}>({});

  // Load user profile and events
  useEffect(() => {
    loadUserProfile();
    loadEvents();
  }, []);

  // Update rules when event or user changes
  useEffect(() => {
    updateRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId, userProfile]);

  // Calculate estimates when transport fields change
  const calculateTransportEstimates = useCallback(() => {
    if (!rules || !distance || typeof distance !== 'number') return;

    const effectiveDistance = isRoundTrip ? distance * 2 : distance;

    // Calcul voiture
    const carBase = calculateKilometricAmount(effectiveDistance, fiscalPower);
    const carPerPerson = carBase / carpoolCount;
    const carRefund = carPerPerson * rules.userRate;

    // Calcul train (basé sur distance)
    const trainEstimate = estimateTrainPrice(effectiveDistance);
    const trainRefund = calculateTrainRefund(effectiveDistance, trainEstimate);

    // Comparaison
    const savings = Math.abs(carRefund - trainRefund);
    let recommendation: 'train' | 'car' | 'equal' = 'equal';
    let message = '';

    if (trainRefund < carRefund && trainRefund > 0) {
      recommendation = 'train';
      message = `🚄 Train recommandé ! Économie de ${formatAmount(savings)} pour l'asso`;
    } else if (carRefund < trainRefund) {
      recommendation = 'car';
      if (carpoolCount > 1) {
        message = `🚗 Covoiturage avantageux (${carpoolCount} pers.) ! Économie de ${formatAmount(savings)}`;
      } else {
        message = `🚗 Voiture moins chère. Pensez au covoiturage pour réduire encore !`;
      }
    } else {
      message = 'Coûts similaires. Le train est plus écologique 🌱';
    }

    setTransportComparison({
      trainCost: trainEstimate,
      trainRefund,
      carCost: carBase,
      carRefund,
      recommendation,
      savings,
      message,
    });

    // Mettre à jour l'estimation selon le type sélectionné
    if (expenseType === 'car') {
      setEstimatedRefund(carRefund);
      setAmountTTC(carPerPerson);
      setDescription(`${departure} → ${arrival} (${isRoundTrip ? 'A/R' : 'Aller'}, ${effectiveDistance}km, ${fiscalPower}CV${carpoolCount > 1 ? `, ${carpoolCount} pers.` : ''})`);
    } else if (expenseType === 'train' && amountTTC && typeof amountTTC === 'number') {
      const actualTrainRefund = calculateTrainRefund(effectiveDistance, amountTTC);
      setEstimatedRefund(actualTrainRefund);
    }
  }, [rules, distance, isRoundTrip, fiscalPower, carpoolCount, expenseType, departure, arrival, amountTTC]);

  useEffect(() => {
    calculateTransportEstimates();
  }, [calculateTransportEstimates]);

  // Calculate non-transport estimates
  useEffect(() => {
    if (!rules) return;

    if (expenseType === 'meal') {
      setEstimatedRefund(rules.maxMeal);
      setAmountTTC(rules.maxMeal);
    } else if (expenseType === 'hotel' && amountTTC && typeof amountTTC === 'number') {
      const refund = Math.min(amountTTC * rules.userRate, rules.maxHotel);
      setEstimatedRefund(refund);
    } else if (expenseType === 'transport' && amountTTC && typeof amountTTC === 'number') {
      setEstimatedRefund(amountTTC * rules.userRate);
    } else if (expenseType === 'other' && amountTTC && typeof amountTTC === 'number') {
      setEstimatedRefund(Math.min(amountTTC * rules.userRate, 100));
    }
  }, [expenseType, amountTTC, rules]);

  async function loadUserProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
        return;
      }

      // Récupérer le profil complet via RPC
      const { data, error } = await supabase.rpc('get_current_user_safe') as { data: any; error: any };
      if (!error && data && Array.isArray(data) && (data as any[]).length > 0) {
        setUserProfile((data as any[])[0] as UserProfile);
      } else {
        // Fallback avec info de base
        setUserProfile({
          id: user.id,
          role: 'user',
          full_name: user.email?.split('@')[0] || 'Utilisateur',
          email: user.email || '',
        });
      }
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

  function updateRules() {
    if (!userProfile) return;

    // Taux selon le rôle
    let userRate = 0.50; // Membre standard
    let roleName = 'Membre';

    if (userProfile.role === 'admin_asso' || userProfile.role === 'bn_member' || userProfile.role === 'treasurer') {
      userRate = 0.80;
      roleName = userProfile.role === 'admin_asso' ? 'Admin' : 'Bureau National';
    }

    // Plafonds par défaut
    let maxTrain = 120; // Max train standard
    let maxHotel = 80;  // Max hôtel/nuit
    let maxMeal = 15;   // Forfait repas
    let kmRate = 0.636; // Barème 5CV

    // Si événement sélectionné, utiliser ses barèmes
    if (selectedEventId) {
      const event = events.find(e => e.id === selectedEventId);
      if (event) {
        if (event.max_train_amount) maxTrain = event.max_train_amount;
        if (event.max_hotel_per_night) maxHotel = event.max_hotel_per_night;
        if (event.max_meal_amount) maxMeal = event.max_meal_amount;
        if (event.custom_km_cap) kmRate = event.custom_km_cap;
      }
    }

    setRules({ userRate, roleName, maxTrain, maxHotel, maxMeal, kmRate });
  }

  function estimateTrainPrice(distanceKm: number): number {
    // Estimation réaliste des prix SNCF (€/km dégressif)
    if (distanceKm < 100) return distanceKm * 0.25;
    if (distanceKm < 300) return distanceKm * 0.20;
    if (distanceKm < 500) return distanceKm * 0.18;
    return distanceKm * 0.15;
  }

  function calculateTrainRefund(distanceKm: number, ticketPrice: number): number {
    // Barèmes intelligents par distance
    const baremes = [
      { min: 0, max: 150, pct: 100, maxAmt: 50 },
      { min: 150, max: 350, pct: 100, maxAmt: 80 },
      { min: 350, max: 550, pct: 95, maxAmt: 120 },
      { min: 550, max: 800, pct: 90, maxAmt: 160 },
      { min: 800, max: 1200, pct: 85, maxAmt: 200 },
      { min: 1200, max: 10000, pct: 80, maxAmt: 250 },
    ];

    const bareme = baremes.find(b => distanceKm >= b.min && distanceKm < b.max) || baremes[baremes.length - 1];
    const calculated = ticketPrice * (bareme.pct / 100);
    return Math.min(calculated, bareme.maxAmt);
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
        setDistance(calculateDistance(cityName, arrival));
      }
    } else {
      setArrival(cityName);
      setShowArrivalSuggestions(false);
      if (departure) {
        setDistance(calculateDistance(departure, cityName));
      }
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);

    // Validation des fichiers
    const validFiles: File[] = [];
    const maxSize = 5 * 1024 * 1024; // 5MB

    files.forEach(file => {
      if (file.size > maxSize) {
        toast.error(`❌ ${file.name} est trop volumineux (max 5MB)`);
        return;
      }

      // Générer la prévisualisation pour les images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreview(prev => ({ ...prev, [file.name]: reader.result as string }));
        };
        reader.readAsDataURL(file);
      }

      validFiles.push(file);
    });

    if (validFiles.length > 0) {
      setJustificatifs(prev => [...prev, ...validFiles]);
      toast.success(`✅ ${validFiles.length} fichier(s) ajouté(s)`);
    }
  }

  function removeFile(index: number) {
    const file = justificatifs[index];
    setJustificatifs(prev => prev.filter((_, i) => i !== index));
    setFilePreview(prev => {
      const newPreview = { ...prev };
      delete newPreview[file.name];
      return newPreview;
    });
    toast.info(`🗑️ ${file.name} supprimé`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation
    if (!motive.trim()) {
      toast.error('Veuillez indiquer le motif de votre demande');
      return;
    }

    if (!amountTTC || amountTTC <= 0) {
      toast.error('Veuillez entrer un montant valide');
      return;
    }

    if ((expenseType === 'car' || expenseType === 'train') && !departure) {
      toast.error('Veuillez sélectionner une ville de départ');
      return;
    }

    if ((expenseType === 'car' || expenseType === 'train') && !arrival) {
      toast.error('Veuillez sélectionner une ville d\'arrivée');
      return;
    }

    setLoading(true);
    toast.loading('Création de votre demande en cours...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/login');
        return;
      }

      const effectiveDistance = (expenseType === 'car' || expenseType === 'train') && distance
        ? (isRoundTrip ? (distance as number) * 2 : distance)
        : null;

      const claimData = {
        event_id: selectedEventId || null,
        expense_type: expenseType,
        expense_date: expenseDate,
        motive,
        description: description || `${EXPENSE_TYPES.find(t => t.value === expenseType)?.label}`,
        merchant_name: '',
        amount_ttc: amountTTC,
        currency: 'EUR',
        departure_location: departure || null,
        arrival_location: arrival || null,
        distance_km: effectiveDistance,
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
        throw new Error(result.error || 'Erreur de création');
      }

      const claimId = result.claim.id;

      // Upload justificatifs avec progress bar
      toast.dismiss();
      const uploadErrors: string[] = [];
      const totalFiles = justificatifs.length;

      if (totalFiles > 0) {
        for (let i = 0; i < totalFiles; i++) {
          const file = justificatifs[i];
          toast.loading(`Upload ${i + 1}/${totalFiles} : ${file.name}...`);

          try {
            const path = `${claimId}/${Date.now()}_${file.name}`;
            const { error: uploadError } = await supabase.storage
              .from('justificatifs')
              .upload(path, file);

            if (uploadError) {
              uploadErrors.push(file.name);
              toast.error(`❌ ${file.name} : ${uploadError.message}`);
            } else {
              toast.success(`✅ ${file.name} uploadé`);
            }
          } catch (err: any) {
            uploadErrors.push(file.name);
            toast.error(`❌ ${file.name} : ${err.message}`);
          }

          // Petit délai pour que l'utilisateur voie les toasts
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      toast.dismiss();

      // Soumettre automatiquement le claim
      toast.loading('Soumission de votre demande...');
      try {
        const submitResponse = await fetch(`/api/claims/${claimId}/submit`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!submitResponse.ok) {
          const submitResult = await submitResponse.json();
          console.warn('Échec de soumission automatique:', submitResult.error);
          toast.warning('La demande a été créée mais pas soumise automatiquement');
        }
      } catch (submitErr) {
        console.warn('Échec de soumission automatique:', submitErr);
        toast.warning('La demande a été créée mais pas soumise automatiquement');
      }

      toast.dismiss();

      // Message de succès
      const refundAmount = formatAmount(result.calculation.reimbursableAmount);

      if (uploadErrors.length === 0) {
        toast.success(`✅ Demande créée et soumise avec succès ! Remboursement estimé : ${refundAmount}`, {
          duration: 7000,
        });
      } else {
        toast.warning(`⚠️ Demande créée mais ${uploadErrors.length} fichier(s) n'ont pas pu être uploadés`, {
          duration: 7000,
        });
      }

      setTimeout(() => router.push('/claims'), 1000);
    } catch (error: any) {
      toast.dismiss();
      toast.error(`❌ Erreur : ${error.message}`, {
        description: 'Veuillez réessayer ou contacter le support',
        duration: 10000,
      });
    } finally {
      setLoading(false);
    }
  }

  if (checkingAuth || !rules) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement des barèmes...</p>
        </div>
      </div>
    );
  }

  const selectedEvent = events.find(e => e.id === selectedEventId);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <button onClick={() => router.back()} className="text-blue-600 hover:text-blue-800">
            ← Retour
          </button>
          <div className="text-right">
            <div className="text-sm text-gray-600">Connecté en tant que</div>
            <div className="font-semibold">{userProfile?.full_name}</div>
            <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded inline-block">
              {rules.roleName} • Taux {(rules.userRate * 100).toFixed(0)}%
            </div>
          </div>
        </div>

        <h1 className="text-3xl font-bold mb-2">Nouvelle demande de remboursement</h1>
        <p className="text-gray-600 mb-6">
          Les barèmes sont calculés automatiquement selon votre rôle et l&apos;événement sélectionné.
        </p>

        {/* Alerte plafonds */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-yellow-800 mb-2">📊 Plafonds actuels (pour minimiser les frais)</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-yellow-700">Train max</div>
              <div className="font-bold text-yellow-900">{formatAmount(rules.maxTrain)}</div>
            </div>
            <div>
              <div className="text-yellow-700">Hôtel/nuit</div>
              <div className="font-bold text-yellow-900">{formatAmount(rules.maxHotel)}</div>
            </div>
            <div>
              <div className="text-yellow-700">Repas forfait</div>
              <div className="font-bold text-yellow-900">{formatAmount(rules.maxMeal)}</div>
            </div>
            <div>
              <div className="text-yellow-700">Votre taux</div>
              <div className="font-bold text-yellow-900">{(rules.userRate * 100).toFixed(0)}%</div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Événement */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block font-semibold mb-3">Événement lié</label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Aucun événement (barèmes standards)</option>
              {events.map(event => (
                <option key={event.id} value={event.id}>
                  {event.name} - {new Date(event.start_date).toLocaleDateString('fr-FR')} à {event.location}
                </option>
              ))}
            </select>
            {selectedEvent && (
              <p className="text-sm text-green-600 mt-2">
                ✓ Barèmes de l&apos;événement appliqués
              </p>
            )}
          </div>

          {/* Motif */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block font-semibold mb-2">Motif de la demande *</label>
            <input
              type="text"
              value={motive}
              onChange={(e) => setMotive(e.target.value)}
              placeholder="Ex: Déplacement réunion BN, Formation..."
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Type de dépense */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block font-semibold mb-4">Type de dépense</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {EXPENSE_TYPES.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setExpenseType(type.value as ExpenseType)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    expenseType === type.value
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{type.icon}</div>
                  <div className="font-medium">{type.label}</div>
                  <div className="text-xs text-gray-500">{type.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Configuration transport */}
          {(expenseType === 'car' || expenseType === 'train') && (
            <div className="bg-white rounded-lg shadow p-6 space-y-4">
              <h3 className="text-lg font-semibold">Configuration du trajet</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block font-medium mb-2">Départ *</label>
                  <input
                    type="text"
                    value={departure}
                    onChange={(e) => {
                      setDeparture(e.target.value);
                      handleCitySearch(e.target.value, true);
                    }}
                    onBlur={() => setTimeout(() => setShowDepartureSuggestions(false), 200)}
                    placeholder="Ville de départ"
                    className="w-full px-4 py-3 border rounded-lg"
                  />
                  {showDepartureSuggestions && departureSuggestions.length > 0 && (
                    <div className="absolute z-20 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                      {departureSuggestions.map((city, i) => (
                        <div key={i} onMouseDown={() => selectCity(city.name, true)} className="px-4 py-3 hover:bg-blue-50 cursor-pointer">
                          {city.name} <span className="text-xs text-gray-500">({city.code})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <label className="block font-medium mb-2">Arrivée *</label>
                  <input
                    type="text"
                    value={arrival}
                    onChange={(e) => {
                      setArrival(e.target.value);
                      handleCitySearch(e.target.value, false);
                    }}
                    onBlur={() => setTimeout(() => setShowArrivalSuggestions(false), 200)}
                    placeholder="Ville d'arrivée"
                    className="w-full px-4 py-3 border rounded-lg"
                  />
                  {showArrivalSuggestions && arrivalSuggestions.length > 0 && (
                    <div className="absolute z-20 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                      {arrivalSuggestions.map((city, i) => (
                        <div key={i} onMouseDown={() => selectCity(city.name, false)} className="px-4 py-3 hover:bg-blue-50 cursor-pointer">
                          {city.name} <span className="text-xs text-gray-500">({city.code})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-medium mb-2">Distance</label>
                  <div className="px-4 py-3 bg-gray-100 rounded-lg font-mono">
                    {distance ? `${distance} km` : '- km'}
                  </div>
                  {distance && <p className="text-xs text-green-600 mt-1">Auto-calculé (×1.3 routier)</p>}
                </div>

                {expenseType === 'car' && (
                  <div>
                    <label className="block font-medium mb-2">Puissance fiscale</label>
                    <select
                      value={fiscalPower}
                      onChange={(e) => setFiscalPower(parseInt(e.target.value))}
                      className="w-full px-4 py-3 border rounded-lg"
                    >
                      <option value={3}>3 CV (0.529€/km)</option>
                      <option value={4}>4 CV (0.606€/km)</option>
                      <option value={5}>5 CV (0.636€/km)</option>
                      <option value={6}>6 CV (0.665€/km)</option>
                      <option value={7}>7+ CV (0.697€/km)</option>
                    </select>
                  </div>
                )}

                <div>
                  <label className="flex items-center gap-2 font-medium mb-2">
                    <input
                      type="checkbox"
                      checked={isRoundTrip}
                      onChange={(e) => setIsRoundTrip(e.target.checked)}
                      className="w-5 h-5 rounded"
                    />
                    Aller-retour
                  </label>
                  <div className="text-sm text-gray-600">
                    {isRoundTrip ? 'Distance × 2' : 'Aller simple'}
                  </div>
                </div>
              </div>

              {expenseType === 'car' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <label className="block font-medium mb-2">🚗 Covoiturage (pour réduire les frais)</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={carpoolCount}
                      onChange={(e) => setCarpoolCount(parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className="font-bold text-lg">{carpoolCount} pers.</span>
                  </div>
                  <p className="text-sm text-green-700 mt-2">
                    {carpoolCount > 1
                      ? `💡 Montant divisé par ${carpoolCount} = économie pour l'asso !`
                      : 'Ajoutez des passagers pour réduire le remboursement'}
                  </p>
                </div>
              )}

              {/* Comparaison train vs voiture */}
              {transportComparison && distance && (
                <div className={`rounded-lg p-4 border-2 ${
                  transportComparison.recommendation === 'train'
                    ? 'bg-blue-50 border-blue-300'
                    : transportComparison.recommendation === 'car'
                    ? 'bg-green-50 border-green-300'
                    : 'bg-gray-50 border-gray-300'
                }`}>
                  <h4 className="font-semibold mb-3">📊 Comparaison pour l&apos;association</h4>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <div className="text-sm text-gray-600">🚄 Train</div>
                      <div className="font-bold">
                        Remboursement : {formatAmount(transportComparison.trainRefund)}
                      </div>
                      <div className="text-xs text-gray-500">
                        (estimé {formatAmount(transportComparison.trainCost)})
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">🚗 Voiture {carpoolCount > 1 && `(${carpoolCount} pers.)`}</div>
                      <div className="font-bold">
                        Remboursement : {formatAmount(transportComparison.carRefund)}
                      </div>
                      <div className="text-xs text-gray-500">
                        (base {formatAmount(transportComparison.carCost)})
                      </div>
                    </div>
                  </div>
                  <div className="font-medium text-center py-2 bg-white rounded">
                    {transportComparison.message}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Montant */}
          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            <div>
              <label className="block font-semibold mb-2">
                {expenseType === 'car' ? 'Montant calculé' : 'Montant réel (€) *'}
              </label>
              <input
                type="number"
                step="0.01"
                value={amountTTC}
                onChange={(e) => setAmountTTC(e.target.value ? parseFloat(e.target.value) : '')}
                className={`w-full px-4 py-3 border rounded-lg text-lg ${
                  expenseType === 'car' ? 'bg-gray-100' : ''
                }`}
                readOnly={expenseType === 'car'}
                required={expenseType !== 'car'}
              />
              {expenseType === 'train' && (
                <p className="text-sm text-gray-600 mt-2">
                  Entrez le prix exact de votre billet SNCF
                </p>
              )}
            </div>

            {/* Estimation remboursement */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm text-gray-600">Remboursement estimé</div>
                  <div className="text-xs text-gray-500">Taux {rules.roleName} : {(rules.userRate * 100).toFixed(0)}%</div>
                </div>
                <div className="text-3xl font-bold text-green-700">
                  {formatAmount(estimatedRefund)}
                </div>
              </div>
            </div>

            <div>
              <label className="block font-medium mb-2">Date</label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full px-4 py-3 border rounded-lg"
                required
              />
            </div>
          </div>

          {/* Justificatifs */}
          <div className="bg-white rounded-lg shadow p-6">
            <label className="block font-semibold mb-2">
              Justificatifs {justificatifs.length > 0 && <span className="text-blue-600">({justificatifs.length})</span>}
            </label>
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-blue-400 transition">
              <input
                type="file"
                onChange={handleFileUpload}
                multiple
                accept="image/*,.pdf"
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="text-3xl mb-2">📎</div>
                <div className="text-blue-600 font-medium">Ajouter des justificatifs</div>
                <div className="text-sm text-gray-500">Images ou PDF • Max 5MB par fichier</div>
              </label>
            </div>
            {justificatifs.length > 0 && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {justificatifs.map((f, i) => (
                  <div key={i} className="border rounded-lg p-3 bg-gray-50 hover:bg-gray-100 transition">
                    {filePreview[f.name] ? (
                      <div className="mb-2">
                        <img
                          src={filePreview[f.name]}
                          alt={f.name}
                          className="w-full h-32 object-cover rounded"
                        />
                      </div>
                    ) : (
                      <div className="mb-2 h-32 bg-gray-200 rounded flex items-center justify-center">
                        <span className="text-4xl">📄</span>
                      </div>
                    )}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{f.name}</div>
                        <div className="text-xs text-gray-500">
                          {(f.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="ml-2 text-red-600 hover:text-red-700 font-bold text-lg"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-4">
            <button type="button" onClick={() => router.back()} className="flex-1 px-6 py-4 bg-gray-200 rounded-lg font-semibold hover:bg-gray-300">
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Envoi...' : 'Créer la demande'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
