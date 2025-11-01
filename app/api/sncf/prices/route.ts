import { NextRequest, NextResponse } from 'next/server';

/**
 * API SNCF (Navitia) - Recherche de prix de billets train
 * 
 * Gratuit : 150 000 requêtes/mois (5000/jour)
 * Documentation : https://doc.navitia.io/
 * 
 * Pour obtenir un token gratuit :
 * https://numerique.sncf.com/startup/api/token-developpeur/
 */

interface SNCFJourney {
  from: string;
  to: string;
  datetime: string;
  price?: number;
  duration?: number;
  transfers?: number;
}

interface SNCFResponse {
  journeys: Array<{
    duration: number;
    nb_transfers: number;
    sections: Array<{
      type: string;
      from: { name: string; id: string };
      to: { name: string; id: string };
      duration: number;
    }>;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { from, to, datetime, passengers = 1 } = body;

    if (!from || !to) {
      return NextResponse.json(
        { error: 'Ville de départ et d\'arrivée requises' },
        { status: 400 }
      );
    }

    // Token SNCF depuis les variables d'environnement
    const sncfToken = process.env.SNCF_API_TOKEN;
    
    if (!sncfToken) {
      return NextResponse.json(
        { 
          error: 'Token SNCF non configuré',
          note: 'Obtenez un token gratuit sur https://numerique.sncf.com/startup/api/token-developpeur/'
        },
        { status: 500 }
      );
    }

    // 1. Rechercher les codes SNCF des gares
    const fromStation = await searchStation(from, sncfToken);
    const toStation = await searchStation(to, sncfToken);

    if (!fromStation || !toStation) {
      return NextResponse.json(
        { error: 'Gare non trouvée', from: fromStation, to: toStation },
        { status: 404 }
      );
    }

    // 2. Rechercher les itinéraires
    const journeys = await searchJourneys(
      fromStation.id,
      toStation.id,
      datetime || new Date().toISOString(),
      sncfToken
    );

    if (!journeys || journeys.length === 0) {
      return NextResponse.json(
        { error: 'Aucun trajet trouvé' },
        { status: 404 }
      );
    }

    // 3. Estimer les prix (Navitia ne fournit pas les prix réels)
    // On utilise une formule basée sur la distance et la durée
    const estimatedPrices = journeys.map(journey => {
      const durationHours = journey.duration / 3600;
      
      // Formules d'estimation basées sur les tarifs SNCF moyens 2024
      const basePrice = 15; // Prix de base
      const pricePerHour = 8; // Prix par heure de trajet
      const transferPenalty = journey.nb_transfers * 5; // Pénalité correspondances
      
      const estimatedPrice = basePrice + (durationHours * pricePerHour) + transferPenalty;
      
      // Tarif jeune (-30 ans) : -30% en moyenne
      const youngPrice = estimatedPrice * 0.70;
      
      // Tarif standard
      const standardPrice = estimatedPrice;
      
      return {
        journey,
        prices: {
          young: Math.round(youngPrice * 100) / 100,
          standard: Math.round(standardPrice * 100) / 100,
          first_class: Math.round(standardPrice * 1.5 * 100) / 100,
        },
        duration: journey.duration,
        duration_formatted: formatDuration(journey.duration),
        transfers: journey.nb_transfers,
      };
    });

    // Trier par prix croissant
    estimatedPrices.sort((a, b) => a.prices.young - b.prices.young);

    return NextResponse.json({
      success: true,
      from: { name: from, station: fromStation.name },
      to: { name: to, station: toStation.name },
      datetime,
      results: estimatedPrices.slice(0, 5), // Top 5 meilleurs trajets
      cheapest: estimatedPrices[0],
      average_young_price: Math.round(
        estimatedPrices.reduce((sum, p) => sum + p.prices.young, 0) / estimatedPrices.length * 100
      ) / 100,
      note: 'Prix estimés basés sur les tarifs moyens SNCF 2024. Pour les prix exacts, utilisez l\'API commerciale SNCF Connect.',
    });

  } catch (error: any) {
    console.error('Erreur API SNCF:', error);
    return NextResponse.json(
      { error: error.message || 'Erreur serveur' },
      { status: 500 }
    );
  }
}

async function searchStation(query: string, token: string) {
  const url = `https://api.sncf.com/v1/coverage/sncf/places?q=${encodeURIComponent(query)}&type[]=stop_area`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Basic ${Buffer.from(token + ':').toString('base64')}`,
    },
  });

  if (!response.ok) {
    throw new Error(`SNCF API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.places || data.places.length === 0) {
    return null;
  }

  // Prendre la première gare trouvée
  const place = data.places[0];
  return {
    id: place.id,
    name: place.name,
    quality: place.quality,
  };
}

async function searchJourneys(
  from: string,
  to: string,
  datetime: string,
  token: string
): Promise<SNCFResponse['journeys']> {
  // Format datetime pour SNCF (YYYYMMDDTHHmmss)
  const formattedDate = datetime.replace(/[-:]/g, '').split('.')[0];
  
  const url = `https://api.sncf.com/v1/coverage/sncf/journeys?from=${from}&to=${to}&datetime=${formattedDate}&count=10`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Basic ${Buffer.from(token + ':').toString('base64')}`,
    },
  });

  if (!response.ok) {
    throw new Error(`SNCF API error: ${response.status}`);
  }

  const data: SNCFResponse = await response.json();
  
  return data.journeys || [];
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h${minutes.toString().padStart(2, '0')}`;
}

// GET pour tester l'API
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from') || 'Paris';
  const to = searchParams.get('to') || 'Lyon';
  
  return POST(
    new NextRequest(request.url, {
      method: 'POST',
      body: JSON.stringify({ from, to }),
    })
  );
}
