import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/src/lib/supabase";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";

try {
  WebBrowser.maybeCompleteAuthSession();
} catch (e) {
  console.warn("[AuraWealth] maybeCompleteAuthSession failed:", e);
}

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  loading: true,
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Retrieve existing session on mount
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    }).catch((err) => {
      console.warn("[AuraWealth] Failed to get session:", err);
      setLoading(false);
    });

    // Listen for auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    // Deep link handler for Email Confirmations & OAuth
    const handleDeepLink = async (event: Linking.EventType) => {
      if (event.url) {
        try {
          const urlObj = new URL(event.url);
          
          // Handle PKCE flow (code in search params)
          const code = urlObj.searchParams.get('code');
          if (code) {
            await supabase.auth.exchangeCodeForSession(code);
            return;
          }
          
          // Handle implicit flow (access_token in hash)
          if (urlObj.hash && urlObj.hash.includes('access_token')) {
            // URL hash starts with #, so we substring it
            const hashStr = urlObj.hash.substring(1);
            // Replace any ampersands that might be URL encoded improperly by some email clients, just in case
            const hashParams = new URLSearchParams(hashStr);
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            
            if (accessToken && refreshToken) {
              await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
            }
          }
        } catch (e) {
          console.error("Error parsing deep link URL:", e);
        }
      }
    };

    // Check if app was opened from a deep link (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    // Listen to deep links while app is running in background/foreground
    const linkSubscription = Linking.addEventListener("url", handleDeepLink);

    return () => {
      subscription.unsubscribe();
      linkSubscription.remove();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: Linking.createURL("/"),
        },
      });
      if (error) return { error: error.message || JSON.stringify(error) };
      return { error: null };
    } catch (err: any) {
      return { error: err.message || JSON.stringify(err) };
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return { error: error.message || JSON.stringify(error) };
      return { error: null };
    } catch (err: any) {
      return { error: err.message || JSON.stringify(err) };
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const redirectUrl = makeRedirectUri({
        scheme: "aurawealth",
      });
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const res = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
        
        if (res.type === "success" && res.url) {
          try {
            const urlObj = new URL(res.url);
            const code = urlObj.searchParams.get("code");
            if (code) {
              await supabase.auth.exchangeCodeForSession(code);
            } else if (urlObj.hash && urlObj.hash.includes('access_token')) {
              const hashParams = new URLSearchParams(urlObj.hash.substring(1));
              const accessToken = hashParams.get('access_token');
              const refreshToken = hashParams.get('refresh_token');
              if (accessToken && refreshToken) {
                await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                });
              }
            }
          } catch (e) {
            console.error("Failed to parse OAuth redirect URL", e);
          }
        }
      }
      return { error: null };
    } catch (err: any) {
      return { error: err.message || JSON.stringify(err) };
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
