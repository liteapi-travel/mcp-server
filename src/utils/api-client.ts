/**
 * Makes HTTP requests to LiteAPI endpoints
 */
export async function makeAPIRequest(
  baseUrl: string,
  method: string,
  path: string,
  apiKey: string,
  params: Record<string, any> = {},
  body?: any
): Promise<any> {
  // Replace path parameters
  let finalPath = path;
  const pathParams: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(params)) {
    if (finalPath.includes(`{${key}}`)) {
      finalPath = finalPath.replace(`{${key}}`, String(value));
      pathParams[key] = String(value);
    }
  }

  // Build URL with query parameters
  const url = new URL(finalPath, baseUrl);
  const queryParams: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(params)) {
    if (!pathParams[key] && value !== undefined && value !== null) {
      queryParams[key] = String(value);
    }
  }

  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  // Prepare headers
  const headers: Record<string, string> = {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  };

  // Prepare request options
  const options: RequestInit = {
    method: method.toUpperCase(),
    headers,
  };

  // Add body for POST, PUT, PATCH
  if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url.toString(), options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}\n${errorText}`
      );
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return await response.json();
    }
    
    return await response.text();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Unknown error: ${String(error)}`);
  }
}
