import type { PageServerLoad } from './$types';
import { graphql } from '$lib/server/graphql';

interface Service {
  serviceType: string;
  instanceId: string;
  projectId: string;
  uptime: number;
  metadata?: Record<string, unknown>;
}

interface Device {
  id: string;
  host: string;
  port: number;
  enabled: boolean;
}

export const load: PageServerLoad = async ({ params }) => {
  const { projectId } = params;

  try {
    const result = await graphql<{
      services: Service[];
      devices: Device[];
    }>(`
      query($projectId: String!) {
        services(projectId: $projectId) {
          serviceType
          instanceId
          projectId
          uptime
          metadata
        }
        devices(projectId: $projectId) {
          id
          host
          port
          enabled
        }
      }
    `, { projectId });

    if (result.errors) {
      return {
        projectId,
        services: [],
        devices: [],
        error: result.errors[0].message
      };
    }

    return {
      projectId,
      services: result.data?.services ?? [],
      devices: result.data?.devices ?? [],
      error: null
    };
  } catch (e) {
    return {
      projectId,
      services: [],
      devices: [],
      error: e instanceof Error ? e.message : 'Failed to load project data'
    };
  }
};
