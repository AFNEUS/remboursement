// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';

interface TrainStation {
  id: string;
  name: string;
  quality: number;
}

interface TrainSegment {
  id: string;
  from: string;
  to: string;
  fromStation?: TrainStation;
  toStation?: TrainStation;
  date: string;
  price?: number;
}

interface TrainJourneyFormProps {
  onJourneyChange: (segments: TrainSegment[], isRoundTrip: boolean) => void;
  initialDate?: string;
}

export default function TrainJourneyForm({ onJourneyChange, initialDate }: TrainJourneyFormProps) {
  const [journeyType, setJourneyType] = useState<'one-way' | 'round-trip' | 'multi'>('one-way');
  const [segments, setSegments] = useState<TrainSegment[]>([
    {
      id: '1',
      from: '',
      to: '',
      date: initialDate || new Date().toISOString().split('T')[0],
    },
  ]);

  const [searchingStation, setSearchingStation] = useState<{ segmentId: string; field: 'from' | 'to' } | null>(null);
  const [stationSuggestions, setStationSuggestions] = useState<TrainStation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Notifier le parent à chaque changement
    onJourneyChange(segments, journeyType === 'round-trip');
  }, [segments, journeyType]);

  // Recherche de gare SNCF via l'API
  async function searchStation(query: string, segmentId: string, field: 'from' | 'to') {
    if (query.length < 2) {
      setStationSuggestions([]);
      setSearchingStation(null);
      return;
    }

    setSearchingStation({ segmentId, field });
    setLoading(true);

    try {
      const response = await fetch('/api/sncf/stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (response.ok) {
        const data = await response.json();
        setStationSuggestions(data.stations || []);
      } else {
        setStationSuggestions([]);
      }
    } catch (error) {
      console.error('Erreur recherche gare:', error);
      setStationSuggestions([]);
    } finally {
      setLoading(false);
    }
  }

  function selectStation(station: TrainStation, segmentId: string, field: 'from' | 'to') {
    setSegments(segments.map(seg => {
      if (seg.id === segmentId) {
        return {
          ...seg,
          [field]: station.name,
          [`${field}Station`]: station,
        };
      }
      return seg;
    }));
    setStationSuggestions([]);
    setSearchingStation(null);
  }

  function updateSegment(id: string, field: keyof TrainSegment, value: any) {
    setSegments(segments.map(seg => seg.id === id ? { ...seg, [field]: value } : seg));
  }

  function addSegment() {
    const lastSegment = segments[segments.length - 1];
    setSegments([
      ...segments,
      {
        id: Date.now().toString(),
        from: lastSegment.to, // Le départ = l'arrivée du segment précédent
        to: '',
        fromStation: lastSegment.toStation,
        date: lastSegment.date,
      },
    ]);
  }

  function removeSegment(id: string) {
    if (segments.length > 1) {
      setSegments(segments.filter(seg => seg.id !== id));
    }
  }

  function handleJourneyTypeChange(type: 'one-way' | 'round-trip' | 'multi') {
    setJourneyType(type);
    
    if (type === 'one-way' && segments.length > 1) {
      // Garder seulement le premier segment
      setSegments([segments[0]]);
    } else if (type === 'round-trip' && segments.length === 1) {
      // Créer le retour automatiquement
      const outbound = segments[0];
      setSegments([
        outbound,
        {
          id: '2',
          from: outbound.to,
          to: outbound.from,
          fromStation: outbound.toStation,
          toStation: outbound.fromStation,
          date: outbound.date,
        },
      ]);
    }
  }

  return (
    <div className="space-y-4">
      {/* Type de trajet */}
      <div>
        <label className="block text-sm font-semibold mb-2">Type de trajet</label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={journeyType === 'one-way' ? 'default' : 'outline'}
            onClick={() => handleJourneyTypeChange('one-way')}
            className="flex-1"
          >
            🚄 Aller simple
          </Button>
          <Button
            type="button"
            variant={journeyType === 'round-trip' ? 'default' : 'outline'}
            onClick={() => handleJourneyTypeChange('round-trip')}
            className="flex-1"
          >
            🔄 Aller-retour
          </Button>
          <Button
            type="button"
            variant={journeyType === 'multi' ? 'default' : 'outline'}
            onClick={() => handleJourneyTypeChange('multi')}
            className="flex-1"
          >
            🗺️ Multi-destinations
          </Button>
        </div>
      </div>

      {/* Segments de trajet */}
      {segments.map((segment, index) => (
        <div key={segment.id} className="border border-gray-300 rounded-lg p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-700">
              {journeyType === 'round-trip' && index === 0 && '🚄 Aller'}
              {journeyType === 'round-trip' && index === 1 && '🔙 Retour'}
              {journeyType === 'multi' && `📍 Trajet ${index + 1}`}
              {journeyType === 'one-way' && '🚄 Trajet'}
            </h4>
            {journeyType === 'multi' && segments.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => removeSegment(segment.id)}
                className="text-red-600 hover:bg-red-50"
              >
                ❌ Supprimer
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Gare de départ */}
            <div className="relative">
              <label className="block text-sm font-medium mb-1">Gare de départ *</label>
              <input
                type="text"
                value={segment.from}
                onChange={(e) => {
                  updateSegment(segment.id, 'from', e.target.value);
                  searchStation(e.target.value, segment.id, 'from');
                }}
                placeholder="Ex: Paris Gare de Lyon"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              
              {/* Suggestions de gares pour DÉPART */}
              {searchingStation?.segmentId === segment.id && searchingStation?.field === 'from' && stationSuggestions.length > 0 && (
                <div className="absolute z-50 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                  {loading && (
                    <div className="p-3 text-center text-gray-500">
                      <div className="animate-spin inline-block w-4 h-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                      <span className="ml-2">Recherche...</span>
                    </div>
                  )}
                  {!loading && stationSuggestions.map((station, i) => (
                    <div
                      key={i}
                      onClick={() => selectStation(station, segment.id, 'from')}
                      className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                    >
                      <div className="font-medium text-gray-900">{station.name}</div>
                      <div className="text-xs text-gray-500">Qualité: {station.quality}/10</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Gare d'arrivée */}
            <div className="relative">
              <label className="block text-sm font-medium mb-1">Gare d&apos;arrivée *</label>
              <input
                type="text"
                value={segment.to}
                onChange={(e) => {
                  updateSegment(segment.id, 'to', e.target.value);
                  searchStation(e.target.value, segment.id, 'to');
                }}
                placeholder="Ex: Lyon Part-Dieu"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              
              {/* Suggestions de gares pour ARRIVÉE */}
              {searchingStation?.segmentId === segment.id && searchingStation?.field === 'to' && stationSuggestions.length > 0 && (
                <div className="absolute z-50 w-full bg-white border rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                  {loading && (
                    <div className="p-3 text-center text-gray-500">
                      <div className="animate-spin inline-block w-4 h-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                      <span className="ml-2">Recherche...</span>
                    </div>
                  )}
                  {!loading && stationSuggestions.map((station, i) => (
                    <div
                      key={i}
                      onClick={() => selectStation(station, segment.id, 'to')}
                      className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                    >
                      <div className="font-medium text-gray-900">{station.name}</div>
                      <div className="text-xs text-gray-500">Qualité: {station.quality}/10</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium mb-1">Date *</label>
              <input
                type="date"
                value={segment.date}
                onChange={(e) => updateSegment(segment.id, 'date', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Prix (optionnel) */}
          <div className="mt-3">
            <label className="block text-sm font-medium mb-1">Prix du billet (€)</label>
            <input
              type="number"
              step="0.01"
              value={segment.price || ''}
              onChange={(e) => updateSegment(segment.id, 'price', parseFloat(e.target.value) || undefined)}
              placeholder="Montant exact du billet"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Laissez vide pour estimation automatique via API SNCF
            </p>
          </div>
        </div>
      ))}

      {/* Bouton ajouter segment (mode multi uniquement) */}
      {journeyType === 'multi' && (
        <Button
          type="button"
          variant="outline"
          onClick={addSegment}
          className="w-full border-dashed border-2 hover:bg-blue-50"
        >
          ➕ Ajouter une destination
        </Button>
      )}

      {/* Résumé */}
      {segments.length > 0 && segments[0].from && segments[segments.length - 1].to && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">📋 Résumé du trajet</h4>
          <div className="text-sm text-blue-800">
            <p>
              {segments.map((seg, i) => (
                <span key={seg.id}>
                  {i > 0 && ' → '}
                  <strong>{seg.from}</strong>
                  {i === segments.length - 1 && ` → ${seg.to}`}
                </span>
              ))}
            </p>
            <p className="mt-2">
              Type: <strong>{
                journeyType === 'one-way' ? 'Aller simple' :
                journeyType === 'round-trip' ? 'Aller-retour' :
                `Multi-destinations (${segments.length} trajets)`
              }</strong>
            </p>
            {segments.some(s => s.price) && (
              <p className="mt-1">
                Prix total: <strong>{segments.reduce((sum, s) => sum + (s.price || 0), 0).toFixed(2)} €</strong>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
