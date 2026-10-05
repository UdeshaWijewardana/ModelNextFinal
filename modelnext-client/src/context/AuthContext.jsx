import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, readJson } from "../api";

const AuthContext = createContext(null);

export const accountRouteForRole = (role) => ({
  admin: "/admin",
  client: "/client-portal",
  model: "/dashboard",
  photographer: "/photographer-dashboard",
  agency: "/agency-dashboard",
}[role] || "/");

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: "loading", account: null, role: null, kind: null });

  const setAuthenticated = useCallback(({ account, kind = "user" }) => {
    const role = kind === "admin" ? "admin" : account?.role;
    setState({ status: "authenticated", account, role, kind });
  }, []);

  const restoreSession = useCallback(async () => {
    try {
      const userData = await readJson(await apiFetch("/auth/me"));
      setAuthenticated({ account: userData.user });
      return;
    } catch (_) {
      // A normal-user session is absent or expired. Admin sessions use a separate cookie.
    }

    try {
      const adminData = await readJson(await apiFetch("/admin/me"));
      setAuthenticated({ account: adminData.admin, kind: "admin" });
    } catch (_) {
      setState({ status: "unauthenticated", account: null, role: null, kind: null });
    }
  }, [setAuthenticated]);

  useEffect(() => { restoreSession(); }, [restoreSession]);

  const logout = useCallback(async () => {
    // Clear both independently-issued HttpOnly session cookies so an older session
    // cannot reappear after an explicit sign-out.
    await Promise.allSettled([
      apiFetch("/auth/logout", { method: "POST" }),
      apiFetch("/admin/logout", { method: "POST" }),
    ]);
    setState({ status: "unauthenticated", account: null, role: null, kind: null });
  }, []);

  const value = useMemo(() => ({
    ...state,
    isAuthenticated: state.status === "authenticated",
    accountRoute: accountRouteForRole(state.role),
    setAuthenticated,
    restoreSession,
    logout,
  }), [state, setAuthenticated, restoreSession, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
