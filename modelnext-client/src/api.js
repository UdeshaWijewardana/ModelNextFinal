export const API_BASE_URL = "http://localhost:5000/api";

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
