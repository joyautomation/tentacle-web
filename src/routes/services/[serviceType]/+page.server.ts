import type { PageServerLoad } from './$types';
import { graphql } from '$lib/server/graphql';

interface Service {
  serviceType: string;
  moduleId: string;
  uptime: number;
  version: string | null;
  metadata: Record<string, unknown> | null;
  startedAt: string;
}

export const load: PageServerLoad = async ({ params }) => {
  const { serviceType } = params;

  // All services: show overview based on heartbeats
  try {
    const result = await graphql<{
      services: Service[];
    }>(`
      query {
        services {
          serviceType
          moduleId
          uptime
          version
          metadata
          startedAt
        }
      }
    `);

    if (result.errors) {
      return {
        serviceType,
        instances: [],
        graphqlConnected: false,
        error: result.errors[0].message,
      };
    }

    const instances = (result.data?.services ?? []).filter(
      s => s.serviceType === serviceType
    );

    return {
      serviceType,
      instances,
      graphqlConnected: true,
      error: null,
    };
  } catch (e) {
    return {
      serviceType,
      instances: [],
      graphqlConnected: false,
      error: e instanceof Error ? e.message : 'Failed to connect',
    };
  }
};
