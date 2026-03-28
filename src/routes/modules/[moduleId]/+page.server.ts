import type { PageServerLoad } from './$types';
import { graphql } from '$lib/server/graphql';

interface ModuleRegistryInfo {
	moduleId: string;
	repo: string;
	description: string;
	category: string;
	runtime: string;
}

interface ModuleVersionInfo {
	moduleId: string;
	installedVersions: string[];
	latestVersion: string | null;
	activeVersion: string | null;
}

interface DesiredService {
	moduleId: string;
	version: string;
	running: boolean;
}

interface ServiceStatus {
	moduleId: string;
	installedVersions: string[];
	activeVersion: string | null;
	systemdState: string;
	reconcileState: string;
	lastError: string | null;
	runtime: string;
	category: string;
	repo: string;
}

export const load: PageServerLoad = async ({ params }) => {
	const { moduleId } = params;

	try {
		const result = await graphql<{
			availableModules: ModuleRegistryInfo[];
			moduleVersions: ModuleVersionInfo;
			internetConnectivity: boolean;
			desiredServices: DesiredService[];
			serviceStatuses: ServiceStatus[];
		}>(`
			query($moduleId: String!) {
				availableModules {
					moduleId
					repo
					description
					category
					runtime
				}
				moduleVersions(moduleId: $moduleId) {
					moduleId
					installedVersions
					latestVersion
					activeVersion
				}
				internetConnectivity
				desiredServices {
					moduleId
					version
					running
				}
				serviceStatuses {
					moduleId
					installedVersions
					activeVersion
					systemdState
					reconcileState
					lastError
					runtime
					category
					repo
				}
			}
		`, { moduleId });

		if (result.errors) {
			return {
				moduleId,
				module: null,
				versions: null,
				online: false,
				desiredService: null,
				serviceStatus: null,
				error: result.errors[0].message,
			};
		}

		const module = (result.data?.availableModules ?? []).find(
			(m) => m.moduleId === moduleId
		) ?? null;

		const desiredService = (result.data?.desiredServices ?? []).find(
			(d) => d.moduleId === moduleId
		) ?? null;

		const serviceStatus = (result.data?.serviceStatuses ?? []).find(
			(s) => s.moduleId === moduleId
		) ?? null;

		return {
			moduleId,
			module,
			versions: result.data?.moduleVersions ?? null,
			online: result.data?.internetConnectivity ?? false,
			desiredService,
			serviceStatus,
			error: null,
		};
	} catch (e) {
		return {
			moduleId,
			module: null,
			versions: null,
			online: false,
			desiredService: null,
			serviceStatus: null,
			error: e instanceof Error ? e.message : 'Failed to connect',
		};
	}
};
