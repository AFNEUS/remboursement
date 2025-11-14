"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function DebugPage() {
  const [results, setResults] = useState<any>({});
  const [loading, setLoading] = useState(false);

  async function runDiagnostics() {
    setLoading(true);
    const diagnostics: any = {};

    // Test 1: Variables d'environnement
    diagnostics.env = {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Définie' : '❌ Manquante',
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Définie' : '❌ Manquante',
    };

    // Test 2: Session Supabase côté client
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      diagnostics.clientSession = {
        status: session ? '✅ Session active' : '❌ Pas de session',
        userId: session?.user?.id || 'N/A',
        email: session?.user?.email || 'N/A',
        error: error?.message || null,
      };
    } catch (error: any) {
      diagnostics.clientSession = {
        status: '❌ Erreur',
        error: error.message,
      };
    }

    // Test 3: Vérification auth via API
    try {
      const response = await fetch('/api/auth/check', { 
        credentials: 'include',
      });
      const data = await response.json();
      diagnostics.apiAuth = {
        status: response.ok ? '✅ OK' : '❌ Erreur',
        httpStatus: response.status,
        authenticated: data.authenticated,
        userId: data.user?.id || 'N/A',
        email: data.user?.email || 'N/A',
        error: data.error || null,
      };
    } catch (error: any) {
      diagnostics.apiAuth = {
        status: '❌ Erreur réseau',
        error: error.message,
      };
    }

    // Test 4: API Events (GET)
    try {
      const response = await fetch('/api/events', {
        credentials: 'include',
      });
      const data = await response.json();
      diagnostics.apiEvents = {
        status: response.ok ? '✅ OK' : '❌ Erreur',
        httpStatus: response.status,
        eventsCount: Array.isArray(data) ? data.length : 0,
        error: data.error || null,
      };
    } catch (error: any) {
      diagnostics.apiEvents = {
        status: '❌ Erreur réseau',
        error: error.message,
      };
    }

    // Test 5: RLS - Lecture directe events
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .limit(1);
      diagnostics.rlsEvents = {
        status: error ? '❌ Erreur RLS' : '✅ OK',
        error: error?.message || null,
        canRead: !error,
      };
    } catch (error: any) {
      diagnostics.rlsEvents = {
        status: '❌ Erreur',
        error: error.message,
      };
    }

    // Test 6: RLS - Lecture directe users
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, role')
        .limit(1);
      diagnostics.rlsUsers = {
        status: error ? '❌ Erreur RLS' : '✅ OK',
        error: error?.message || null,
        canRead: !error,
      };
    } catch (error: any) {
      diagnostics.rlsUsers = {
        status: '❌ Erreur',
        error: error.message,
      };
    }

    setResults(diagnostics);
    setLoading(false);
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">🔍 Diagnostic du système</h1>
      
      <button
        onClick={runDiagnostics}
        disabled={loading}
        className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 disabled:opacity-50 mb-6"
      >
        {loading ? 'Test en cours...' : '▶️ Lancer les tests'}
      </button>

      {Object.keys(results).length > 0 && (
        <div className="space-y-4">
          {Object.entries(results).map(([key, value]: [string, any]) => (
            <div key={key} className="bg-white p-4 rounded-lg shadow border">
              <h3 className="font-bold text-lg mb-2">
                {key === 'env' && '🔧 Variables d\'environnement'}
                {key === 'clientSession' && '👤 Session client'}
                {key === 'apiAuth' && '🔐 API Auth Check'}
                {key === 'apiEvents' && '📅 API Events'}
                {key === 'rlsEvents' && '🔒 RLS Events (lecture directe)'}
                {key === 'rlsUsers' && '🔒 RLS Users (lecture directe)'}
              </h3>
              <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
                {JSON.stringify(value, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 bg-yellow-50 border border-yellow-200 p-4 rounded">
        <h3 className="font-bold mb-2">📋 Instructions</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Cliquez sur &quot;Lancer les tests&quot;</li>
          <li>Attendez que tous les tests se terminent</li>
          <li>Copiez TOUS les résultats et envoyez-les moi</li>
          <li>Ouvrez aussi la console (F12) et envoyez les erreurs rouges</li>
        </ol>
      </div>
    </div>
  );
}
