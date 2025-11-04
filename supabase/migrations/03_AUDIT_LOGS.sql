-- ================================================================
-- 📝 TABLE AUDIT_LOGS (Traçabilité actions sensibles)
-- ================================================================
-- Logs toutes les actions administratives critiques
-- ================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL,
  actor_id UUID REFERENCES public.users(id),
  actor_email TEXT,
  target_id UUID,
  target_email TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Seuls les admins peuvent voir les logs
CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Insertion via service role uniquement (pas de policy INSERT pour users)
-- Les logs sont insérés via supabaseAdmin dans les API routes

COMMENT ON TABLE public.audit_logs IS 'Logs d''audit pour traçabilité des actions sensibles (changements de rôles, élévation admin, exports SEPA, etc.)';
