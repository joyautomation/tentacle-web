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

	// Core query — mode and services (must not break)
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

	// Module management query — separate so it doesn't break the core layout
	if (graphqlConnected) {
		try {
			const result = await graphql<{
				availableModules: ModuleRegistryInfo[];
				desiredServices: DesiredService[];
			}>(`
				query {
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
			if (result.data) {
				availableModules = result.data.availableModules ?? [];
				desiredServices = result.data.desiredServices ?? [];
			}
		} catch {
			// Orchestrator queries not available yet — graceful degradation
		}
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
