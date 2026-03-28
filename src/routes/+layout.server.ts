import type { LayoutServerLoad } from './$types';
import { graphql } from '$lib/server/graphql';

interface Service {
	serviceType: string;
	moduleId: string;
	enabled: boolean;
}

export const load: LayoutServerLoad = async ({ cookies }) => {
	let mode = 'unknown';
	let graphqlConnected = false;
	let services: Service[] = [];

	try {
		const result = await graphql<{ mode: string; services: Service[] }>(`
			query {
				mode
				services {
					serviceType
					moduleId
					enabled
				}
			}
		`);
		if (result.data?.mode) {
			mode = result.data.mode;
			graphqlConnected = true;
			services = result.data.services ?? [];
		}
	} catch {
		// GraphQL unreachable — mode stays 'unknown'
	}

	return {
		theme: cookies.get('theme') ?? null,
		mode,
		graphqlConnected,
		services,
	};
};
