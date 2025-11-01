import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error_description = requestUrl.searchParams.get('error_description');
  const next = requestUrl.searchParams.get('next') || '/dashboard';

  console.log('═══════════════════════════════════════');
  console.log('🔄 CALLBACK OAuth reçu');
  console.log('📍 URL complète:', requestUrl.href);
  console.log('🔑 Code présent:', !!code);
  console.log('📋 Tous les params:', Object.fromEntries(requestUrl.searchParams));
  console.log('═══════════════════════════════════════');

  // Gestion des erreurs OAuth
  if (error_description) {
    console.error('❌ Erreur OAuth de Google:', error_description);
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent(error_description)}`, requestUrl.origin)
    );
  }

  // Si pas de code, c'est que Supabase n'a pas redirigé correctement
  if (!code) {
    console.error('❌ AUCUN CODE OAuth trouvé !');
    console.error('� Cela signifie que Supabase Auth ne redirige pas correctement.');
    console.error('💡 Vérifie dans Supabase Dashboard → Auth → Providers → Google');
    console.error('💡 Que "Enable Sign in with Google" est bien COCHÉ');
    
    return NextResponse.redirect(
      new URL('/auth/login?error=Code+OAuth+manquant', requestUrl.origin)
    );
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    console.log('🔄 Échange code pour session...');
    const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (sessionError) {
      console.error('❌ Erreur exchangeCodeForSession:', sessionError);
      return NextResponse.redirect(
        new URL(`/auth/login?error=${encodeURIComponent(sessionError.message)}`, requestUrl.origin)
      );
    }

    if (!sessionData?.session || !sessionData?.user) {
      console.error('❌ Session/User manquants après échange');
      return NextResponse.redirect(
        new URL('/auth/login?error=Session+non+créée', requestUrl.origin)
      );
    }

    const user = sessionData.user;
    console.log('✅ Session créée !');
    console.log('👤 User ID:', user.id);
    console.log('📧 Email:', user.email);
    
    // Attendre que le trigger crée le profil
    console.log('⏳ Attente création profil (2 secondes)...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Récupérer le profil
    console.log('🔍 Récupération profil...');
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role, status')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      console.error('❌ Erreur récupération profil:', profileError);
      console.log('➡️ Redirection fallback vers /dashboard');
      return NextResponse.redirect(new URL('/dashboard', requestUrl.origin));
    }

    if (profile) {
      console.log('✅ Profil trouvé !');
      console.log('   📧 Email:', profile.email);
      console.log('   👤 Nom:', profile.first_name, profile.last_name);
      console.log('   🎭 Rôle:', profile.role);
      
      // Redirection selon rôle
      if (['ADMIN', 'TREASURER', 'VALIDATOR'].includes(profile.role)) {
        console.log('➡️ Redirection /dashboard (ADMIN/TREASURER/VALIDATOR)');
        return NextResponse.redirect(new URL('/dashboard', requestUrl.origin));
      } else {
        console.log('➡️ Redirection /claims (MEMBER)');
        return NextResponse.redirect(new URL('/claims', requestUrl.origin));
      }
    } else {
      console.log('⚠️ Profil non trouvé, redirection /dashboard par défaut');
      return NextResponse.redirect(new URL('/dashboard', requestUrl.origin));
    }
    
  } catch (error: any) {
    console.error('❌ EXCEPTION dans callback:', error);
    console.error('Stack trace:', error.stack);
    return NextResponse.redirect(
      new URL(`/auth/login?error=${encodeURIComponent('Erreur: ' + error.message)}`, requestUrl.origin)
    );
  }
}

