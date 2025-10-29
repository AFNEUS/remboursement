// Liste des principales villes françaises pour autocomplétion avec coordonnées GPS
export const frenchCities = [
  { name: 'Paris', code: '75000', lat: 48.8566, lon: 2.3522 },
  { name: 'Marseille', code: '13000', lat: 43.2965, lon: 5.3698 },
  { name: 'Lyon', code: '69000', lat: 45.7640, lon: 4.8357 },
  { name: 'Toulouse', code: '31000', lat: 43.6047, lon: 1.4442 },
  { name: 'Nice', code: '06000', lat: 43.7102, lon: 7.2620 },
  { name: 'Nantes', code: '44000', lat: 47.2184, lon: -1.5536 },
  { name: 'Montpellier', code: '34000', lat: 43.6108, lon: 3.8767 },
  { name: 'Strasbourg', code: '67000', lat: 48.5734, lon: 7.7521 },
  { name: 'Bordeaux', code: '33000', lat: 44.8378, lon: -0.5792 },
  { name: 'Lille', code: '59000', lat: 50.6292, lon: 3.0573 },
  { name: 'Rennes', code: '35000', lat: 48.1173, lon: -1.6778 },
  { name: 'Reims', code: '51100', lat: 49.2583, lon: 4.0317 },
  { name: 'Saint-Étienne', code: '42000', lat: 45.4397, lon: 4.3872 },
  { name: 'Toulon', code: '83000', lat: 43.1242, lon: 5.9280 },
  { name: 'Le Havre', code: '76600', lat: 49.4944, lon: 0.1079 },
  { name: 'Grenoble', code: '38000', lat: 45.1885, lon: 5.7245 },
  { name: 'Dijon', code: '21000', lat: 47.3220, lon: 5.0415 },
  { name: 'Angers', code: '49000', lat: 47.4784, lon: -0.5632 },
  { name: 'Nîmes', code: '30000', lat: 43.8367, lon: 4.3601 },
  { name: 'Villeurbanne', code: '69100', lat: 45.7667, lon: 4.8800 },
  { name: 'Saint-Denis', code: '93200', lat: 48.9362, lon: 2.3574 },
  { name: 'Le Mans', code: '72000', lat: 48.0077, lon: 0.1984 },
  { name: 'Aix-en-Provence', code: '13100', lat: 43.5297, lon: 5.4474 },
  { name: 'Clermont-Ferrand', code: '63000', lat: 45.7772, lon: 3.0870 },
  { name: 'Brest', code: '29200', lat: 48.3905, lon: -4.4860 },
  { name: 'Tours', code: '37000', lat: 47.3941, lon: 0.6848 },
  { name: 'Amiens', code: '80000', lat: 49.8942, lon: 2.2957 },
  { name: 'Limoges', code: '87000', lat: 45.8336, lon: 1.2611 },
  { name: 'Annecy', code: '74000', lat: 45.8992, lon: 6.1294 },
  { name: 'Perpignan', code: '66000', lat: 42.6887, lon: 2.8948 },
  { name: 'Boulogne-Billancourt', code: '92100', lat: 48.8350, lon: 2.2420 },
  { name: 'Metz', code: '57000', lat: 49.1193, lon: 6.1757 },
  { name: 'Besançon', code: '25000', lat: 47.2380, lon: 6.0243 },
  { name: 'Orléans', code: '45000', lat: 47.9029, lon: 1.9093 },
  { name: 'Rouen', code: '76000', lat: 49.4432, lon: 1.0993 },
  { name: 'Mulhouse', code: '68100', lat: 47.7508, lon: 7.3359 },
  { name: 'Caen', code: '14000', lat: 49.1829, lon: -0.3707 },
  { name: 'Nancy', code: '54000', lat: 48.6921, lon: 6.1844 },
  { name: 'Argenteuil', code: '95100', lat: 48.9474, lon: 2.2472 },
  { name: 'Montreuil', code: '93100', lat: 48.8634, lon: 2.4439 },
];

export function searchCities(query: string, limit = 10) {
  if (!query || query.length < 2) return [];
  
  const lowerQuery = query.toLowerCase();
  return frenchCities
    .filter(city => city.name.toLowerCase().includes(lowerQuery))
    .slice(0, limit);
}

// Calcul de distance entre deux villes (formule de Haversine)
export function calculateDistance(city1: string, city2: string): number {
  const c1 = frenchCities.find(c => c.name.toLowerCase() === city1.toLowerCase());
  const c2 = frenchCities.find(c => c.name.toLowerCase() === city2.toLowerCase());
  
  if (!c1 || !c2) return 0;
  
  const R = 6371; // Rayon de la Terre en km
  const dLat = toRad(c2.lat - c1.lat);
  const dLon = toRad(c2.lon - c1.lon);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(c1.lat)) * Math.cos(toRad(c2.lat)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance);
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}
