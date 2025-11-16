// Liste complète des villes françaises principales pour autocomplétion
// Avec coordonnées GPS et population pour meilleure précision

export interface City {
  name: string;
  code: string;
  lat: number;
  lon: number;
  population?: number;
}

export const frenchCities: City[] = [
  // Top 50 villes par population
  { name: 'Paris', code: '75000', lat: 48.8566, lon: 2.3522, population: 2161000 },
  { name: 'Marseille', code: '13000', lat: 43.2965, lon: 5.3698, population: 870731 },
  { name: 'Lyon', code: '69000', lat: 45.7640, lon: 4.8357, population: 522969 },
  { name: 'Toulouse', code: '31000', lat: 43.6047, lon: 1.4442, population: 493465 },
  { name: 'Nice', code: '06000', lat: 43.7102, lon: 7.2620, population: 342669 },
  { name: 'Nantes', code: '44000', lat: 47.2184, lon: -1.5536, population: 314138 },
  { name: 'Montpellier', code: '34000', lat: 43.6108, lon: 3.8767, population: 290053 },
  { name: 'Strasbourg', code: '67000', lat: 48.5734, lon: 7.7521, population: 284677 },
  { name: 'Bordeaux', code: '33000', lat: 44.8378, lon: -0.5792, population: 257068 },
  { name: 'Lille', code: '59000', lat: 50.6292, lon: 3.0573, population: 232787 },
  { name: 'Rennes', code: '35000', lat: 48.1173, lon: -1.6778, population: 222485 },
  { name: 'Reims', code: '51100', lat: 49.2583, lon: 4.0317, population: 182460 },
  { name: 'Saint-Étienne', code: '42000', lat: 45.4397, lon: 4.3872, population: 172565 },
  { name: 'Toulon', code: '83000', lat: 43.1242, lon: 5.9280, population: 171953 },
  { name: 'Le Havre', code: '76600', lat: 49.4944, lon: 0.1079, population: 170147 },
  { name: 'Grenoble', code: '38000', lat: 45.1885, lon: 5.7245, population: 158454 },
  { name: 'Dijon', code: '21000', lat: 47.3220, lon: 5.0415, population: 156920 },
  { name: 'Angers', code: '49000', lat: 47.4784, lon: -0.5632, population: 155786 },
  { name: 'Nîmes', code: '30000', lat: 43.8367, lon: 4.3601, population: 151001 },
  { name: 'Villeurbanne', code: '69100', lat: 45.7667, lon: 4.8800, population: 150659 },
  { name: 'Saint-Denis', code: '93200', lat: 48.9362, lon: 2.3574, population: 113088 },
  { name: 'Le Mans', code: '72000', lat: 48.0077, lon: 0.1984, population: 145502 },
  { name: 'Aix-en-Provence', code: '13100', lat: 43.5297, lon: 5.4474, population: 143097 },
  { name: 'Clermont-Ferrand', code: '63000', lat: 45.7772, lon: 3.0870, population: 143886 },
  { name: 'Brest', code: '29200', lat: 48.3905, lon: -4.4860, population: 139342 },
  { name: 'Tours', code: '37000', lat: 47.3941, lon: 0.6848, population: 136463 },
  { name: 'Amiens', code: '80000', lat: 49.8942, lon: 2.2957, population: 134167 },
  { name: 'Limoges', code: '87000', lat: 45.8336, lon: 1.2611, population: 132175 },
  { name: 'Annecy', code: '74000', lat: 45.8992, lon: 6.1294, population: 130721 },
  { name: 'Perpignan', code: '66000', lat: 42.6887, lon: 2.8948, population: 120158 },
  { name: 'Boulogne-Billancourt', code: '92100', lat: 48.8350, lon: 2.2420, population: 120071 },
  { name: 'Metz', code: '57000', lat: 49.1193, lon: 6.1757, population: 117890 },
  { name: 'Besançon', code: '25000', lat: 47.2380, lon: 6.0243, population: 117080 },
  { name: 'Orléans', code: '45000', lat: 47.9029, lon: 1.9093, population: 116238 },
  { name: 'Rouen', code: '76000', lat: 49.4432, lon: 1.0993, population: 112321 },
  { name: 'Mulhouse', code: '68100', lat: 47.7508, lon: 7.3359, population: 109443 },
  { name: 'Caen', code: '14000', lat: 49.1829, lon: -0.3707, population: 106260 },
  { name: 'Nancy', code: '54000', lat: 48.6921, lon: 6.1844, population: 104885 },
  { name: 'Argenteuil', code: '95100', lat: 48.9474, lon: 2.2472, population: 110468 },
  { name: 'Montreuil', code: '93100', lat: 48.8634, lon: 2.4439, population: 109914 },

  // Villes moyennes importantes (51-120)
  { name: 'Saint-Paul', code: '97460', lat: -21.0100, lon: 55.2700, population: 107446 },
  { name: 'Roubaix', code: '59100', lat: 50.6901, lon: 3.1818, population: 98828 },
  { name: 'Dunkerque', code: '59140', lat: 51.0343, lon: 2.3767, population: 87353 },
  { name: 'Tourcoing', code: '59200', lat: 50.7221, lon: 3.1616, population: 97368 },
  { name: 'Avignon', code: '84000', lat: 43.9493, lon: 4.8055, population: 93671 },
  { name: 'Poitiers', code: '86000', lat: 46.5803, lon: 0.3404, population: 89212 },
  { name: 'Nanterre', code: '92000', lat: 48.8924, lon: 2.2071, population: 96704 },
  { name: 'Créteil', code: '94000', lat: 48.7897, lon: 2.4555, population: 94156 },
  { name: 'Versailles', code: '78000', lat: 48.8014, lon: 2.1301, population: 85346 },
  { name: 'Pau', code: '64000', lat: 43.2951, lon: -0.3708, population: 76691 },
  { name: 'La Rochelle', code: '17000', lat: 46.1603, lon: -1.1511, population: 77205 },
  { name: 'Calais', code: '62100', lat: 50.9513, lon: 1.8587, population: 74550 },
  { name: 'Antibes', code: '06600', lat: 43.5808, lon: 7.1283, population: 73798 },
  { name: 'Cannes', code: '06400', lat: 43.5528, lon: 7.0174, population: 74545 },
  { name: 'Béziers', code: '34500', lat: 43.3440, lon: 3.2191, population: 77177 },
  { name: 'Saint-Quentin', code: '02100', lat: 49.8467, lon: 3.2875, population: 54695 },
  { name: 'Colmar', code: '68000', lat: 48.0794, lon: 7.3588, population: 70284 },
  { name: 'Valence', code: '26000', lat: 44.9334, lon: 4.8924, population: 65238 },
  { name: 'Ajaccio', code: '20000', lat: 41.9192, lon: 8.7386, population: 71361 },
  { name: 'Quimper', code: '29000', lat: 47.9960, lon: -4.1024, population: 63513 },
  { name: 'Troyes', code: '10000', lat: 48.2973, lon: 4.0744, population: 61996 },
  { name: 'La Seyne-sur-Mer', code: '83500', lat: 43.1040, lon: 5.8846, population: 66258 },
  { name: 'Chambéry', code: '73000', lat: 45.5641, lon: 5.9178, population: 60076 },
  { name: 'Niort', code: '79000', lat: 46.3237, lon: -0.4578, population: 60202 },
  { name: 'Lorient', code: '56100', lat: 47.7482, lon: -3.3702, population: 57274 },
  { name: 'Sète', code: '34200', lat: 43.4075, lon: 3.6956, population: 44916 },
  { name: 'Saint-Nazaire', code: '44600', lat: 47.2735, lon: -2.2138, population: 71866 },
  { name: 'Vannes', code: '56000', lat: 47.6586, lon: -2.7599, population: 54020 },
  { name: 'Charleville-Mézières', code: '08000', lat: 49.7658, lon: 4.7195, population: 47017 },
  { name: 'Beauvais', code: '60000', lat: 49.4303, lon: 2.0848, population: 56254 },
  { name: 'Cholet', code: '49300', lat: 47.0600, lon: -0.8780, population: 55217 },
  { name: 'Laval', code: '53000', lat: 48.0734, lon: -0.7698, population: 52731 },
  { name: 'Belfort', code: '90000', lat: 47.6397, lon: 6.8628, population: 47656 },
  { name: 'Châteauroux', code: '36000', lat: 46.8103, lon: 1.6912, population: 44005 },
  { name: 'Saint-Brieuc', code: '22000', lat: 48.5141, lon: -2.7600, population: 46178 },
  { name: 'Blois', code: '41000', lat: 47.5861, lon: 1.3359, population: 46499 },
  { name: 'Arras', code: '62000', lat: 50.2913, lon: 2.7775, population: 41238 },
  { name: 'Châlons-en-Champagne', code: '51000', lat: 48.9566, lon: 4.3631, population: 44653 },
  { name: 'Tarbes', code: '65000', lat: 43.2328, lon: 0.0783, population: 42418 },
  { name: 'Albi', code: '81000', lat: 43.9298, lon: 2.1480, population: 51405 },
  { name: 'Bourg-en-Bresse', code: '01000', lat: 46.2056, lon: 5.2255, population: 42027 },
  { name: 'Carcassonne', code: '11000', lat: 43.2130, lon: 2.3491, population: 46513 },
  { name: 'Évreux', code: '27000', lat: 49.0269, lon: 1.1508, population: 48633 },
  { name: 'Auxerre', code: '89000', lat: 47.7989, lon: 3.5673, population: 36083 },
  { name: 'Chartres', code: '28000', lat: 48.4560, lon: 1.4839, population: 38752 },
  { name: 'Bourges', code: '18000', lat: 47.0811, lon: 2.3984, population: 66381 },
  { name: 'Angoulême', code: '16000', lat: 45.6500, lon: 0.1604, population: 42364 },
  { name: 'Saint-Malo', code: '35400', lat: 48.6493, lon: -2.0076, population: 46803 },
  { name: 'Agen', code: '47000', lat: 44.2033, lon: 0.6161, population: 34126 },
  { name: 'Mâcon', code: '71000', lat: 46.3078, lon: 4.8343, population: 33456 },
  { name: 'Montauban', code: '82000', lat: 44.0176, lon: 1.3548, population: 60444 },
  { name: 'Nevers', code: '58000', lat: 46.9897, lon: 3.1592, population: 34022 },
  { name: 'Gap', code: '05000', lat: 44.5596, lon: 6.0786, population: 41107 },
  { name: 'Vichy', code: '03200', lat: 46.1280, lon: 3.4267, population: 25279 },
  { name: 'Chalon-sur-Saône', code: '71100', lat: 46.7806, lon: 4.8531, population: 45093 },
  { name: 'Bayonne', code: '64100', lat: 43.4929, lon: -1.4748, population: 51228 },
  { name: 'Bastia', code: '20200', lat: 42.7025, lon: 9.4509, population: 48035 },
  { name: 'Saint-Pierre', code: '97410', lat: -21.3393, lon: 55.4781, population: 84000 },
  { name: 'Fort-de-France', code: '97200', lat: 14.6161, lon: -61.0588, population: 78126 },
  { name: 'Pointe-à-Pitre', code: '97110', lat: 16.2415, lon: -61.5339, population: 15821 },
  { name: 'Cayenne', code: '97300', lat: 4.9372, lon: -52.3260, population: 63652 },

  // Ajout des gares TGV importantes
  { name: 'Marne-la-Vallée', code: '77206', lat: 48.8544, lon: 2.7854, population: 30000 },
  { name: 'Roissy CDG', code: '95700', lat: 49.0097, lon: 2.5479, population: 0 },
  { name: 'Lyon Part-Dieu', code: '69003', lat: 45.7605, lon: 4.8600, population: 0 },
  { name: 'Lyon Perrache', code: '69002', lat: 45.7485, lon: 4.8269, population: 0 },
  { name: 'Aix-en-Provence TGV', code: '13090', lat: 43.4556, lon: 5.3175, population: 0 },
  { name: 'Avignon TGV', code: '84000', lat: 43.9217, lon: 4.7861, population: 0 },
  { name: 'Montpellier Sud de France', code: '34000', lat: 43.5761, lon: 3.9208, population: 0 },
];

/**
 * Recherche de villes avec meilleure pertinence
 */
export function searchCities(query: string, limit = 15): City[] {
  if (!query || query.length < 2) return [];

  const lowerQuery = query.toLowerCase().trim();

  // Normaliser pour recherche (enlever accents)
  const normalize = (str: string) =>
    str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const normalizedQuery = normalize(lowerQuery);

  // Scorer les résultats
  const scored = frenchCities
    .map(city => {
      const normalizedName = normalize(city.name);
      let score = 0;

      // Correspondance exacte = score max
      if (normalizedName === normalizedQuery) {
        score = 1000;
      }
      // Commence par la query
      else if (normalizedName.startsWith(normalizedQuery)) {
        score = 500 + (city.population || 0) / 10000;
      }
      // Contient la query
      else if (normalizedName.includes(normalizedQuery)) {
        score = 100 + (city.population || 0) / 10000;
      }
      // Code postal
      else if (city.code.startsWith(lowerQuery)) {
        score = 50;
      }

      return { city, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.city);

  return scored;
}

/**
 * Calcul de distance entre deux villes
 * Retourne la distance routière estimée (pas à vol d'oiseau)
 */
export function calculateDistance(city1: string, city2: string): number {
  const c1 = frenchCities.find(c =>
    c.name.toLowerCase() === city1.toLowerCase() ||
    normalize(c.name) === normalize(city1)
  );
  const c2 = frenchCities.find(c =>
    c.name.toLowerCase() === city2.toLowerCase() ||
    normalize(c.name) === normalize(city2)
  );

  if (!c1 || !c2) return 0;

  // Calcul distance à vol d'oiseau (Haversine)
  const R = 6371; // Rayon de la Terre en km
  const dLat = toRad(c2.lat - c1.lat);
  const dLon = toRad(c2.lon - c1.lon);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(c1.lat)) * Math.cos(toRad(c2.lat)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceVolOiseau = R * c;

  // Coefficient routier : environ 1.3x la distance à vol d'oiseau
  // (plus précis que distance directe, tient compte des routes)
  const COEFFICIENT_ROUTIER = 1.3;
  const distanceRoutiere = distanceVolOiseau * COEFFICIENT_ROUTIER;

  return Math.round(distanceRoutiere);
}

/**
 * Obtenir les informations d'une ville par son nom
 */
export function getCityByName(name: string): City | undefined {
  return frenchCities.find(c =>
    c.name.toLowerCase() === name.toLowerCase() ||
    normalize(c.name) === normalize(name)
  );
}

/**
 * Normaliser une chaîne (enlever accents)
 */
function normalize(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Obtenir le tarif train estimé selon la distance
 * (utilisé comme référence, à compléter avec API SNCF si disponible)
 */
export function getEstimatedTrainPrice(distanceKm: number): { standard: number; young: number } {
  // Tarifs moyens SNCF 2024 (estimation)
  if (distanceKm < 100) {
    return { standard: 25, young: 18 };
  } else if (distanceKm < 200) {
    return { standard: 45, young: 32 };
  } else if (distanceKm < 400) {
    return { standard: 75, young: 52 };
  } else if (distanceKm < 600) {
    return { standard: 105, young: 73 };
  } else if (distanceKm < 800) {
    return { standard: 135, young: 94 };
  } else {
    return { standard: 165, young: 115 };
  }
}
