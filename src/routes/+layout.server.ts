import type { LayoutServerLoad } from './$types';
import { graphql } from '$lib/server/graphql';

interface Service {
	serviceType: string;
	moduleId: string;
	enabled: boolean;
}

interface ModuleRegistryInfo {
	moduleId: string;
	repo: string;
	description: string;
	category: string;
	runtime: string;
}

interface DesiredService {
	moduleId: string;
	version: string;
	running: boolean;
}

export const load: LayoutServerLoad = async ({ cookies }) => {
	let mode = 'unknown';
	let graphqlConnected = false;
	let services: Service[] = [];
	let availableModules: ModuleRegistryInfo[] = [];
	let desiredServices: DesiredService[] = [];

	try {
		const result = await graphql<{
			mode: string;
			services: Service[];
			availableModules: ModuleRegistryInfo[];
			desiredServices: DesiredService[];
		}>(`
			query {
				mode
				services {
					serviceType
					moduleId
					enabled
				}
				availableModules {
					moduleId
					repo
					description
					category
					runtime
				}
				desiredServices {
					moduleId
					version
					running
				}
			}
		`);
		if (result.data?.mode) {
			mode = result.data.mode;
			graphqlConnected = true;
			services = result.data.services ?? [];
			availableModules = result.data.availableModules ?? [];
			desiredServices = result.data.desiredServices ?? [];
		}
	} catch {
		// GraphQL unreachable — mode stays 'unknown'
	}

	return {
		theme: cookies.get('theme') ?? null,
		mode,
		graphqlConnected,
		services,
		availableModules,
		desiredServices,
	};
};
