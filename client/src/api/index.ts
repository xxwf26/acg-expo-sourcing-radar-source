import axios from 'axios';

const axiosForBackend = axios.create({
  baseURL: '',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// 请求拦截：从 localStorage 注入 JWT
axiosForBackend.interceptors.request.use((config) => {
  try {
    const auth = JSON.parse(localStorage.getItem('auth') || '{}');
    if (auth.token) {
      config.headers.Authorization = `Bearer ${auth.token}`;
    }
  } catch {
    // ignore
  }
  return config;
});

// 响应拦截：401 清登录态并刷新（回到登录页）
axiosForBackend.interceptors.response.use(
  (response) => response,
  (error) => {
    // eslint-disable-next-line no-console
    console.error('API Error:', error?.response?.status, error?.config?.url);
    if (error?.response?.status === 401) {
      localStorage.removeItem('auth');
      // 避免登录请求本身 401 时触发死循环刷新
      if (!String(error?.config?.url || '').includes('/api/auth/login')) {
        window.location.reload();
      }
    }
    return Promise.reject(error);
  },
);

export { axiosForBackend, axios };
export default axiosForBackend;
