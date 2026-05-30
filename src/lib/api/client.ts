export class ApiClientError extends Error {
  status: number;
  details?: any;

  constructor(message: string, status: number, details?: any) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.details = details;
  }
}

export const fetcher = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, init);
  
  let json;
  try {
    json = await res.json();
  } catch (err) {
    // Si no es JSON y falló
    if (!res.ok) {
      throw new ApiClientError('Error en el servidor', res.status);
    }
    return null;
  }

  if (!res.ok) {
    throw new ApiClientError(json?.error || 'Error en la petición', res.status, json?.details);
  }

  // Si la respuesta usa el nuevo estándar
  if (json && typeof json === 'object' && 'success' in json) {
    if (!json.success) {
      throw new ApiClientError(json.error || 'Error desconocido', res.status, json.details);
    }
    return json.data;
  }

  // Para retrocompatibilidad con endpoints viejos
  return json;
};

// Utilidad para SWR
export const swrFetcher = (url: string) => fetcher(url);
