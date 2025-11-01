// @ts-nocheck
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * 🔒 CALLBACK OAUTH SÉCURISÉ
 * 
 * Ce callback ne fait QUE :
 * 1. Échanger le code OAuth contre une session
 * 2. Vérifier que l'utilisateur existe dans public.users (créé par trigger)
 * 3. Rediriger vers la bonne page
 * 
 * ⚠️ SÉCURITÉ :
 * - Le trigger SQL crée automatiquement l'utilisateur avec le bon rôle
 * - Pas de création manuelle d'utilisateur (faille de sécurité)
 * - Pas de logs sensibles (tokens, etc.)
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error_description = requestUrl.searchParams.get('error_description');
  
  // Vérifier aussi les tokens dans le hash (mode Implicit Flow - fallback)
  const hash = requestUrl.hash;
  const hasAccessToken = hash && hash.includes('access_token=');

  // ═══════════════════════════════════════════════════════════
  // 1️⃣ VALIDATION : Erreurs OAuth
  // ═══════════════════════════════════════════════════════════
  if (error_description) {
    console.error('❌ OAuth Error:', error_description);
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent('Erreur d\'authentification')}`, requestUrl.origin)
    );
  }

  // ═══════════════════════════════════════════════════════════
  // 2️⃣ VALIDATION : Code OAuth ou Token présent
  // ═══════════════════════════════════════════════════════════
  if (!code && !hasAccessToken) {
    console.error('❌ No OAuth code or token');
    console.log('URL:', requestUrl.href);
    return NextResponse.redirect(
      new URL('/auth/login?error=Code+manquant', requestUrl.origin)
    );
  }
  
  // ⚠️ Si on reçoit un token dans le hash au lieu d'un code, 
  // c'est que Google OAuth est mal configuré (Implicit Flow au lieu de Code Flow)
  if (!code && hasAccessToken) {
    console.warn('⚠️ Received access_token in hash instead of code - OAuth misconfigured!');
    console.warn('👉 Fix: Supabase Dashboard → Auth → Providers → Google → Check redirect URL');
    console.warn('👉 Should be: https://[PROJECT].supabase.co/auth/v1/callback');
    
    // On redirige quand même vers le dashboard avec le token
    // Le navigateur va gérer la session via le hash fragment
    return NextResponse.redirect(new URL('/dashboard', requestUrl.origin));
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // ═══════════════════════════════════════════════════════════
    // 3️⃣ ÉCHANGE : Code OAuth → Session
    // ═══════════════════════════════════════════════════════════
    const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (sessionError || !sessionData?.session || !sessionData?.user) {
      console.error('❌ Session error:', sessionError?.message);
      return NextResponse.redirect(
        new URL('/auth/login?error=Session+invalide', requestUrl.origin)
      );
    }

    const user = sessionData.user;
    
    // ═══════════════════════════════════════════════════════════
    // 4️⃣ ATTENTE : Trigger crée l'utilisateur (asynchrone)
    // ═══════════════════════════════════════════════════════════
    // Le trigger SQL prend ~500ms pour s'exécuter
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // ═══════════════════════════════════════════════════════════
    // 5️⃣ VÉRIFICATION : Utilisateur existe dans public.users
    // ═══════════════════════════════════════════════════════════
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, email, role, status')
      .eq('id', user.id)
      .single();
    
    if (profileError || !profile) {
      // Si profil non trouvé, réessayer une fois (trigger peut être lent)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const { data: retryProfile } = await supabase
        .from('users')
        .select('id, email, role, status')
        .eq('id', user.id)
        .single();
      
      if (!retryProfile) {
        console.error('❌ Profile not found after trigger');
        return NextResponse.redirect(
          new URL('/auth/login?error=Profil+non+créé', requestUrl.origin)
        );
      }
    }
    
    // ═══════════════════════════════════════════════════════════
    // 6️⃣ REDIRECTION : Selon le rôle
    // ═══════════════════════════════════════════════════════════
    const finalProfile = profile || await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
      .then(r => r.data);
    
    if (!finalProfile) {
      return NextResponse.redirect(new URL('/dashboard', requestUrl.origin));
    }
    
    // ADMIN, TREASURER, VALIDATOR → Dashboard
    if (['ADMIN', 'TREASURER', 'VALIDATOR'].includes(finalProfile.role)) {
      return NextResponse.redirect(new URL('/dashboard', requestUrl.origin));
    }
    
    // MEMBER → Claims (demandes)
    return NextResponse.redirect(new URL('/claims', requestUrl.origin));
    
  } catch (error: any) {
    console.error('❌ Callback exception:', error.message);
    return NextResponse.redirect(
      new URL('/auth/login?error=Erreur+serveur', requestUrl.origin)
    );
  }
}
