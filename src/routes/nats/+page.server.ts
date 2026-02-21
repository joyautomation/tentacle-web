import type { PageServerLoad } from './$types';
import { graphql } from '$lib/server/graphql';

interface Service {
  serviceType: string;
  moduleId: string;
  uptime: number;
  metadata?: Record<string, unknown>;
}

export const load: PageServerLoad = async () => {
  try {
    const result = await graphql<{
      services: Service[];
    }>(`
      query {
        services {
          serviceType
          moduleId
          uptime
          metadata
        }
      }
    `);

    if (result.errors) {
      return {
        services: [],
        error: result.errors[0].message
      };
    }

    return {
      services: result.data?.services ?? [],
      error: null
    };
  } catch (e) {
    return {
      services: [],
      error: e instanceof Error ? e.message : 'Failed to load NATS data'
    };
  }
};
