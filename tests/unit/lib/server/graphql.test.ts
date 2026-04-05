import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { graphql } from '$lib/server/graphql';

describe('server graphql client', () => {
	const mockFetch = vi.fn();

	beforeEach(() => {
		vi.stubGlobal('fetch', mockFetch);
		vi.spyOn(console, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('returns error response on network failure (does not throw)', async () => {
		mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

		const result = await graphql('{ mode }');

		expect(result.errors).toBeDefined();
		expect(result.errors![0].message).toContain('Cannot connect');
	});

	it('returns error response on non-OK HTTP status', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 502,
			statusText: 'Bad Gateway'
		});

		const result = await graphql('{ mode }');

		expect(result.errors).toBeDefined();
		expect(result.errors![0].message).toContain('502');
	});

	it('returns parsed JSON data on success', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ data: { services: [] } })
		});

		const result = await graphql('{ services { serviceType } }');

		expect(result.data).toEqual({ services: [] });
	});

	it('sends to configured GRAPHQL_URL endpoint', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: () => Promise.resolve({ data: null })
		});

		await graphql('{ test }');

		expect(mockFetch).toHaveBeenCalledWith(
			'http://127.0.0.1:4000/graphql',
			expect.objectContaining({
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			})
		);
	});

	it('handles non-TypeError exceptions gracefully', async () => {
		mockFetch.mockRejectedValueOnce(new Error('Something unexpected'));

		const result = await graphql('{ mode }');

		expect(result.errors).toBeDefined();
		expect(result.errors![0].message).toBe('Something unexpected');
	});
});
