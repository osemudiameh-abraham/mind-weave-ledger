import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
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

  const checkOnboarding = useCallback(async (userId: string): Promise<boolean> => {
    const { data } = await supabase
      .from("identity_profiles")
      .select("onboarding_complete")
      .eq("user_id", userId)
      .maybeSingle();
    return data?.onboarding_complete ?? false;
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const onboarded = await checkOnboarding(session.user.id);
        const account = toUserAccount(session.user, onboarded);
        localStorage.setItem("seven_user_name", account.name);
        setState({ user: account, isAuthenticated: true, isVerified: true, loading: false });
      } else {
        setState({ user: null, isAuthenticated: false, isVerified: false, loading: false });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const onboarded = await checkOnboarding(session.user.id);
        const account = toUserAccount(session.user, onboarded);
        localStorage.setItem("seven_user_name", account.name);
        setState({ user: account, isAuthenticated: true, isVerified: true, loading: false });
      } else {
        setState({ user: null, isAuthenticated: false, isVerified: false, loading: false });
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

    await supabase.from("identity_profiles").upsert({
      user_id: data.user.id,
      self_name: name.trim(),
      onboarding_complete: false,
    });
    await supabase.from("user_preferences").upsert({ user_id: data.user.id });

    localStorage.setItem("seven_user_name", name.trim());
    return { success: true };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("seven_user_name");
    localStorage.removeItem("seven_trial");
    setState({ user: null, isAuthenticated: false, isVerified: false, loading: false });
  }, []);

  const completeOnboarding = useCallback(async () => {
    if (!state.user) return;
    await supabase
      .from("identity_profiles")
      .update({ onboarding_complete: true })
      .eq("user_id", state.user.id);
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
    await supabase.from("identity_profiles").delete().eq("user_id", state.user.id);
    await supabase.from("memories_structured").delete().eq("user_id", state.user.id);
    await supabase.from("memory_facts").delete().eq("user_id", state.user.id);
    await supabase.from("decisions").delete().eq("user_id", state.user.id);
    await supabase.from("sections").delete().eq("user_id", state.user.id);
    await supabase.from("user_preferences").delete().eq("user_id", state.user.id);
    await supabase.auth.signOut();
    localStorage.removeItem("seven_user_name");
    setState({ user: null, isAuthenticated: false, isVerified: false, loading: false });
  }, [state.user]);

  const updateProfile = useCallback(async (updates: Partial<Pick<UserAccount, "name" | "email">>) => {
    if (!state.user) return;
    if (updates.name) {
      await supabase.auth.updateUser({ data: { name: updates.name } });
      await supabase.from("identity_profiles").update({ self_name: updates.name }).eq("user_id", state.user.id);
      localStorage.setItem("seven_user_name", updates.name);
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
