import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

// ─── Types ───────────────────────────────────────────────────────
export interface UserAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  onboardingComplete: boolean;
  trustedDevice: boolean;
  verifiedThisSession: boolean;
}

interface AuthState {
  user: UserAccount | null;
  isAuthenticated: boolean;
  isVerified: boolean;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  signUp: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string; needsVerification?: boolean }>;
  signOut: () => void;
  completeOnboarding: () => Promise<void>;
  verifyIdentity: (method: "password" | "biometric", value?: string) => boolean;
  trustDevice: (trust: boolean) => void;
  deleteAccount: () => Promise<void>;
  updateProfile: (updates: Partial<Pick<UserAccount, "name" | "email">>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function toUserAccount(user: User, onboardingComplete: boolean): UserAccount {
  return {
    id: user.id,
    name: user.user_metadata?.name || user.email?.split("@")[0] || "User",
    email: user.email || "",
    passwordHash: "",
    createdAt: user.created_at,
    onboardingComplete,
    trustedDevice: true,
    verifiedThisSession: true,
  };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isVerified: false,
    loading: true,
  });

  // Prevent onAuthStateChange from resetting state during onboarding
  const isInitialized = useRef(false);
  const currentUserId = useRef<string | null>(null);

  const checkOnboarding = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("identity_profiles")
        .select("onboarding_complete")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        console.warn("checkOnboarding query failed:", error.message);
        return false;
      }
      return data?.onboarding_complete ?? false;
    } catch {
      return false;
    }
  }, []);

  // Hydrate session ONCE on mount
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;

        if (session?.user) {
          const onboarded = await checkOnboarding(session.user.id);
          if (cancelled) return;
          const account = toUserAccount(session.user, onboarded);
          localStorage.setItem("seven_user_name", account.name);
          currentUserId.current = session.user.id;
          setState({ user: account, isAuthenticated: true, isVerified: true, loading: false });
        } else {
          setState({ user: null, isAuthenticated: false, isVerified: false, loading: false });
        }
      } catch {
        if (!cancelled) {
          setState({ user: null, isAuthenticated: false, isVerified: false, loading: false });
        }
      }
      isInitialized.current = true;
    };

    init();
    return () => { cancelled = true; };
  }, [checkOnboarding]);

  // Listen for auth changes (sign in, sign out, token refresh)
  // But DON'T re-run onboarding check if same user — that causes the reset bug
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Skip if not initialized yet (init handles first load)
      if (!isInitialized.current) return;

      if (event === "SIGNED_OUT" || !session?.user) {
        currentUserId.current = null;
        setState({ user: null, isAuthenticated: false, isVerified: false, loading: false });
        return;
      }

      // If same user and just a token refresh, DON'T re-query onboarding
      // This is what was causing the onboarding reset
      if (event === "TOKEN_REFRESHED" && session.user.id === currentUserId.current) {
        return;
      }

      // New sign-in (different user or SIGNED_IN event)
      if (event === "SIGNED_IN" && session.user.id !== currentUserId.current) {
        const onboarded = await checkOnboarding(session.user.id).catch(() => false);
        const account = toUserAccount(session.user, onboarded);
        localStorage.setItem("seven_user_name", account.name);
        currentUserId.current = session.user.id;
        setState({ user: account, isAuthenticated: true, isVerified: true, loading: false });
      }
    });

    return () => subscription.unsubscribe();
  }, [checkOnboarding]);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { name: name.trim() } },
    });
    if (error) return { success: false, error: error.message };
    if (!data.user) return { success: false, error: "Sign up failed" };

    // Create identity_profiles and user_preferences rows (fire and forget — don't block sign-up)
    supabase.from("identity_profiles").upsert({
      user_id: data.user.id,
      self_name: name.trim(),
      onboarding_complete: false,
    }).then(({ error: e }) => { if (e) console.warn("identity_profiles upsert:", e.message); });

    supabase.from("user_preferences").upsert({
      user_id: data.user.id,
    }).then(({ error: e }) => { if (e) console.warn("user_preferences upsert:", e.message); });

    localStorage.setItem("seven_user_name", name.trim());

    // Set auth state immediately — don't wait for onAuthStateChange
    currentUserId.current = data.user.id;
    const account = toUserAccount(data.user, false);
    setState({ user: account, isAuthenticated: true, isVerified: true, loading: false });

    return { success: true };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) return { success: false, error: error.message };
    if (!data.user) return { success: false, error: "Sign in failed" };

    const onboarded = await checkOnboarding(data.user.id).catch(() => false);
    const account = toUserAccount(data.user, onboarded);
    localStorage.setItem("seven_user_name", account.name);
    currentUserId.current = data.user.id;
    setState({ user: account, isAuthenticated: true, isVerified: true, loading: false });

    return { success: true };
  }, [checkOnboarding]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    currentUserId.current = null;
    localStorage.removeItem("seven_user_name");
    localStorage.removeItem("seven_trial");
    setState({ user: null, isAuthenticated: false, isVerified: false, loading: false });
  }, []);

  const completeOnboarding = useCallback(async () => {
    if (!state.user) return;
    try {
      await supabase
        .from("identity_profiles")
        .update({ onboarding_complete: true })
        .eq("user_id", state.user.id);
    } catch {
      // Non-fatal — user can still proceed
    }
    setState((prev) => {
      if (!prev.user) return prev;
      return { ...prev, user: { ...prev.user, onboardingComplete: true } };
    });
  }, [state.user]);

  const verifyIdentity = useCallback((_method: "password" | "biometric", _value?: string) => {
    return true;
  }, []);

  const trustDevice = useCallback((_trust: boolean) => {}, []);

  const deleteAccount = useCallback(async () => {
    if (!state.user) return;

    // Server-side deletion (Architecture Section 19.8 — GDPR Article 17).
    // The Edge Function handles storage cleanup, FK-ordered row deletion,
    // anonymised audit record, and the auth.users delete itself.
    //
    // Any partial failure is surfaced as a thrown Error so the caller can
    // show a real error state. Only on full success do we clear local
    // session state and sign out.
    const { data, error } = await supabase.functions.invoke("delete-account", {
      body: {},
    });

    if (error) {
      console.error("[DELETE_ACCOUNT] Edge Function invocation failed:", error);
      throw new Error(error.message || "Account deletion failed. Please try again.");
    }

    // The Edge Function may return a 500 with details in data. The supabase-js
    // client does not throw on non-2xx; it returns the body. Detect and escalate.
    if (data && typeof data === "object" && "error" in data) {
      const remoteError = (data as { error?: string }).error || "Account deletion failed";
      console.error("[DELETE_ACCOUNT] Server reported error:", data);
      throw new Error(remoteError);
    }

    // Success — clear local session state. The Edge Function has already
    // deleted auth.users, so the current session is invalid; sign out cleans
    // the client-side token.
    await supabase.auth.signOut();
    currentUserId.current = null;
    localStorage.removeItem("seven_user_name");
    localStorage.removeItem("seven_trial_popup_shown");
    setState({ user: null, isAuthenticated: false, isVerified: false, loading: false });
  }, [state.user]);

  const updateProfile = useCallback(async (updates: Partial<Pick<UserAccount, "name" | "email">>) => {
    if (!state.user) return;
    if (updates.name) {
      localStorage.setItem("seven_user_name", updates.name);
      // Fire and forget — don't block the UI
      supabase.auth.updateUser({ data: { name: updates.name } }).catch(() => {});
      supabase.from("identity_profiles").update({ self_name: updates.name }).eq("user_id", state.user.id).then(() => {});
    }
    setState((prev) => {
      if (!prev.user) return prev;
      return { ...prev, user: { ...prev.user, ...updates } };
    });
  }, [state.user]);

  return (
    <AuthContext.Provider value={{
      ...state,
      signUp, signIn, signOut, completeOnboarding,
      verifyIdentity, trustDevice, deleteAccount, updateProfile,
    }}>
      {state.loading ? (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
