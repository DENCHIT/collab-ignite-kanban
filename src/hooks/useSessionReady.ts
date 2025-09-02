import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export function useSessionReady() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // Get initial session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setReady(true);
    });

    // Then set up listener - keep it synchronous
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // Only synchronous state updates here
        setSession(session);
        setReady(true);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { 
    ready, 
    session,
    user: session?.user ?? null,
    userEmail: session?.user?.email ?? null
  };
}
