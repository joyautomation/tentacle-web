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

interface Module {
  type: string;
  description: string;
  repo: string;
  installed: boolean;
  running: boolean;
  config: Record<string, string>;
  configSchema: Array<{
    envVar: string;
    label: string;
    type: string;
    required: boolean;
    default?: string;
  }>;
  startedAt: string | null;
}

export const load: PageServerLoad = async ({ params }) => {
  const { serviceType } = params;

  try {
    const result = await graphql<{
      services: Service[];
      module: Module | null;
    }>(`
      query($serviceType: String!) {
        services {
          serviceType
          moduleId
          uptime
          version
          metadata
          startedAt
        }
        module(moduleType: $serviceType) {
          type
          description
          repo
          installed
          running
          config
          configSchema {
            envVar
            label
            type
            required
            default
          }
          startedAt
        }
      }
    `, { serviceType });

    if (result.errors) {
      return {
        serviceType,
        instances: [],
        module: null,
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
      module: result.data?.module ?? null,
      graphqlConnected: true,
      error: null,
    };
  } catch (e) {
    return {
      serviceType,
      instances: [],
      module: null,
      graphqlConnected: false,
      error: e instanceof Error ? e.message : 'Failed to connect',
    };
  }
};
