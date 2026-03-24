// Server-side GraphQL client - never imported on client

import { env } from '$env/dynamic/private';

export type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string; path?: string[] }>;
};

const graphqlEndpoint = env.GRAPHQL_URL || 'http://127.0.0.1:4000/graphql';

/**
 * Check if an error is a network connectivity error
 */
function isNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    (error.message.toLowerCase().includes('fetch') ||
      error.message.toLowerCase().includes('network') ||
      error.message.toLowerCase().includes('connection') ||
      error.message.toLowerCase().includes('econnrefused'))
  );
}

/**
 * Execute a GraphQL query or mutation (server-side only)
 * Returns a GraphQL response structure even on errors for consistent handling
 */
export async function graphql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<GraphQLResponse<T>> {
  try {
    console.log(`[graphql] Fetching ${graphqlEndpoint} with query: ${query.slice(0, 80)}...`);
    const response = await fetch(graphqlEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) {
      console.log(`[graphql] Response not OK: ${response.status}`);
      return {
        errors: [{ message: `GraphQL request failed: ${response.status} ${response.statusText}` }]
      };
    }

    const result = await response.json();
    console.log(`[graphql] Response:`, JSON.stringify(result).slice(0, 200));
    return result;
  } catch (error) {
    console.log(`[graphql] Error:`, error);
    if (isNetworkError(error)) {
      // Extract host from endpoint for clearer error message
      const url = new URL(graphqlEndpoint);
      return {
        errors: [{ message: `Cannot connect to GraphQL server at ${url.host}` }]
      };
    }
    return {
      errors: [{ message: error instanceof Error ? error.message : 'Unknown error' }]
    };
  }
}
