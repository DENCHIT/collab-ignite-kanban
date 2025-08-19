import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

interface Profile {
  display_name: string;
  email: string;
}

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const location = useLocation();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile();
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          loadProfile();
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, email')
        .single();
        
      if (!error && data) {
        setProfile(data);
      }
    } catch (error) {
      console.warn('Failed to load profile:', error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    
    // Clear any legacy localStorage keys
    const keysToRemove = [
      'kanban_display_name', 
      'kanban_user_email', 
      'kanban_user_token'
    ];
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    // Clear any other kanban_* keys
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('kanban_')) {
        localStorage.removeItem(key);
      }
    });
    
    window.location.reload();
  };

  const isAdminRoute = location.pathname.startsWith("/admin");
  const isAccountRoute = location.pathname.startsWith("/account");

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center gap-3">
        <Link to="/" className="font-semibold tracking-tight">
          Zoby Boards
        </Link>
        <nav className="ml-4 hidden md:flex gap-2 text-sm text-muted-foreground">
          <Link to="/" className={!isAdminRoute && !isAccountRoute ? "text-foreground" : ""}>Home</Link>
          {user && (
            <>
              <span>•</span>
              <Link to="/account" className={isAccountRoute ? "text-foreground" : ""}>My Account</Link>
            </>
          )}
          <span>•</span>
          <Link to="/admin" className={isAdminRoute ? "text-foreground" : ""}>Admin</Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm text-muted-foreground hidden sm:inline">Signed in as</span>
              <Link 
                to="/account" 
                className="text-sm font-medium hover:text-primary underline"
              >
                {profile?.display_name || user.email}
              </Link>
              <button 
                onClick={handleLogout}
                className="text-sm text-muted-foreground hover:text-foreground underline cursor-pointer"
              >
                Logout
              </button>
            </>
          ) : (
            <Link 
              to="/" 
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
