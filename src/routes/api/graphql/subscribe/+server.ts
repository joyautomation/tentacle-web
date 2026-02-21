import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

const graphqlEndpoint = env.GRAPHQL_URL || 'http://localhost:4000/graphql';

/**
 * SSE proxy for GraphQL subscriptions
 * Forwards SSE events from the upstream GraphQL server to the client
 * without exposing the GraphQL endpoint URL
 */
export const GET: RequestHandler = async ({ url, request }) => {
  const query = url.searchParams.get('query');
  const variables = url.searchParams.get('variables');

  if (!query) {
    return new Response('Query parameter is required', { status: 400 });
  }

  const params = new URLSearchParams({ query });
  if (variables) {
    params.set('variables', variables);
  }

  // AbortController to cancel upstream fetch when client disconnects
  const abortController = new AbortController();

  // Listen for client disconnect
  request.signal.addEventListener('abort', () => {
    abortController.abort();
  });

  // Create an SSE response that proxies from the GraphQL server
  const stream = new ReadableStream({
    async start(controller) {
      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

      try {
        const response = await fetch(`${graphqlEndpoint}?${params}`, {
          headers: {
            'Accept': 'text/event-stream',
          },
          signal: abortController.signal,
        });

        if (!response.ok) {
          controller.enqueue(`event: error\ndata: ${JSON.stringify({ errors: [{ message: `GraphQL server returned ${response.status}` }] })}\n\n`);
          controller.close();
          return;
        }

        reader = response.body?.getReader() ?? null;
        if (!reader) {
          controller.enqueue(`event: error\ndata: ${JSON.stringify({ errors: [{ message: 'No response body from GraphQL server' }] })}\n\n`);
          controller.close();
          return;
        }

        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(decoder.decode(value, { stream: true }));
        }

        controller.close();
      } catch (e) {
        // Don't send error if aborted (client disconnected)
        if (e instanceof Error && e.name === 'AbortError') {
          controller.close();
          return;
        }
        controller.enqueue(`event: error\ndata: ${JSON.stringify({ errors: [{ message: e instanceof Error ? e.message : 'Subscription failed' }] })}\n\n`);
        controller.close();
      }
    },
    cancel() {
      // Client disconnected - abort the upstream fetch
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
};
