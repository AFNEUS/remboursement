"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { searchCities, frenchCities } from '@/lib/cities-france';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

// Event types constant
const EVENT_TYPES = [
  { value: 'CONGRES_ANNUEL', label: '🎓 Congrès annuel AFNEUS' },
  { value: 'WEEKEND_PASSATION', label: '🔄 Week-end de passation' },
  { value: 'FORMATION', label: '📚 Formation' },
  { value: 'REUNION_BN', label: '🏛️ Réunion Bureau National' },
  { value: 'REUNION_REGION', label: '🗺️ Réunion régionale' },
  { value: 'EVENEMENT_EXTERNE', label: '🤝 Événement externe' },
  { value: 'AUTRE', label: '📌 Autre' },
];

export default function AdminEventsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  
  const [citySuggestions, setCitySuggestions] = useState<any[]>([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [showDepartureSuggestions, setShowDepartureSuggestions] = useState(false);
  const locationInputRef = useRef<HTMLInputElement>(null);
  const departureInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    event_type: 'AUTRE',
    start_date: '',
    end_date: '',
    location: '',
    departure_city: '',
    custom_km_cap: '0.12',
    carpooling_bonus_cap_percent: '40',
    allow_carpooling_bonus: true,
    max_train_amount: '',
    max_hotel_per_night: '',
    max_meal_amount: '',
    allowed_expense_types: ['car', 'train', 'transport', 'meal', 'hotel', 'registration', 'other'],
  });

  // --- SNCF GRID STATE ---
  const [sncfGrid, setSncfGrid] = useState<any[]>([]);
  const [loadingGrid, setLoadingGrid] = useState(false);

  // Helper to get event type label
  function getEventTypeLabel(type: string) {
    const found = EVENT_TYPES.find(t => t.value === type);
    return found ? found.label : type;
  }

  // Helper to format date
  function formatDate(dateStr: string) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR');
  }

  // Fetch SNCF Grid
  const fetchSncfGrid = useCallback(async (destination: string) => {
    if (!destination) return;
    setLoadingGrid(true);
    const results: any[] = [];
    
    for (const city of frenchCities) {
      if (city.name === destination) continue;
      try {
        const res = await fetch('/api/sncf/prices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', // Important: inclure les cookies de session
          body: JSON.stringify({ 
            from: city.name, 
            to: destination, 
            datetime: new Date().toISOString() 
          })
        });
        const data = await res.json();
        results.push({ 
          from: city.name, 
          to: destination, 
          price: data.average_young_price || data.price || null 
        });
      } catch (e) {
        results.push({ from: city.name, to: destination, price: null });
      }
    }
    
    setSncfGrid(results);
    setLoadingGrid(false);
  }, []);

  // City input handler
  function handleCityInput(value: string, field: 'location' | 'departure_city') {
    if (value.length >= 2) {
      setCitySuggestions(searchCities(value));
      if (field === 'location') setShowLocationSuggestions(true);
      else setShowDepartureSuggestions(true);
    } else {
      setShowLocationSuggestions(false);
      setShowDepartureSuggestions(false);
    }
  }

  // Select city suggestion
  function selectCitySuggestion(cityName: string, field: 'location' | 'departure_city') {
    setFormData({ ...formData, [field]: cityName });
    setCitySuggestions([]);
    if (field === 'location') setShowLocationSuggestions(false);
    else setShowDepartureSuggestions(false);
  }

  // Load user
  async function loadUser() {
    const testUser = localStorage.getItem('test_user');
    if (testUser) {
      const parsedUser = JSON.parse(testUser);
      if (parsedUser.role !== 'ADMIN' && parsedUser.role !== 'admin_asso') {
        alert('❌ Accès réservé aux administrateurs');
        router.push('/');
        return;
      }
      setUser(parsedUser);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/');
      return;
    }
    
    // Vérifier le rôle via RPC
    const { data: userData } = await supabase.rpc('get_current_user_safe');
    if (userData && (userData as any).length > 0) {
      const dbUser = (userData as any)[0];
      if (dbUser.role !== 'admin_asso') {
        alert('❌ Accès réservé aux administrateurs');
        router.push('/');
        return;
      }
    }
    
    setUser(user);
  }

  // Load events
  async function loadEvents() {
    setLoading(true);
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('start_date', { ascending: false });

    if (error) {
      console.error('Erreur lors du chargement des événements:', error);
      alert('Erreur lors du chargement des événements');
      setLoading(false);
      return;
    }

    setEvents(data || []);
    setLoading(false);
  }

  // Reset form
  function resetForm() {
    setFormData({
      name: '',
      description: '',
      event_type: 'AUTRE',
      start_date: '',
      end_date: '',
      location: '',
      departure_city: '',
      custom_km_cap: '0.12',
      carpooling_bonus_cap_percent: '40',
      allow_carpooling_bonus: true,
      max_train_amount: '',
      max_hotel_per_night: '',
      max_meal_amount: '',
      allowed_expense_types: ['car', 'train', 'transport', 'meal', 'hotel', 'registration', 'other'],
    });
    setEditingEvent(null);
    setShowForm(false);
  }

  // Handle edit
  function handleEdit(event: any) {
    setFormData({
      name: event.name,
      description: event.description || '',
      event_type: event.event_type,
      start_date: event.start_date,
      end_date: event.end_date,
      location: event.location || '',
      departure_city: event.departure_city || '',
      custom_km_cap: event.custom_km_cap?.toString() || '0.12',
      carpooling_bonus_cap_percent: event.carpooling_bonus_cap_percent?.toString() || '40',
      allow_carpooling_bonus: event.allow_carpooling_bonus ?? true,
      max_train_amount: event.max_train_amount?.toString() || '',
      max_hotel_per_night: event.max_hotel_per_night?.toString() || '',
      max_meal_amount: event.max_meal_amount?.toString() || '',
      allowed_expense_types: event.allowed_expense_types || ['car', 'train', 'transport', 'meal', 'hotel', 'registration', 'other'],
    });
    setEditingEvent(event);
    setShowForm(true);
  }

  // Handle delete
  async function handleDelete(event: any) {
    if (!confirm(`Voulez-vous vraiment supprimer l'événement "${event.name}" ?`)) {
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', event.id);

    if (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression : ' + error.message);
      setLoading(false);
      return;
    }

    alert('✅ Événement supprimé avec succès');
    await loadEvents();
    setLoading(false);
  }

  // Handle submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingEvent) {
        // Update via RPC update_event
        const { error } = await supabase.rpc('update_event', {
          p_event_id: editingEvent.id,
          p_name: formData.name,
          p_description: formData.description,
          p_event_type: formData.event_type,
          p_start_date: formData.start_date,
          p_end_date: formData.end_date,
          p_location: formData.location,
          p_departure_city: formData.departure_city || null,
          p_custom_km_cap: parseFloat(formData.custom_km_cap),
          p_carpooling_bonus_cap_percent: parseFloat(formData.carpooling_bonus_cap_percent),
          p_allow_carpooling_bonus: formData.allow_carpooling_bonus,
          p_max_train_amount: formData.max_train_amount ? parseFloat(formData.max_train_amount) : null,
          p_max_hotel_per_night: formData.max_hotel_per_night ? parseFloat(formData.max_hotel_per_night) : null,
          p_max_meal_amount: formData.max_meal_amount ? parseFloat(formData.max_meal_amount) : null,
          p_allowed_expense_types: formData.allowed_expense_types,
        } as any);
        if (error) throw error;
        alert('✅ Événement modifié avec succès');
      } else {
        // Création via RPC create_event
        const { error } = await supabase.rpc('create_event', {
          p_name: formData.name,
          p_description: formData.description,
          p_event_type: formData.event_type,
          p_start_date: formData.start_date,
          p_end_date: formData.end_date,
          p_location: formData.location,
          p_departure_city: formData.departure_city || null,
          p_custom_km_cap: parseFloat(formData.custom_km_cap),
          p_carpooling_bonus_cap_percent: parseFloat(formData.carpooling_bonus_cap_percent),
          p_allow_carpooling_bonus: formData.allow_carpooling_bonus,
          p_max_train_amount: formData.max_train_amount ? parseFloat(formData.max_train_amount) : null,
          p_max_hotel_per_night: formData.max_hotel_per_night ? parseFloat(formData.max_hotel_per_night) : null,
          p_max_meal_amount: formData.max_meal_amount ? parseFloat(formData.max_meal_amount) : null,
          p_allowed_expense_types: formData.allowed_expense_types,
        } as any);
        if (error) throw error;
        alert('✅ Événement créé avec succès');
      }
      resetForm();
      await loadEvents();
    } catch (error: any) {
      console.error('Erreur:', error);
      alert('Erreur lors de la création/modification de l\'événement : ' + (error.message || error));
    } finally {
      setLoading(false);
    }
  }

  // Effects
  useEffect(() => {
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) {
      loadEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (formData.location && formData.location.length > 1) {
      fetchSncfGrid(formData.location);
    } else {
      setSncfGrid([]);
    }
  }, [formData.location, fetchSncfGrid]);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Bouton pour afficher le formulaire */}
      {!showForm && (
        <div className="mb-6">
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            ➕ Nouvel événement
          </button>
        </div>
      )}

      {/* FORMULAIRE */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-6">
            {editingEvent ? '✏️ Modifier l\'événement' : '➕ Nouvel événement'}
          </h2>
          <form onSubmit={handleSubmit}>
            {/* Informations de base */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold mb-2">Nom de l&apos;événement *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Ex: Congrès AFNEUS 2025"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Type d&apos;événement *</label>
                <select
                  value={formData.event_type}
                  onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  {EVENT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border rounded-lg"
                placeholder="Description de l'événement..."
              />
            </div>

            {/* Dates et lieu */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold mb-2">Date de début *</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Date de fin *</label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  required
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div className="relative">
                <label className="block text-sm font-semibold mb-2">Lieu</label>
                <input
                  type="text"
                  ref={locationInputRef}
                  value={formData.location}
                  onChange={e => {
                    const value = e.target.value;
                    setFormData({ ...formData, location: value });
                    handleCityInput(value, 'location');
                  }}
                  onFocus={() => formData.location.length >= 2 && setShowLocationSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 150)}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Ex: Paris"
                />
                {showLocationSuggestions && citySuggestions.length > 0 && (
                  <div className="absolute z-10 bg-white border rounded shadow w-full max-h-48 overflow-y-auto">
                    {citySuggestions.map(city => (
                      <div
                        key={city.name}
                        className="px-4 py-2 hover:bg-blue-100 cursor-pointer"
                        onMouseDown={() => selectCitySuggestion(city.name, 'location')}
                      >
                        {city.name} ({city.code})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Barèmes kilométriques */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold mb-4 text-blue-900">🚗 Barème kilométrique</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Plafond au km (€)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={formData.custom_km_cap}
                    onChange={(e) => setFormData({ ...formData, custom_km_cap: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                  <p className="text-xs text-gray-600 mt-1">Par défaut: 0.12€/km</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Bonus covoiturage max (%)</label>
                  <input
                    type="number"
                    value={formData.carpooling_bonus_cap_percent}
                    onChange={(e) => setFormData({ ...formData, carpooling_bonus_cap_percent: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                  <p className="text-xs text-gray-600 mt-1">Par défaut: 40%</p>
                </div>
              </div>
              <div className="mt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.allow_carpooling_bonus}
                    onChange={(e) => setFormData({ ...formData, allow_carpooling_bonus: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-semibold">Autoriser le bonus covoiturage</span>
                </label>
              </div>
            </div>

            {/* Plafonds spécifiques */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold mb-4 text-gray-900">💰 Plafonds spécifiques (optionnel)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Max train (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.max_train_amount}
                    onChange={(e) => setFormData({ ...formData, max_train_amount: e.target.value })}
                    placeholder="Ex: 150"
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Max hôtel/nuit (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.max_hotel_per_night}
                    onChange={(e) => setFormData({ ...formData, max_hotel_per_night: e.target.value })}
                    placeholder="Ex: 80"
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Max repas (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.max_meal_amount}
                    onChange={(e) => setFormData({ ...formData, max_meal_amount: e.target.value })}
                    placeholder="Ex: 20"
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                ℹ️ Laisser vide pour utiliser les barèmes par défaut
              </p>
            </div>

            {/* Ville de départ pour train */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold mb-4 text-purple-900">🚄 Configuration train</h3>
              <div className="relative">
                <label className="block text-sm font-semibold mb-2">Ville de départ (pour barèmes train intelligents)</label>
                <input
                  type="text"
                  ref={departureInputRef}
                  value={formData.departure_city}
                  onChange={e => {
                    const value = e.target.value;
                    setFormData({ ...formData, departure_city: value });
                    handleCityInput(value, 'departure_city');
                  }}
                  onFocus={() => formData.departure_city.length >= 2 && setShowDepartureSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowDepartureSuggestions(false), 150)}
                  placeholder="Ex: Paris"
                  className="w-full px-4 py-2 border rounded-lg"
                />
                {showDepartureSuggestions && citySuggestions.length > 0 && (
                  <div className="absolute z-10 bg-white border rounded shadow w-full max-h-48 overflow-y-auto">
                    {citySuggestions.map(city => (
                      <div
                        key={city.name}
                        className="px-4 py-2 hover:bg-blue-100 cursor-pointer"
                        onMouseDown={() => selectCitySuggestion(city.name, 'departure_city')}
                      >
                        {city.name} ({city.code})
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-600 mt-1">
                  💡 Si renseigné, le système utilisera automatiquement les barèmes SNCF pour cette ville
                </p>
              </div>
            </div>

            {/* Types de dépenses autorisées */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold mb-4 text-orange-900">📋 Types de dépenses autorisées</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { value: 'car', label: '🚗 Voiture' },
                  { value: 'train', label: '🚄 Train' },
                  { value: 'transport', label: '🚌 Transport' },
                  { value: 'meal', label: '🍽️ Repas' },
                  { value: 'hotel', label: '🏨 Hôtel' },
                  { value: 'registration', label: '🎫 Inscription' },
                  { value: 'other', label: '📦 Autre' },
                ].map((type) => (
                  <label key={type.value} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-orange-100 transition">
                    <input
                      type="checkbox"
                      checked={formData.allowed_expense_types.includes(type.value)}
                      onChange={(e) => {
                        const types = e.target.checked
                          ? [...formData.allowed_expense_types, type.value]
                          : formData.allowed_expense_types.filter((t) => t !== type.value);
                        setFormData({ ...formData, allowed_expense_types: types });
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{type.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-2">
                ℹ️ Seuls les types cochés seront disponibles lors de la création de demandes pour cet événement
              </p>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 transition"
              >
                {loading ? 'Enregistrement...' : (editingEvent ? '✅ Mettre à jour' : '✅ Créer l\'événement')}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grille des prix SNCF */}
      {showForm && formData.location && sncfGrid.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-2 text-blue-900">🚄 Grille indicative des prix SNCF vers {formData.location}</h3>
          {loadingGrid ? (
            <div className="text-blue-600">Chargement des prix...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-blue-100">
                    <th className="px-2 py-1 text-left">Départ</th>
                    <th className="px-2 py-1 text-left">Arrivée</th>
                    <th className="px-2 py-1 text-left">Prix jeune (estimation)</th>
                  </tr>
                </thead>
                <tbody>
                  {sncfGrid.map((row, idx) => (
                    <tr key={`${row.from}-${idx}`} className="border-b">
                      <td className="px-2 py-1">{row.from}</td>
                      <td className="px-2 py-1">{row.to}</td>
                      <td className="px-2 py-1">{row.price !== null && row.price >= 0.01 ? `${row.price} €` : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-blue-700 mt-2">💡 Ces prix sont indicatifs et peuvent varier selon la date, l&apos;heure et l&apos;anticipation.</p>
        </div>
      )}

      {/* LISTE DES ÉVÉNEMENTS */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">📋 Événements existants ({events.length})</h2>
        </div>
        <div className="p-6">
          {loading && events.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Chargement...</p>
          ) : events.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucun événement créé</p>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <div key={event.id} className="border rounded-lg p-4 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-lg">{event.name}</h3>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          {getEventTypeLabel(event.event_type)}
                        </span>
                      </div>
                      {event.description && (
                        <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                      )}
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>📅 {formatDate(event.start_date)} → {formatDate(event.end_date)}</div>
                        {event.location && <div>📍 {event.location}</div>}
                        <div className="flex flex-wrap gap-4 mt-2 text-xs">
                          <span>🚗 {event.custom_km_cap}€/km</span>
                          <span>👥 Bonus: {event.allow_carpooling_bonus ? `${event.carpooling_bonus_cap_percent}%` : 'Non'}</span>
                          {event.max_train_amount && <span>🚄 Max train: {event.max_train_amount}€</span>}
                          {event.max_hotel_per_night && <span>🏨 Max hôtel: {event.max_hotel_per_night}€</span>}
                          {event.max_meal_amount && <span>🍽️ Max repas: {event.max_meal_amount}€</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(event)}
                        className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition whitespace-nowrap"
                      >
                        ✏️ Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(event)}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition whitespace-nowrap"
                      >
                        🗑️ Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}