import { graphql } from '$lib/server/graphql';

export const load = async ({ cookies }) => {
	let mode = 'unknown';
	let graphqlConnected = false;

	try {
		const result = await graphql<{ mode: string }>(`query { mode }`);
		if (result.data?.mode) {
			mode = result.data.mode;
			graphqlConnected = true;
		}
	} catch {
		// GraphQL unreachable — mode stays 'unknown'
	}

	return {
		theme: cookies.get('theme') ?? null,
		mode,
		graphqlConnected,
	};
};
