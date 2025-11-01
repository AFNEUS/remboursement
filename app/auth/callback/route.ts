// @ts-nocheck
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

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
    const session = sessionData.session;
    console.log('✅ Session créée !');
    console.log('👤 User ID:', user.id);
    console.log('📧 Email:', user.email);
    console.log('🔑 Access Token présent:', !!session.access_token);
    console.log('🔑 Refresh Token présent:', !!session.refresh_token);
    
    // ✨ CRÉER L'UTILISATEUR DANS public.users S'IL N'EXISTE PAS
    console.log('🔍 Vérification existence utilisateur...');
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();
    
    if (!existingUser) {
      console.log('⚠️ Utilisateur non trouvé dans public.users, création...');
      
      // Déterminer le rôle et le statut
      const email = user.email || '';
      const status = email.includes('@afneus.org') ? 'BN' : 'MEMBER';
      const role = 
        email === 'mohameddhia.ounally@afneus.org' ? 'ADMIN' :
        email === 'yannis.loumouamou@afneus.org' ? 'TREASURER' :
        'MEMBER';
      
      // Créer l'utilisateur avec l'admin client
      // @ts-ignore - Supabase type generation issue
      const { error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          first_name: user.user_metadata?.given_name || user.email?.split('@')[0] || 'Utilisateur',
          last_name: user.user_metadata?.family_name || '',
          status: status,
          role: role,
        });
      
      if (createError) {
        console.error('❌ Erreur création utilisateur:', createError);
      } else {
        console.log('✅ Utilisateur créé avec succès !');
        console.log('   👤 Nom:', user.user_metadata?.given_name, user.user_metadata?.family_name);
        console.log('   🎭 Rôle:', role);
        console.log('   📊 Status:', status);
      }
    } else {
      console.log('✅ Utilisateur existe déjà dans public.users');
    }
    
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

