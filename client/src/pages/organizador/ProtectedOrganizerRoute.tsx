import { useEffect } from "react";
import { useLocation } from "wouter";
import { useOrganizerAuth } from "@/contexts/OrganizerAuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedOrganizerRouteProps {
  children: React.ReactNode;
}

export default function ProtectedOrganizerRoute({ children }: ProtectedOrganizerRouteProps) {
  const { isAuthenticated, isLoading } = useOrganizerAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/organizadores/login");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
