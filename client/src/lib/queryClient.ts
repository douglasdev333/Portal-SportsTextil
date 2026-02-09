import { QueryClient, QueryFunction } from "@tanstack/react-query";

function redirectToLogin() {
  // Salvar a URL atual para redirecionar de volta após login
  const currentPath = window.location.pathname + window.location.search;
  if (currentPath !== "/login" && currentPath !== "/cadastro") {
    sessionStorage.setItem("redirectAfterLogin", currentPath);
  }
  window.location.href = "/login";
}

async function throwIfResNotOk(res: Response, redirectOn401 = true) {
  if (!res.ok) {
    // Se for erro 401, redirecionar para login
    if (res.status === 401 && redirectOn401) {
      redirectToLogin();
      throw new Error("Sessão expirada. Redirecionando para login...");
    }
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw" | "redirect";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (res.status === 401) {
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
      if (unauthorizedBehavior === "redirect") {
        redirectToLogin();
        throw new Error("Sessão expirada. Redirecionando para login...");
      }
    }

    await throwIfResNotOk(res, unauthorizedBehavior === "redirect");
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
