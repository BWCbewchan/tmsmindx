const LMS_API_URL = 'https://lms-api.mindx.edu.vn/graphql';

export interface GraphQLRequest {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

/**
 * Core function to call LMS API directly from the server.
 */
export async function callLmsApi<T>(request: GraphQLRequest, authHeader?: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // Timeout sau 10s

  try {
    const response = await fetch(LMS_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { 'Authorization': authHeader } : {}),
        'X-API-KEY': process.env.LMS_API_KEY || '',
      },
      body: JSON.stringify(request),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      await response.text().catch(() => '');
      throw new Error(`LMS API responded with status ${response.status}`);
    }

    const result = await response.json();

    if (result.errors?.length) {
      const messages = result.errors.map((e: any) => e.message).join('; ');
      throw new Error(`GraphQL error: ${messages}`);
    }

    return result as T;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('LMS API request timed out');
    }
    throw error;
  }
}
