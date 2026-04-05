import { http, HttpResponse } from 'msw';

/**
 * Default MSW handlers for GraphQL API mocking.
 * Used in both unit tests (via setupServer) and E2E tests (via setupWorker).
 *
 * Override individual handlers per-test with server.use() for specific scenarios.
 */

// Minimal default responses that match the app's expected shape
const defaultServiceData = {
	mode: 'development',
	services: [
		{
			serviceType: 'mqtt',
			instances: [{ id: 'mqtt-1', running: true, uptime: 3600, version: '1.0.0' }]
		},
		{
			serviceType: 'gateway',
			instances: [{ id: 'gateway-1', running: true, uptime: 7200, version: '1.0.0' }]
		}
	]
};

const defaultModuleData = {
	availableModules: [],
	desiredServices: []
};

export const handlers = [
	// Server-side GraphQL proxy endpoint (what the SvelteKit app hits)
	http.post('/api/graphql', async ({ request }) => {
		const body = (await request.json()) as { query: string; variables?: Record<string, unknown> };
		const query = body.query;

		// Route based on query content
		if (query.includes('mode') && query.includes('services')) {
			return HttpResponse.json({ data: defaultServiceData });
		}

		if (query.includes('availableModules') || query.includes('desiredServices')) {
			return HttpResponse.json({ data: defaultModuleData });
		}

		if (query.includes('gatewayConfig')) {
			return HttpResponse.json({
				data: {
					gatewayConfig: {
						devices: [],
						variables: [],
						udtTemplates: [],
						udtVariables: [],
						updatedAt: new Date().toISOString()
					}
				}
			});
		}

		// Default: return empty data
		return HttpResponse.json({ data: null });
	}),

	// Direct GraphQL endpoint (server-side)
	http.post('http://127.0.0.1:4000/graphql', async ({ request }) => {
		const body = (await request.json()) as { query: string; variables?: Record<string, unknown> };
		const query = body.query;

		if (query.includes('mode') && query.includes('services')) {
			return HttpResponse.json({ data: defaultServiceData });
		}

		if (query.includes('availableModules') || query.includes('desiredServices')) {
			return HttpResponse.json({ data: defaultModuleData });
		}

		// Default fallback
		return HttpResponse.json({ data: null });
	})
];
