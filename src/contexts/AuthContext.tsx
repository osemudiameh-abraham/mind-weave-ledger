import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

// ─── Types ───────────────────────────────────────────────────────
export interface UserAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string; // In production, NEVER store plain passwords — use backend auth
  createdAt: string;
  onboardingComplete: boolean;
  trustedDevice: boolean;
  verifiedThisSession: boolean;
}

interface AuthState {
  user: UserAccount | null;
  isAuthenticated: boolean;
  isVerified: boolean; // Post-login security verification passed
}

interface AuthContextType extends AuthState {
  signUp: (name: string, email: string, password: string) => { success: boolean; error?: string };
  signIn: (email: string, password: string) => { success: boolean; error?: string; needsVerification?: boolean };
  signOut: () => void;
  completeOnboarding: () => void;
  verifyIdentity: (method: "password" | "biometric", value?: string) => boolean;
  trustDevice: (trust: boolean) => void;
  deleteAccount: () => void;
  updateProfile: (updates: Partial<Pick<UserAccount, "name" | "email">>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Storage helpers ─────────────────────────────────────────────
const ACCOUNTS_KEY = "seven_accounts";
const SESSION_KEY = "seven_session";

function getAccounts(): UserAccount[] {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]");
  } catch { return []; }
}

function saveAccounts(accounts: UserAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function getSession(): { userId: string; verified: boolean } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSession(userId: string, verified: boolean) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ userId, verified }));
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

// Simple hash (placeholder — real apps use bcrypt on the server)
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return "h_" + Math.abs(hash).toString(36);
}

// ─── Provider ────────────────────────────────────────────────────
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>(() => {
    const session = getSession();
    if (session) {
      const accounts = getAccounts();
      const user = accounts.find(a => a.id === session.userId) || null;
      if (user) {
        return { user, isAuthenticated: true, isVerified: session.verified };
      }
    }
    return { user: null, isAuthenticated: false, isVerified: false };
  });

  const signUp = useCallback((name: string, email: string, password: string) => {
    const accounts = getAccounts();
    const normalizedEmail = email.trim().toLowerCase();
    
    if (accounts.some(a => a.email === normalizedEmail)) {
      return { success: false, error: "An account with this email already exists" };
    }
    if (password.length < 6) {
      return { success: false, error: "Password must be at least 6 characters" };
    }

    const newUser: UserAccount = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: simpleHash(password),
      createdAt: new Date().toISOString(),
      onboardingComplete: false,
      trustedDevice: false,
      verifiedThisSession: true,
    };

    accounts.push(newUser);
    saveAccounts(accounts);
    saveSession(newUser.id, true);
    localStorage.setItem("seven_user_name", newUser.name);

    setState({ user: newUser, isAuthenticated: true, isVerified: true });
    return { success: true };
  }, []);

  const signIn = useCallback((email: string, password: string) => {
    const accounts = getAccounts();
    const normalizedEmail = email.trim().toLowerCase();
    const user = accounts.find(a => a.email === normalizedEmail);

    if (!user) {
      return { success: false, error: "No account found with this email" };
    }
    if (user.passwordHash !== simpleHash(password)) {
      return { success: false, error: "Incorrect password" };
    }

    const needsVerification = user.onboardingComplete && !user.trustedDevice;
    const verified = user.trustedDevice || !user.onboardingComplete;

    saveSession(user.id, verified);
    localStorage.setItem("seven_user_name", user.name);

    setState({ user, isAuthenticated: true, isVerified: verified });
    return { success: true, needsVerification };
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setState({ user: null, isAuthenticated: false, isVerified: false });
  }, []);

  const completeOnboarding = useCallback(() => {
    setState(prev => {
      if (!prev.user) return prev;
      const updated = { ...prev.user, onboardingComplete: true };
      const accounts = getAccounts().map(a => a.id === updated.id ? updated : a);
      saveAccounts(accounts);
      return { ...prev, user: updated };
    });
  }, []);

  const verifyIdentity = useCallback((method: "password" | "biometric", value?: string) => {
    if (!state.user) return false;

    if (method === "biometric") {
      // In production, this uses WebAuthn/platform authenticator
      // For now, simulate success
      saveSession(state.user.id, true);
      setState(prev => ({ ...prev, isVerified: true }));
      return true;
    }

    if (method === "password" && value) {
      if (state.user.passwordHash === simpleHash(value)) {
        saveSession(state.user.id, true);
        setState(prev => ({ ...prev, isVerified: true }));
        return true;
      }
      return false;
    }

    return false;
  }, [state.user]);

  const trustDevice = useCallback((trust: boolean) => {
    setState(prev => {
      if (!prev.user) return prev;
      const updated = { ...prev.user, trustedDevice: trust };
      const accounts = getAccounts().map(a => a.id === updated.id ? updated : a);
      saveAccounts(accounts);
      return { ...prev, user: updated };
    });
  }, []);

  const deleteAccount = useCallback(() => {
    if (!state.user) return;
    const accounts = getAccounts().filter(a => a.id !== state.user!.id);
    saveAccounts(accounts);
    clearSession();
    localStorage.removeItem("seven_user_name");
    localStorage.removeItem("seven_trial");
    setState({ user: null, isAuthenticated: false, isVerified: false });
  }, [state.user]);

  const updateProfile = useCallback((updates: Partial<Pick<UserAccount, "name" | "email">>) => {
    setState(prev => {
      if (!prev.user) return prev;
      const updated = { ...prev.user, ...updates };
      if (updates.name) localStorage.setItem("seven_user_name", updates.name);
      const accounts = getAccounts().map(a => a.id === updated.id ? updated : a);
      saveAccounts(accounts);
      return { ...prev, user: updated };
    });
  }, []);

  return (
    <AuthContext.Provider value={{
      ...state,
      signUp, signIn, signOut, completeOnboarding,
      verifyIdentity, trustDevice, deleteAccount, updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
