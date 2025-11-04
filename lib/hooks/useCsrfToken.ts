// ================================================================
// 🪝 Hook React: CSRF Token
// ================================================================
// Récupère le token CSRF du serveur et l'injecte dans les requêtes
// ================================================================

'use client';

import { useEffect, useState } from 'react';

export function useCsrfToken() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Méthode 1: Depuis meta tag (injecté par layout)
    const meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement;
    if (meta?.content) {
      setToken(meta.content);
      return;
    }

    // Méthode 2: Fetch depuis header
    fetch('/api/csrf', { method: 'GET' })
      .then((res) => res.headers.get('X-CSRF-Token'))
      .then((csrfToken) => {
        if (csrfToken) {
          setToken(csrfToken);
        }
      })
      .catch((err) => console.error('[CSRF] Failed to fetch token', err));
  }, []);

  return token;
}

// ================================================================
// 🔒 Wrapper fetch sécurisé avec CSRF auto
// ================================================================
export async function secureFetch(
  url: string,
  options: RequestInit = {},
  csrfToken?: string | null
): Promise<Response> {
  const headers = new Headers(options.headers || {});

  // Ajouter CSRF token pour mutations
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method?.toUpperCase() || 'GET')) {
    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken);
    } else {
      console.warn('[CSRF] Token missing for mutation request');
    }
  }

  // Toujours JSON par défaut
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin', // Envoyer cookies
  });
}

// ================================================================
// 📝 Exemple d'utilisation
// ================================================================
/*
// Dans un composant:
import { useCsrfToken, secureFetch } from '@/lib/hooks/useCsrfToken';

export default function MyComponent() {
  const csrfToken = useCsrfToken();

  async function handleSubmit(data: any) {
    const response = await secureFetch('/api/claims/create', {
      method: 'POST',
      body: JSON.stringify(data),
    }, csrfToken);

    if (!response.ok) {
      const error = await response.json();
      alert(`Erreur: ${error.error}`);
      return;
    }

    const result = await response.json();
    console.log('Success:', result);
  }

  return <button onClick={() => handleSubmit({ ... })}>Soumettre</button>;
}
*/
