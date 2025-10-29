import axios from "axios";

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "/api",
  timeout: 15000,
});

http.interceptors.request.use((config) => {
  const t = localStorage.getItem("CFP_auth_token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});
