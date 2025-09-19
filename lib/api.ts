import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  register: (data: { email: string; password: string; name?: string }) =>
    api.post('/auth/register', data),
  
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  
  logout: () =>
    api.post('/auth/logout'),
  
  getMe: () =>
    api.get('/auth/me'),
  
  updateApiKey: (apiKey: string) =>
    api.put('/auth/api-key', { apiKey }),
  
  updateGithubToken: (token: string) =>
    api.put('/auth/github-token', { token })
};

// Tasks API
export const tasksApi = {
  list: (params?: { status?: string; priority?: string; limit?: number; offset?: number }) =>
    api.get('/tasks', { params }),
  
  get: (id: string) =>
    api.get(`/tasks/${id}`),
  
  create: (data: { title: string; requirements: string; priority?: string }) =>
    api.post('/tasks', data),
  
  update: (id: string, data: any) =>
    api.put(`/tasks/${id}`, data),
  
  delete: (id: string) =>
    api.delete(`/tasks/${id}`),
  
  getProgress: (id: string) =>
    api.get(`/tasks/${id}/progress`),
  
  approve: (id: string, gateId: string, approved: boolean, notes?: string) =>
    api.post(`/tasks/${id}/approve`, { gateId, approved, notes })
};

// Triage API
export const triageApi = {
  start: (taskId: string) =>
    api.post('/triage/start', { taskId }),
  
  getQuestions: (taskId: string) =>
    api.get(`/triage/${taskId}/questions`),
  
  answerQuestion: (questionId: string, answer: string) =>
    api.post('/triage/answer', { questionId, answer }),
  
  complete: (taskId: string) =>
    api.post(`/triage/${taskId}/complete`)
};

// Review API
export const reviewApi = {
  start: (taskId: string, files: any[]) =>
    api.post('/review/start', { taskId, files }),
  
  getReviews: (taskId: string, params?: any) =>
    api.get(`/review/${taskId}/reviews`, { params }),
  
  resolve: (reviewId: string, status: string) =>
    api.put('/review/resolve', { reviewId, status }),
  
  suggestFix: (reviewId: string) =>
    api.post(`/review/${reviewId}/suggest-fix`)
};

// GitHub API
export const githubApi = {
  createPR: (data: any) =>
    api.post('/github/pr/create', data),
  
  createIssue: (data: any) =>
    api.post('/github/issue/create', data),
  
  linkIssue: (taskId: string, repository: string, issueNumber: number) =>
    api.post('/github/issue/link', { taskId, repository, issueNumber }),
  
  getStatus: (taskId: string) =>
    api.get(`/github/${taskId}/status`),
  
  listRepos: () =>
    api.get('/github/repos')
};

// MCP API
export const mcpApi = {
  getStatus: () =>
    api.get('/mcp/status'),
  
  listTools: (server?: string) =>
    api.get('/mcp/tools', { params: { server } }),
  
  callTool: (server: string, tool: string, args: any) =>
    api.post('/mcp/call', { server, tool, args }),
  
  readFile: (path: string) =>
    api.post('/mcp/fs/read', { path }),
  
  writeFile: (path: string, content: string) =>
    api.post('/mcp/fs/write', { path, content }),
  
  listDirectory: (path: string) =>
    api.post('/mcp/fs/list', { path })
};

export default api;