// ================================================================
// API Route: /api/healthz
// ================================================================
// Health check endpoint pour monitoring (Vercel, uptime robots, etc.)
// ================================================================

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function GET() {
  const checks: Record<string, { status: 'ok' | 'error'; message?: string }> = {};

  // Check 1: Supabase connectivité
  try {
    const { error } = await supabase.from('users').select('count').limit(1).single();
    checks.supabase = error ? { status: 'error', message: error.message } : { status: 'ok' };
  } catch (e: any) {
    checks.supabase = { status: 'error', message: e.message };
  }

  // Check 2: Variables d'environnement critiques
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);
  checks.env = missingEnvVars.length > 0
    ? { status: 'error', message: `Missing: ${missingEnvVars.join(', ')}` }
    : { status: 'ok' };

  // Status global
  const allOk = Object.values(checks).every((check) => check.status === 'ok');
  const statusCode = allOk ? 200 : 503;

  return NextResponse.json(
    {
      status: allOk ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks,
      version: process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
    },
    { status: statusCode }
  );
}

export const dynamic = 'force-dynamic';
