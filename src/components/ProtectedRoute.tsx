import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated, isVerified, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If user hasn't completed onboarding, redirect there
  if (user && !user.onboardingComplete && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  // If authenticated but not verified (needs security check), redirect to verify
  if (!isVerified && location.pathname !== "/verify") {
    return <Navigate to="/verify" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
