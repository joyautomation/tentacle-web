import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { graphql } from '$lib/graphql/client';

describe('graphql client', () => {
	const mockFetch = vi.fn();

	beforeEach(() => {
		mockFetch.mockClear();
		vi.stubGlobal('fetch', mockFetch);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('sends POST to /api/graphql with query and headers', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ data: { mode: 'dev' } })
		});

		const result = await graphql('{ mode }');

		expect(mockFetch).toHaveBeenCalledWith('/api/graphql', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ query: '{ mode }', variables: undefined })
		});
		expect(result.data).toEqual({ mode: 'dev' });
	});

	it('throws on non-OK response', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 500,
			statusText: 'Internal Server Error'
		});

		await expect(graphql('{ mode }')).rejects.toThrow('GraphQL request failed: 500');
	});

	it('passes variables in request body', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ data: null })
		});

		await graphql('mutation ($id: String!) { delete(id: $id) }', { id: '123' });

		const body = JSON.parse(mockFetch.mock.calls[0][1].body);
		expect(body.variables).toEqual({ id: '123' });
	});

	it('returns GraphQL errors from response', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () =>
				Promise.resolve({
					data: null,
					errors: [{ message: 'Not found' }]
				})
		});

		const result = await graphql('{ missing }');
		expect(result.errors).toEqual([{ message: 'Not found' }]);
	});
});
