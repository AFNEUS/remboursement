'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();
  const [role, setRole] = useState('');

  useEffect(() => {
    const testRole = localStorage.getItem('test_role');
    const testUser = localStorage.getItem('test_user');
    
    if (!testUser || testRole !== 'treasurer') {
      router.push('/');
      return;
    }
    
    setRole(testRole);
  }, [router]);

  if (!role) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">⏳ Vérification...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">👑 Administration AFNEUS</h1>
        <p className="text-gray-600">
          Panneau de configuration pour la gestion des remboursements
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gestion Utilisateurs */}
        <div 
          onClick={() => router.push('/admin/users')}
          className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg shadow-lg p-6 cursor-pointer hover:scale-105 transition-transform text-white"
        >
          <div className="text-4xl mb-4">👥</div>
          <h2 className="text-2xl font-bold mb-2">Gestion des Utilisateurs</h2>
          <p className="text-indigo-100 mb-4">
            Gérez les rôles et statuts de tous les membres AFNEUS
          </p>
          <ul className="text-sm text-indigo-100 space-y-1">
            <li>✓ Attribution des rôles (Admin, Validateur, Trésorier)</li>
            <li>✓ Statuts BN / Membre</li>
            <li>✓ Vue complète des droits</li>
          </ul>
        </div>

        {/* Créer Demande Admin */}
        <div 
          onClick={() => router.push('/admin/claims')}
          className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-6 cursor-pointer hover:scale-105 transition-transform text-white"
        >
          <div className="text-4xl mb-4">📝</div>
          <h2 className="text-2xl font-bold mb-2">Créer une Demande</h2>
          <p className="text-red-100 mb-4">
            Créez une demande de remboursement au nom de n'importe quel membre, même pour des dates passées
          </p>
          <ul className="text-sm text-red-100 space-y-1">
            <li>✓ Sélection du membre</li>
            <li>✓ Dates antérieures acceptées</li>
            <li>✓ Tous types de dépenses</li>
          </ul>
        </div>

        {/* Tarifs et Plafonds */}
        <div 
          onClick={() => router.push('/admin/tarifs')}
          className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 cursor-pointer hover:scale-105 transition-transform text-white"
        >
          <div className="text-4xl mb-4">💰</div>
          <h2 className="text-2xl font-bold mb-2">Tarifs et Plafonds</h2>
          <p className="text-blue-100 mb-4">
            Configurez les montants par défaut et les plafonds de remboursement pour tous les types de dépenses
          </p>
          <ul className="text-sm text-blue-100 space-y-1">
            <li>✓ Train, bus, péage, parking</li>
            <li>✓ Repas, hôtel, taxi</li>
            <li>✓ Plafonds et validations</li>
          </ul>
        </div>

        {/* Barèmes Kilométriques */}
        <div 
          onClick={() => router.push('/admin/baremes')}
          className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 cursor-pointer hover:scale-105 transition-transform text-white"
        >
          <div className="text-4xl mb-4">🚗</div>
          <h2 className="text-2xl font-bold mb-2">Barèmes Kilométriques</h2>
          <p className="text-green-100 mb-4">
            Gérez les taux de remboursement kilométrique selon la puissance fiscale (barème fiscal 2024)
          </p>
          <ul className="text-sm text-green-100 space-y-1">
            <li>✓ 3 à 7 CV configurables</li>
            <li>✓ Tranches 0-5000, 5001-20000, +20000 km</li>
            <li>✓ Inclut carburant, assurance, entretien</li>
          </ul>
        </div>

        {/* Validation */}
        <div 
          onClick={() => router.push('/validator')}
          className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 cursor-pointer hover:scale-105 transition-transform text-white"
        >
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-2xl font-bold mb-2">Validation des Demandes</h2>
          <p className="text-purple-100 mb-4">
            Validez ou refusez les demandes de remboursement en attente
          </p>
          <ul className="text-sm text-purple-100 space-y-1">
            <li>✓ Vue consolidée par demande</li>
            <li>✓ Vérification des justificatifs</li>
            <li>✓ Contrôle des calculs</li>
          </ul>
        </div>

        {/* Trésorerie */}
        <div 
          onClick={() => router.push('/treasurer')}
          className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 cursor-pointer hover:scale-105 transition-transform text-white"
        >
          <div className="text-4xl mb-4">💳</div>
          <h2 className="text-2xl font-bold mb-2">Trésorerie & Export SEPA</h2>
          <p className="text-orange-100 mb-4">
            Générez les fichiers de virement SEPA pour les demandes validées
          </p>
          <ul className="text-sm text-orange-100 space-y-1">
            <li>✓ Export fichier XML SEPA</li>
            <li>✓ Format pain.001.001.03</li>
            <li>✓ Traçabilité des paiements</li>
          </ul>
        </div>
      </div>

      <div className="mt-8 bg-blue-50 border-l-4 border-blue-400 p-6 rounded">
        <h3 className="text-lg font-semibold mb-2">🔧 Configuration Système</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-700"><strong>Calcul distance :</strong> ✅ Automatique (GPS)</p>
            <p className="text-gray-700"><strong>Barèmes :</strong> ✅ Fiscal 2024</p>
          </div>
        </div>
      </div>

      <div className="mt-6 text-sm text-gray-500">
        <p>💡 <strong>Astuce :</strong> Cliquez sur une carte pour accéder à la section correspondante.</p>
      </div>
    </div>
  );
}
