import axios, { AxiosHeaders } from "axios";

const baseURL = import.meta.env.VITE_API_BASE ?? "/api";

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

export const getAuthToken = () => authToken;

export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  unauthorizedHandler = handler;
};

const client = axios.create({
  baseURL,
  timeout: 15000,
});

client.interceptors.request.use((config) => {
  if (authToken) {
    let headers: AxiosHeaders;
    if (!config.headers) {
      headers = new AxiosHeaders();
    } else if (config.headers instanceof AxiosHeaders) {
      headers = config.headers;
    } else {
      headers = AxiosHeaders.from(config.headers);
    }
    headers.set("Authorization", `Bearer ${authToken}`);
    config.headers = headers;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = typeof error?.config?.url === "string" ? error.config.url : "";
    const isLoginRequest = requestUrl.includes("/auth/login");

    if (status === 401 && unauthorizedHandler && authToken && !isLoginRequest) {
      unauthorizedHandler();
    }
    return Promise.reject(error);
  },
);

export default client;
