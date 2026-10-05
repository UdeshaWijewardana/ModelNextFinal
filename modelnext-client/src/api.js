const configuredApiBaseUrl = process.env.REACT_APP_API_BASE_URL;
const frontendHostname = typeof window === "undefined" ? "localhost" : window.location.hostname;
const localBackendOrigin = `http://${frontendHostname}:5000`;

// Keep the API on the same loopback hostname as the development page. This
// preserves HttpOnly SameSite=Lax session cookies for both localhost and 127.0.0.1.
export const API_BASE_URL = configuredApiBaseUrl || `${localBackendOrigin}/api`;
export const SERVER_BASE_URL = API_BASE_URL.replace(/\/api$/, "");

export const apiFetch = (path, options = {}) => fetch(`${API_BASE_URL}${path}`, {
  credentials: "include",
  ...options,
  headers: { "Content-Type": "application/json", ...(options.headers || {}) },
});

export const readJson = async (response) => {
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.error || "Request failed.");
  return data;
};

export const getCurrentUser = async () => readJson(await apiFetch("/auth/me"));
export const logout = async () => { await apiFetch("/auth/logout", { method: "POST" }); };
