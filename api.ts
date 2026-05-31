import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => { accessToken = token; };
export const getAccessToken = () => accessToken;

const api: AxiosInstance = axios.create({ baseURL: `${BASE}/api`, withCredentials: true });

// Attach token
api.interceptors.request.use(cfg => {
  if (accessToken) cfg.headers.Authorization = `Bearer ${accessToken}`;
  return cfg;
});

// Silent refresh on 401
let refreshing: Promise<string> | null = null;
api.interceptors.response.use(
  r => r,
  async error => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }
    original._retry = true;
    if (!refreshing) {
      refreshing = axios
        .post(`${BASE}/api/auth/refresh`, {}, { withCredentials: true })
        .then(r => { accessToken = r.data.accessToken; return accessToken!; })
        .finally(() => { refreshing = null; });
    }
    try {
      const token = await refreshing;
      original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
      return api(original);
    } catch {
      accessToken = null;
      if (typeof window !== 'undefined') window.location.href = '/auth/login';
      return Promise.reject(error);
    }
  },
);

export default api;

// ─── Typed API helpers ────────────────────────────────────────────────────────
export const authApi = {
  login:   (discordId: string, password: string) => api.post('/auth/login', { discordId, password }),
  logout:  () => api.post('/auth/logout'),
};

export const usersApi = {
  list:        (params?: object)           => api.get('/users', { params }),
  get:         (id: string)                => api.get(`/users/${id}`),
  create:      (data: object)              => api.post('/users', data),
  update:      (id: string, data: object)  => api.patch(`/users/${id}`, data),
  ban:         (id: string, reason: string) => api.post(`/users/${id}/ban`, { reason }),
  unban:       (id: string)                => api.post(`/users/${id}/unban`),
  warn:        (id: string, reason: string) => api.post(`/users/${id}/warn`, { reason }),
  reprimand:   (id: string, reason: string) => api.post(`/users/${id}/reprimand`, { reason }),
  useItem:     (userId: string, itemId: string) => api.post(`/users/${userId}/inventory/${itemId}/use`),
};

export const pointsApi = {
  give:         (receiverId: string, amount: number, reason: string) =>
                  api.post('/points/give', { receiverId, amount, reason }),
  take:         (receiverId: string, amount: number, reason: string) =>
                  api.post('/points/take', { receiverId, amount, reason }),
  history:      (userId: string, page?: number) =>
                  api.get(`/points/history/${userId}`, { params: { page } }),
  leaderboard:  () => api.get('/points/leaderboard'),
};

export const modpassApi = {
  activeSeason:  () => api.get('/modpass/active'),
  taskProgress:  () => api.get('/modpass/tasks/progress'),
  updateTask:    (taskId: string, increment?: number) =>
                   api.post(`/modpass/tasks/${taskId}/progress`, { increment }),
  addXp:         (amount: number, source: string) =>
                   api.post('/modpass/xp/add', { amount, source }),
};

export const rolesApi = {
  list:    () => api.get('/roles'),
  create:  (data: object) => api.post('/roles', data),
  update:  (id: string, data: object) => api.patch(`/roles/${id}`, data),
  delete:  (id: string) => api.delete(`/roles/${id}`),
};

export const logsApi = {
  list: (params?: object) => api.get('/logs', { params }),
};
