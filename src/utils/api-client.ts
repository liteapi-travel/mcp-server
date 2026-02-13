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
  // Handle baseUrl that may already have a path (e.g., https://api.liteapi.travel/v3.0)
  const baseUrlObj = new URL(baseUrl);
  
  // Construct the full path by appending the endpoint path to the base URL's pathname
  let fullPathname: string;
  
  if (finalPath.startsWith('/')) {
    // Path starts with / - need to append to baseUrl's pathname properly
    if (baseUrlObj.pathname && baseUrlObj.pathname !== '/') {
      // BaseUrl has a pathname like /v3.0, append the path (remove leading / from finalPath)
      fullPathname = baseUrlObj.pathname + (baseUrlObj.pathname.endsWith('/') ? '' : '/') + finalPath.slice(1);
    } else {
      // BaseUrl has no pathname or just /, use the path as-is
      fullPathname = finalPath;
    }
  } else {
    // Path doesn't start with /, append normally
    fullPathname = baseUrlObj.pathname.endsWith('/') 
      ? baseUrlObj.pathname + finalPath
      : baseUrlObj.pathname + '/' + finalPath;
  }
  
  const url = new URL(fullPathname, baseUrlObj.origin);
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

  // Debug logging (only in development)
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
    console.error(`[API Request] ${method.toUpperCase()} ${url.toString()}`);
    if (Object.keys(queryParams).length > 0) {
      console.error(`[API Request] Query params:`, queryParams);
    }
    if (body) {
      console.error(`[API Request] Body:`, JSON.stringify(body, null, 2));
    }
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
