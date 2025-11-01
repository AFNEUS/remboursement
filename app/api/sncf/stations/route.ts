import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * API SNCF - Recherche de gares
 * Endpoint: /api/sncf/stations
 * 
 * Documentation: https://doc.navitia.io/#places
 */

interface SNCFPlace {
  id: string;
  name: string;
  quality: number;
  embedded_type: string;
  stop_area?: {
    id: string;
    name: string;
    label: string;
    coord: { lat: string; lon: string };
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: 'La recherche doit contenir au moins 2 caractères' },
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

    // Rechercher les gares avec l'API SNCF
    const url = `https://api.sncf.com/v1/coverage/sncf/places?q=${encodeURIComponent(query)}&type[]=stop_area&count=10`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${Buffer.from(sncfToken + ':').toString('base64')}`,
      },
    });

    if (!response.ok) {
      throw new Error(`SNCF API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.places || data.places.length === 0) {
      return NextResponse.json({
        success: true,
        stations: [],
        message: 'Aucune gare trouvée',
      });
    }

    // Formater les résultats
    const stations = data.places
      .filter((place: SNCFPlace) => place.embedded_type === 'stop_area')
      .map((place: SNCFPlace) => ({
        id: place.id,
        name: place.name,
        quality: place.quality,
        label: place.stop_area?.label || place.name,
        coordinates: place.stop_area?.coord ? {
          lat: parseFloat(place.stop_area.coord.lat),
          lon: parseFloat(place.stop_area.coord.lon),
        } : null,
      }))
      .slice(0, 10); // Limiter à 10 résultats

    return NextResponse.json({
      success: true,
      query,
      stations,
      count: stations.length,
    });

  } catch (error: any) {
    console.error('Erreur API SNCF stations:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Erreur serveur',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

// GET pour tests rapides
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || searchParams.get('query') || 'Paris';
  
  return POST(
    new NextRequest(request.url, {
      method: 'POST',
      body: JSON.stringify({ query }),
    })
  );
}
