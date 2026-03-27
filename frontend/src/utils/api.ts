import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

async function getHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem('session_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request(method: string, path: string, body?: any) {
  const headers = await getHeaders();
  const res = await fetch(`${BACKEND_URL}/api${path}`, {
    method,
    headers,
    credentials: 'include' as RequestCredentials,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `${res.status}`);
  }
  return res.json();
}

export const api = {
  get: (path: string) => request('GET', path),
  post: (path: string, body?: any) => request('POST', path, body),
  put: (path: string, body?: any) => request('PUT', path, body),
  patch: (path: string, body?: any) => request('PATCH', path, body),
  del: (path: string) => request('DELETE', path),
};
