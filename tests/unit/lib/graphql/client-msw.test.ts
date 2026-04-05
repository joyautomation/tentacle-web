import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../../mocks/server';
import { graphql } from '$lib/graphql/client';

/**
 * Example tests using MSW instead of manual fetch mocking.
 * MSW intercepts at the network level, so the real fetch implementation is used.
 */

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('graphql client (MSW)', () => {
	it('fetches service data through the proxy', async () => {
		const result = await graphql<{ mode: string; services: unknown[] }>(
			'{ mode services { serviceType } }'
		);

		expect(result.data?.mode).toBe('development');
		expect(result.data?.services).toHaveLength(2);
	});

	it('handles GraphQL errors from server', async () => {
		server.use(
			http.post('/api/graphql', () => {
				return HttpResponse.json({
					data: null,
					errors: [{ message: 'Field not found' }]
				});
			})
		);

		const result = await graphql('{ nonexistent }');
		expect(result.errors?.[0].message).toBe('Field not found');
	});

	it('handles server error responses', async () => {
		server.use(
			http.post('/api/graphql', () => {
				return new HttpResponse(null, { status: 503 });
			})
		);

		await expect(graphql('{ mode }')).rejects.toThrow('503');
	});

	it('handles network failures', async () => {
		server.use(
			http.post('/api/graphql', () => {
				return HttpResponse.error();
			})
		);

		await expect(graphql('{ mode }')).rejects.toThrow();
	});
});
