import type { PageServerLoad } from './$types';
import { graphql } from '$lib/server/graphql';

interface Service {
  serviceType: string;
  instanceId: string;
  projectId: string;
  uptime: number;
  metadata?: Record<string, unknown>;
}

interface Project {
  id: string;
  isConnected: boolean;
  variableCount: number;
  lastActivity: number | null;
}

export const load: PageServerLoad = async () => {
  try {
    const result = await graphql<{
      services: Service[];
      projects: Project[];
    }>(`
      query {
        services {
          serviceType
          instanceId
          projectId
          uptime
          metadata
        }
        projects {
          id
          isConnected
          variableCount
          lastActivity
        }
      }
    `);

    if (result.errors) {
      return {
        services: [],
        projects: [],
        error: result.errors[0].message
      };
    }

    return {
      services: result.data?.services ?? [],
      projects: result.data?.projects ?? [],
      error: null
    };
  } catch (e) {
    return {
      services: [],
      projects: [],
      error: e instanceof Error ? e.message : 'Failed to load NATS data'
    };
  }
};
