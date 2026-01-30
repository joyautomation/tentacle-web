// Client-side GraphQL utilities - routes through server-side API

export type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string; path?: string[] }>;
};

/**
 * Execute a GraphQL query or mutation via server-side proxy
 * This prevents exposing the GraphQL endpoint to the browser
 */
export async function graphql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<GraphQLResponse<T>> {
  const response = await fetch('/api/graphql', {
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
    throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Subscribe to GraphQL updates via Server-Sent Events
 * Routes through server-side proxy for SSE subscriptions
 */
export function subscribe<T = unknown>(
  subscriptionQuery: string,
  variables?: Record<string, unknown>,
  onData?: (data: T) => void,
  onError?: (error: Error) => void
): () => void {
  const params = new URLSearchParams({
    query: subscriptionQuery,
  });

  if (variables) {
    params.set('variables', JSON.stringify(variables));
  }

  const eventSource = new EventSource(`/api/graphql/subscribe?${params}`);

  // GraphQL Yoga uses 'next' event for subscription data
  const handleEvent = (event: MessageEvent) => {
    try {
      const result = JSON.parse(event.data);
      if (result.data && onData) {
        onData(result.data as T);
      }
      if (result.errors && onError) {
        onError(new Error(result.errors[0].message));
      }
    } catch (e) {
      if (onError) {
        onError(e instanceof Error ? e : new Error('Parse error'));
      }
    }
  };

  // Listen for both 'next' (GraphQL Yoga) and default message events
  eventSource.addEventListener('next', handleEvent);
  eventSource.onmessage = handleEvent;

  eventSource.onerror = () => {
    if (onError) {
      onError(new Error('Connection lost'));
    }
  };

  // Return cleanup function
  return () => {
    eventSource.removeEventListener('next', handleEvent);
    eventSource.close();
  };
}
