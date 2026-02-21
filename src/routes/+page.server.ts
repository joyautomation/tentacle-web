import type { PageServerLoad, Actions } from './$types';
import { graphql } from '$lib/server/graphql';
import { actions as saltActions } from '@joyautomation/salt';

interface Service {
  serviceType: string;
  moduleId: string;
  uptime: number;
  version: string | null;
  metadata: Record<string, unknown> | null;
}

export const load: PageServerLoad = async () => {
  try {
    const result = await graphql<{ services: Service[]; mode: string }>(`
      query {
        mode
        services {
          serviceType
          moduleId
          uptime
          version
          metadata
        }
      }
    `);

    if (result.errors) {
      return {
        services: [],
        mode: 'dev',
        graphqlConnected: false,
        error: result.errors[0].message
      };
    }

    return {
      services: result.data?.services ?? [],
      mode: result.data?.mode ?? 'dev',
      graphqlConnected: true,
      error: null
    };
  } catch (e) {
    return {
      services: [],
      mode: 'dev',
      graphqlConnected: false,
      error: e instanceof Error ? e.message : 'Failed to connect to GraphQL'
    };
  }
};

export const actions: Actions = {
  setTheme: saltActions.setTheme,
};
