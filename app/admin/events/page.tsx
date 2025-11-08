// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

const EVENT_TYPES = [
  { value: 'CONGRES_ANNUEL', label: '🎓 Congrès annuel AFNEUS' },
  { value: 'WEEKEND_PASSATION', label: '🔄 Week-end de passation' },
  { value: 'FORMATION', label: '📚 Formation' },
  { value: 'REUNION_BN', label: '🏛️ Réunion Bureau National' },
  { value: 'REUNION_REGION', label: '🗺️ Réunion régionale' },
  { value: 'EVENEMENT_EXTERNE', label: '🤝 Événement externe' },
  { value: 'AUTRE', label: '📌 Autre' },
];

export default function EventsAdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  
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

  async function loadEvents() {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('start_date', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Erreur chargement événements:', error);
    }
  }

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
      allow_carpooling_bonus: event.allow_carpooling_bonus,
      max_train_amount: event.max_train_amount?.toString() || '',
      max_hotel_per_night: event.max_hotel_per_night?.toString() || '',
      max_meal_amount: event.max_meal_amount?.toString() || '',
      allowed_expense_types: event.allowed_expense_types || ['car', 'train', 'transport', 'meal', 'hotel', 'registration', 'other'],
    });
    setEditingEvent(event);
    setShowForm(true);
  }

    async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;

    try {
      const params = {
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
      };

      if (editingEvent) {
        const { data, error } = await supabase.rpc('update_event', {
          p_event_id: editingEvent.id,
          ...params,
        });

        if (error) throw error;
        if (!data) throw new Error('Échec de la mise à jour de l\'événement');
      } else {
        const { data, error } = await supabase.rpc('create_event', params);

        if (error) throw error;
        if (!data) throw new Error('Échec de la création de l\'événement');
      }

      await loadEvents();
      resetForm();
      setShowForm(false);
    } catch (error: any) {
      console.error('Error saving event:', error);
      alert(`❌ Erreur: ${error.message}`);
    }
  }

  async function handleDelete(event: any) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'événement "${event.name}" ?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', event.id);

      if (error) throw error;
      alert('✅ Événement supprimé');
      loadEvents();
    } catch (error: any) {
      alert(`❌ Erreur: ${error.message}`);
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  const getEventTypeLabel = (type: string) => {
    return EVENT_TYPES.find(t => t.value === type)?.label || type;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">📅 Gestion des événements</h1>
          <p className="text-gray-600">Configurez les barèmes spécifiques par événement</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          {showForm ? '❌ Annuler' : '➕ Nouvel événement'}
        </button>
      </div>

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

              <div>
                <label className="block text-sm font-semibold mb-2">Lieu</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => {
                    const newLocation = e.target.value;
                    setFormData({ 
                      ...formData, 
                      location: newLocation,
                      // Auto-suggest departure_city from location if empty
                      departure_city: formData.departure_city || newLocation
                    });
                  }}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Ex: Paris"
                />
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
              <div>
                <label className="block text-sm font-semibold mb-2">Ville de départ (pour barèmes train intelligents)</label>
                <input
                  type="text"
                  value={formData.departure_city}
                  onChange={(e) => setFormData({ ...formData, departure_city: e.target.value })}
                  placeholder="Ex: Paris"
                  className="w-full px-4 py-2 border rounded-lg"
                />
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
                  { value: 'car', label: '🚗 Voiture', emoji: '🚗' },
                  { value: 'train', label: '🚄 Train', emoji: '🚄' },
                  { value: 'transport', label: '🚌 Transport', emoji: '🚌' },
                  { value: 'meal', label: '🍽️ Repas', emoji: '🍽️' },
                  { value: 'hotel', label: '🏨 Hôtel', emoji: '🏨' },
                  { value: 'registration', label: '🎫 Inscription', emoji: '🎫' },
                  { value: 'other', label: '📦 Autre', emoji: '📦' },
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

      {/* LISTE DES ÉVÉNEMENTS */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">📋 Événements existants ({events.length})</h2>
        </div>
        <div className="p-6">
          {events.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucun événement créé</p>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <div key={event.id} className="border rounded-lg p-4 hover:bg-gray-50">
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
                        <div className="flex gap-4 mt-2 text-xs">
                          <span>🚗 {event.custom_km_cap}€/km</span>
                          <span>👥 Bonus: {event.allow_carpooling_bonus ? `${event.carpooling_bonus_cap_percent}%` : 'Non'}</span>
                          {event.max_train_amount && <span>🚄 Max train: {event.max_train_amount}€</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(event)}
                        className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition"
                      >
                        ✏️ Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(event)}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
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
