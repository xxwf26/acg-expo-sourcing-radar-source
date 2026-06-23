import axios from 'axios';

const axiosForBackend = axios.create({
  baseURL: '',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

axiosForBackend.interceptors.response.use(
  (response) => response,
  (error) => {
    // eslint-disable-next-line no-console
    console.error('API Error:', error?.response?.status, error?.config?.url);
    return Promise.reject(error);
  },
);

export { axiosForBackend, axios };
export default axiosForBackend;
