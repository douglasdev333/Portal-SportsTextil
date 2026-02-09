import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { AdminUser } from "@shared/schema";

interface OrganizerAuthContextType {
  user: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; isNotOrganizer?: boolean }>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

const OrganizerAuthContext = createContext<OrganizerAuthContextType | null>(null);

export function OrganizerAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/auth/me", {
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.role === "organizador") {
          setUser(data.data);
          return;
        }
      }
      setUser(null);
    } catch (error) {
      console.error("Error fetching organizer user:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        if (data.data.role !== "organizador") {
          await fetch("/api/admin/auth/logout", {
            method: "POST",
            credentials: "include",
          });
          return { 
            success: false, 
            error: "Esta area e exclusiva para organizadores. Admins devem acessar /admin",
            isNotOrganizer: true
          };
        }
        setUser(data.data);
        return { success: true };
      }

      return { 
        success: false, 
        error: data.error?.message || "Erro ao fazer login" 
      };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: "Erro de conexao" };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/admin/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
    }
  };

  const refetch = async () => {
    setIsLoading(true);
    await fetchUser();
  };

  return (
    <OrganizerAuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refetch,
      }}
    >
      {children}
    </OrganizerAuthContext.Provider>
  );
}

export function useOrganizerAuth() {
  const context = useContext(OrganizerAuthContext);
  if (!context) {
    throw new Error("useOrganizerAuth must be used within OrganizerAuthProvider");
  }
  return context;
}
