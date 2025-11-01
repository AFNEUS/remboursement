// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { searchCities, calculateDistance } from '@/lib/cities-france';
import { calculateKilometricAmount, formatAmount } from '@/lib/calculations';

type ExpenseType = 'CAR' | 'TRAIN' | 'BUS' | 'MEAL' | 'HOTEL' | 'OTHER';

interface Passenger {
  name: string;
  email: string;
}

interface ExpenseItem {
  id: string;
  type: ExpenseType;
  description: string;
  amount: number;
  theoreticalMax: number;
  date: string;
  justificatifs: File[];
  departure?: string;
  arrival?: string;
  isRoundTrip?: boolean;
  passengers?: Passenger[];
  fuelReceipt?: File;
  tollReceipt?: File;
}

const EXPENSE_TYPES = [
  { value: 'CAR', label: '🚗 Frais kilométriques', needsJustif: true },
  { value: 'TRAIN', label: '🚄 Train', needsJustif: true },
  { value: 'BUS', label: '🚌 Bus', needsJustif: true },
  { value: 'TGVMAX', label: '🚄 TGV Max (abonnement)', needsJustif: true },
  { value: 'MEAL', label: '🍽️ Repas', needsJustif: false },
  { value: 'HOTEL', label: '🏨 Hôtel', needsJustif: true },
  { value: 'OTHER', label: '📄 Autre', needsJustif: true },
];

const EVENT_TYPES = [
  { value: 'CONGRES_ANNUEL', label: '🎓 Congrès annuel AFNEUS' },
  { value: 'WEEKEND_PASSATION', label: '🔄 Week-end de passation' },
  { value: 'FORMATION', label: '📚 Formation' },
  { value: 'REUNION_BN', label: '🏛️ Réunion Bureau National' },
  { value: 'REUNION_REGION', label: '🗺️ Réunion régionale' },
  { value: 'EVENEMENT_EXTERNE', label: '🤝 Événement externe' },
  { value: 'AUTRE', label: '📌 Autre' },
];

export default function NewClaimPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [motive, setMotive] = useState('');
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [currentExpense, setCurrentExpense] = useState<Partial<ExpenseItem>>({
    type: 'CAR',
    date: new Date().toISOString().split('T')[0],
    passengers: [],
  });
  
  const [departure, setDeparture] = useState('');
  const [arrival, setArrival] = useState('');
  const [distance, setDistance] = useState('');
  const [fiscalPower, setFiscalPower] = useState('5');
  const [passengerName, setPassengerName] = useState('');
  const [passengerEmail, setPassengerEmail] = useState('');
  const [showDepartureSuggestions, setShowDepartureSuggestions] = useState(false);
  const [showArrivalSuggestions, setShowArrivalSuggestions] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState<any[]>([]);
  
  // Charger les tarifs depuis localStorage
  const [tarifs, setTarifs] = useState<any>({});
  
  useEffect(() => {
    loadUser();
    loadTarifs();
  }, []);
  
  function loadTarifs() {
    const saved = localStorage.getItem('admin_tarifs');
    if (saved) {
      const tarifsArray = JSON.parse(saved);
      const tarifsMap: any = {};
      tarifsArray.forEach((t: any) => {
        tarifsMap[t.category] = t;
      });
      setTarifs(tarifsMap);
    }
  }
  
  async function loadUser() {
    const testUser = localStorage.getItem('test_user');
    if (testUser) {
      setUser(JSON.parse(testUser));
      setCheckingAuth(false);
      return;
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }
    setUser(user);
    setCheckingAuth(false);
  }
  
  function handleCitySearch(value: string, isDepart: boolean) {
    if (value.length >= 2) {
      setCitySuggestions(searchCities(value));
      if (isDepart) {
        setShowDepartureSuggestions(true);
      } else {
        setShowArrivalSuggestions(true);
      }
    } else {
      setShowDepartureSuggestions(false);
      setShowArrivalSuggestions(false);
    }
  }
  
  // Calcul automatique pour frais kilométriques
  useEffect(() => {
    if (currentExpense.type === 'CAR' && distance && departure && arrival) {
      const km = parseFloat(distance);
      const power = parseInt(fiscalPower);
      const nbPassengers = (currentExpense.passengers?.length || 0) + 1; // +1 pour le conducteur
      
      if (km > 0) {
        const baseAmount = calculateKilometricAmount(km, power);
        const amount = currentExpense.isRoundTrip ? baseAmount * 2 : baseAmount;
        const amountPerPerson = amount / nbPassengers;
        const trip = currentExpense.isRoundTrip ? 'A/R' : 'Aller';
        const covoiturage = nbPassengers > 1 ? ` (${nbPassengers} pers.)` : '';
        
        setCurrentExpense(prev => ({
          ...prev,
          description: `${departure} → ${arrival} (${trip}, ${km}km, ${power}CV${covoiturage})`,
          amount: parseFloat(amountPerPerson.toFixed(2)),
          theoreticalMax: parseFloat(amount.toFixed(2)),
        }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distance, fiscalPower, departure, arrival]);
  
  // Recalcul quand on ajoute/retire des passagers
  useEffect(() => {
    if (currentExpense.type === 'CAR' && currentExpense.theoreticalMax) {
      const nbPassengers = (currentExpense.passengers?.length || 0) + 1;
      const amountPerPerson = currentExpense.theoreticalMax / nbPassengers;
      setCurrentExpense(prev => ({
        ...prev,
        amount: parseFloat(amountPerPerson.toFixed(2)),
      }));
    }
  }, [currentExpense.passengers, currentExpense.theoreticalMax, currentExpense.type]);
  
  function addPassenger() {
    if (!passengerName || !passengerEmail) {
      alert('Veuillez remplir le nom et l\'email du passager');
      return;
    }
    
    setCurrentExpense(prev => ({
      ...prev,
      passengers: [...(prev.passengers || []), { name: passengerName, email: passengerEmail }],
    }));
    
    setPassengerName('');
    setPassengerEmail('');
  }
  
  function removePassenger(index: number) {
    setCurrentExpense(prev => ({
      ...prev,
      passengers: prev.passengers?.filter((_, i) => i !== index) || [],
    }));
  }
  
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    setCurrentExpense(prev => ({
      ...prev,
      justificatifs: [...(prev.justificatifs || []), ...files],
    }));
  }
  
  function addExpense() {
    if (!currentExpense.description || !currentExpense.amount) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }
    
    // Vérifications spécifiques
    if (currentExpense.type === 'CAR' && (!currentExpense.fuelReceipt || !currentExpense.tollReceipt)) {
      if (!confirm('⚠️ Il manque des justificatifs (essence ou péage). Continuer quand même ?')) {
        return;
      }
    }
    
    const theoreticalMax = getTheoreticalMax(currentExpense.type!);
    const exceedsLimit = currentExpense.amount! > theoreticalMax;
    
    const newExpense: ExpenseItem = {
      id: Date.now().toString(),
      type: currentExpense.type as ExpenseType,
      description: currentExpense.description,
      amount: currentExpense.amount,
      theoreticalMax,
      date: currentExpense.date || new Date().toISOString().split('T')[0],
      justificatifs: currentExpense.justificatifs || [],
      departure: currentExpense.departure,
      arrival: currentExpense.arrival,
      isRoundTrip: currentExpense.isRoundTrip,
      passengers: currentExpense.passengers,
      fuelReceipt: currentExpense.fuelReceipt,
      tollReceipt: currentExpense.tollReceipt,
    };
    
    if (exceedsLimit) {
      alert(`⚠️ Attention : le montant dépasse le plafond de ${formatAmount(theoreticalMax)}. Votre demande nécessitera une validation manuelle.`);
    }
    
    setExpenses([...expenses, newExpense]);
    
    // Reset
    setCurrentExpense({
      type: 'CAR',
      date: new Date().toISOString().split('T')[0],
      passengers: [],
    });
    setDeparture('');
    setArrival('');
    setDistance('');
  }
  
  function getTheoreticalMax(type: ExpenseType): number {
    if (type === 'CAR' && currentExpense.theoreticalMax) {
      return currentExpense.theoreticalMax;
    }
    
    const tarifKey = {
      'TRAIN': 'TRAIN',
      'BUS': 'BUS',
      'MEAL': 'MEAL',
      'HOTEL': 'HOTEL',
    }[type];
    
    if (tarifKey && tarifs[tarifKey]) {
      return tarifs[tarifKey].max_amount || 999;
    }
    
    return 999;
  }
  
  function removeExpense(id: string) {
    setExpenses(expenses.filter(e => e.id !== id));
  }
  
  async function handleSubmit() {
    if (!motive || expenses.length === 0) {
      alert('Veuillez remplir le motif et ajouter au moins une dépense');
      return;
    }
    
    setLoading(true);
    try {
      const total = expenses.reduce((sum, e) => sum + e.amount, 0);
      
      const { data: claim, error } = await supabase
        .from('expense_claims')
        .insert({ user_id: user.id, motive, total_amount: total, status: 'draft' })
        .select()
        .single();
      
      if (error) throw error;
      
      // Upload des justificatifs
      for (const expense of expenses) {
        for (const file of expense.justificatifs) {
          const path = `${claim.id}/${Date.now()}_${file.name}`;
          await supabase.storage.from('justificatifs').upload(path, file);
          await supabase.from('justificatifs').insert({
            claim_id: claim.id,
            filename: file.name,
            storage_path: path,
            file_type: file.type,
            file_size: file.size,
          });
        }
      }
      
      alert('✅ Demande créée avec succès !');
      router.push('/claims');
    } catch (error: any) {
      alert('❌ Erreur : ' + error.message);
    } finally {
      setLoading(false);
    }
  }
  
  if (checkingAuth) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center py-12">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Vérification...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-4">📝 Nouvelle demande de remboursement</h1>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2">Motif de la demande *</label>
            <input
              type="text"
              value={motive}
              onChange={(e) => setMotive(e.target.value)}
              placeholder="Ex: Formation AFNEUS 2024, Déplacement réunion, etc."
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold mb-2">Type d'événement</label>
            <select
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sélectionnez un type</option>
              {EVENT_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Pour statistiques et comptabilité</p>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">➕ Ajouter une dépense</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-semibold mb-2">Type de dépense *</label>
            <select
              value={currentExpense.type}
              onChange={(e) => setCurrentExpense({ ...currentExpense, type: e.target.value as ExpenseType })}
              className="w-full px-4 py-2 border rounded-lg"
            >
              {EXPENSE_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-semibold mb-2">Date *</label>
            <input
              type="date"
              value={currentExpense.date}
              onChange={(e) => setCurrentExpense({ ...currentExpense, date: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>
        </div>
        
        {/* FRAIS KILOMÉTRIQUES */}
        {currentExpense.type === 'CAR' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h3 className="font-semibold mb-3 text-blue-900">🚗 Configuration du trajet</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="relative">
                <label className="block text-sm font-semibold mb-2">Départ *</label>
                <input
                  type="text"
                  value={departure}
                  onChange={(e) => { setDeparture(e.target.value); handleCitySearch(e.target.value, true); }}
                  placeholder="Ville de départ"
                  className="w-full px-4 py-2 border rounded-lg"
                />
                {showDepartureSuggestions && citySuggestions.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {citySuggestions.map((city, i) => (
                      <div
                        key={i}
                        onClick={() => { 
                          setDeparture(city.name); 
                          setShowDepartureSuggestions(false);
                          if (arrival) {
                            const dist = calculateDistance(city.name, arrival);
                            setDistance(dist.toString());
                          }
                        }}
                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer"
                      >
                        {city.name} ({city.code})
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="relative">
                <label className="block text-sm font-semibold mb-2">Arrivée *</label>
                <input
                  type="text"
                  value={arrival}
                  onChange={(e) => { setArrival(e.target.value); handleCitySearch(e.target.value, false); }}
                  placeholder="Ville d'arrivée"
                  className="w-full px-4 py-2 border rounded-lg"
                />
                {showArrivalSuggestions && citySuggestions.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                    {citySuggestions.map((city, i) => (
                      <div
                        key={i}
                        onClick={() => { 
                          setArrival(city.name); 
                          setShowArrivalSuggestions(false);
                          if (departure) {
                            const dist = calculateDistance(departure, city.name);
                            setDistance(dist.toString());
                          }
                        }}
                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer"
                      >
                        {city.name} ({city.code})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Distance (km) *</label>
                <input
                  type="number"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  placeholder="Ex: 150"
                  className="w-full px-4 py-2 border rounded-lg"
                />
                {distance && departure && arrival && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-xs text-yellow-800">
                      ℹ️ <strong>Distance approximative</strong> calculée automatiquement. 
                      Vous pouvez la modifier si nécessaire.
                    </p>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-2">Puissance fiscale *</label>
                <select
                  value={fiscalPower}
                  onChange={(e) => setFiscalPower(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="3">3 CV</option>
                  <option value="4">4 CV</option>
                  <option value="5">5 CV</option>
                  <option value="6">6 CV</option>
                  <option value="7">7 CV</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-2">Type de trajet</label>
                <label className="flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer hover:bg-blue-50">
                  <input
                    type="checkbox"
                    checked={currentExpense.isRoundTrip}
                    onChange={(e) => setCurrentExpense({ ...currentExpense, isRoundTrip: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span>Aller-retour</span>
                </label>
              </div>
            </div>
            
            {/* Covoiturage */}
            <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
              <h4 className="font-semibold mb-2">👥 Covoiturage (optionnel)</h4>
              <p className="text-sm text-gray-600 mb-3">
                Si d'autres membres étaient dans votre véhicule, ajoutez-les. Le montant sera divisé équitablement.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                <input
                  type="text"
                  value={passengerName}
                  onChange={(e) => setPassengerName(e.target.value)}
                  placeholder="Nom du passager"
                  className="px-3 py-2 border rounded-lg text-sm"
                />
                <input
                  type="email"
                  value={passengerEmail}
                  onChange={(e) => setPassengerEmail(e.target.value)}
                  placeholder="Email du passager"
                  className="px-3 py-2 border rounded-lg text-sm"
                />
                <button
                  onClick={addPassenger}
                  className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                >
                  ➕ Ajouter
                </button>
              </div>
              
              {currentExpense.passengers && currentExpense.passengers.length > 0 && (
                <div className="mt-2 space-y-1">
                  {currentExpense.passengers.map((p, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded text-sm">
                      <span>{p.name} ({p.email})</span>
                      <button
                        onClick={() => removePassenger(i)}
                        className="text-red-600 hover:text-red-800"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Justificatifs obligatoires */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <h4 className="font-semibold mb-2 text-yellow-900">📎 Justificatifs obligatoires</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Reçu essence/carburant *</label>
                  <input
                    type="file"
                    onChange={(e) => setCurrentExpense({ ...currentExpense, fuelReceipt: e.target.files?.[0] })}
                    className="w-full text-sm"
                    accept="image/*,.pdf"
                  />
                  {currentExpense.fuelReceipt && (
                    <p className="text-xs text-green-600 mt-1">✓ {currentExpense.fuelReceipt.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Reçu péage (si applicable) *</label>
                  <input
                    type="file"
                    onChange={(e) => setCurrentExpense({ ...currentExpense, tollReceipt: e.target.files?.[0] })}
                    className="w-full text-sm"
                    accept="image/*,.pdf"
                  />
                  {currentExpense.tollReceipt && (
                    <p className="text-xs text-green-600 mt-1">✓ {currentExpense.tollReceipt.name}</p>
                  )}
                </div>
              </div>
            </div>
            
            {currentExpense.amount && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">💰 Montant calculé :</span>
                  <span className="text-2xl font-bold text-green-700">{formatAmount(currentExpense.amount)}</span>
                </div>
                {currentExpense.theoreticalMax && currentExpense.passengers && currentExpense.passengers.length > 0 && (
                  <div className="text-sm text-gray-600 mt-2">
                    Montant total : {formatAmount(currentExpense.theoreticalMax)} ÷ {currentExpense.passengers.length + 1} personnes
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* TRAIN */}
        {currentExpense.type === 'TRAIN' && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
            <h3 className="font-semibold mb-3 text-purple-900">🚄 Informations du trajet</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Gare de départ *</label>
                <input
                  type="text"
                  value={departure}
                  onChange={(e) => setDeparture(e.target.value)}
                  placeholder="Ex: Paris Gare de Lyon"
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-2">Gare d'arrivée *</label>
                <input
                  type="text"
                  value={arrival}
                  onChange={(e) => setArrival(e.target.value)}
                  placeholder="Ex: Lyon Part-Dieu"
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Montant du billet *</label>
              <input
                type="number"
                step="0.01"
                value={currentExpense.amount || ''}
                onChange={(e) => {
                  const amount = parseFloat(e.target.value);
                  const maxTrain = tarifs['TRAIN']?.max_amount || 150;
                  setCurrentExpense({ 
                    ...currentExpense, 
                    amount,
                    description: `Train ${departure} → ${arrival}`,
                  });
                  if (amount > maxTrain) {
                    alert(`⚠️ Le montant dépasse le plafond de ${formatAmount(maxTrain)}`);
                  }
                }}
                placeholder="Prix réel du billet"
                className="w-full px-4 py-2 border rounded-lg"
              />
              {tarifs['TRAIN'] && (
                <p className="text-sm text-gray-600 mt-1">
                  Plafond : {formatAmount(tarifs['TRAIN'].max_amount)}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-semibold mb-2">Billet de train (PDF ou photo) *</label>
              <input
                type="file"
                onChange={handleFileUpload}
                className="w-full"
                accept="image/*,.pdf"
              />
            </div>
          </div>
        )}
        
        {/* BUS */}
        {currentExpense.type === 'BUS' && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
            <h3 className="font-semibold mb-3 text-orange-900">🚌 Informations du trajet</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Départ *</label>
                <input
                  type="text"
                  value={departure}
                  onChange={(e) => setDeparture(e.target.value)}
                  placeholder="Lieu de départ"
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-2">Arrivée *</label>
                <input
                  type="text"
                  value={arrival}
                  onChange={(e) => setArrival(e.target.value)}
                  placeholder="Lieu d'arrivée"
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Montant du billet *</label>
              <input
                type="number"
                step="0.01"
                value={currentExpense.amount || ''}
                onChange={(e) => {
                  const amount = parseFloat(e.target.value);
                  setCurrentExpense({ 
                    ...currentExpense, 
                    amount,
                    description: `Bus ${departure} → ${arrival}`,
                  });
                }}
                placeholder="Prix réel du billet"
                className="w-full px-4 py-2 border rounded-lg"
              />
              {tarifs['BUS'] && (
                <p className="text-sm text-gray-600 mt-1">
                  Plafond : {formatAmount(tarifs['BUS'].max_amount)}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-semibold mb-2">Billet (PDF ou photo) *</label>
              <input
                type="file"
                onChange={handleFileUpload}
                className="w-full"
                accept="image/*,.pdf"
              />
            </div>
          </div>
        )}
        
        {/* REPAS */}
        {currentExpense.type === 'MEAL' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <h3 className="font-semibold mb-3 text-yellow-900">🍽️ Frais de repas</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Description *</label>
              <input
                type="text"
                value={currentExpense.description || ''}
                onChange={(e) => setCurrentExpense({ ...currentExpense, description: e.target.value })}
                placeholder="Ex: Repas midi - Formation AFNEUS"
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Montant</label>
              <input
                type="number"
                step="0.01"
                value={currentExpense.amount || tarifs['MEAL']?.default_amount || 15}
                onChange={(e) => setCurrentExpense({ ...currentExpense, amount: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border rounded-lg"
              />
              {tarifs['MEAL'] && (
                <p className="text-sm text-gray-600 mt-1">
                  Forfait : {formatAmount(tarifs['MEAL'].default_amount)} | Plafond : {formatAmount(tarifs['MEAL'].max_amount)}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-semibold mb-2">Ticket de caisse (optionnel)</label>
              <input
                type="file"
                onChange={handleFileUpload}
                className="w-full"
                accept="image/*,.pdf"
              />
            </div>
          </div>
        )}
        
        {/* HOTEL */}
        {currentExpense.type === 'HOTEL' && (
          <div className="bg-pink-50 border border-pink-200 rounded-lg p-4 mb-4">
            <h3 className="font-semibold mb-3 text-pink-900">🏨 Hébergement</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Nom de l'hôtel *</label>
                <input
                  type="text"
                  value={currentExpense.description || ''}
                  onChange={(e) => setCurrentExpense({ ...currentExpense, description: e.target.value })}
                  placeholder="Ex: Ibis Lyon Centre"
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-2">Montant par nuit *</label>
                <input
                  type="number"
                  step="0.01"
                  value={currentExpense.amount || ''}
                  onChange={(e) => setCurrentExpense({ ...currentExpense, amount: parseFloat(e.target.value) })}
                  placeholder="Prix par nuit"
                  className="w-full px-4 py-2 border rounded-lg"
                />
                {tarifs['HOTEL'] && (
                  <p className="text-sm text-gray-600 mt-1">
                    Plafond : {formatAmount(tarifs['HOTEL'].max_amount)}/nuit
                  </p>
                )}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold mb-2">Facture de l'hôtel *</label>
              <input
                type="file"
                onChange={handleFileUpload}
                className="w-full"
                accept="image/*,.pdf"
              />
            </div>
          </div>
        )}
        
        {/* AUTRE */}
        {currentExpense.type === 'OTHER' && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Description *</label>
              <input
                type="text"
                value={currentExpense.description || ''}
                onChange={(e) => setCurrentExpense({ ...currentExpense, description: e.target.value })}
                placeholder="Décrivez la dépense"
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Montant *</label>
              <input
                type="number"
                step="0.01"
                value={currentExpense.amount || ''}
                onChange={(e) => setCurrentExpense({ ...currentExpense, amount: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold mb-2">Justificatif *</label>
              <input
                type="file"
                onChange={handleFileUpload}
                className="w-full"
                accept="image/*,.pdf"
              />
            </div>
          </div>
        )}
        
        <button
          onClick={addExpense}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
        >
          ➕ Ajouter cette dépense
        </button>
      </div>
      
      {/* Liste des dépenses */}
      {expenses.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📋 Dépenses ajoutées ({expenses.length})</h2>
          
          <div className="space-y-3">
            {expenses.map((expense) => (
              <div key={expense.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">
                      {EXPENSE_TYPES.find(t => t.value === expense.type)?.label}
                    </span>
                    {expense.amount > expense.theoreticalMax && (
                      <span className="text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded">
                        ⚠️ Hors plafond
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{expense.description}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {expense.date} | {expense.justificatifs.length} justificatif(s)
                    {expense.passengers && expense.passengers.length > 0 && (
                      <span> | {expense.passengers.length + 1} personnes</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xl font-bold">{formatAmount(expense.amount)}</span>
                  <button
                    onClick={() => removeExpense(expense.id)}
                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-6 pt-4 border-t flex justify-between items-center">
            <span className="text-lg font-semibold">Total de la demande :</span>
            <span className="text-3xl font-bold text-blue-600">
              {formatAmount(expenses.reduce((sum, e) => sum + e.amount, 0))}
            </span>
          </div>
          
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full mt-6 px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold text-lg"
          >
            {loading ? '⏳ Envoi en cours...' : '✅ Soumettre la demande'}
          </button>
        </div>
      )}
    </div>
  );
}
