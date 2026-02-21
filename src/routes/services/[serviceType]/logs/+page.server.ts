import type { PageServerLoad } from './$types';
import { graphql } from '$lib/server/graphql';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  serviceType: string;
  moduleId: string;
  logger: string | null;
}

export const load: PageServerLoad = async ({ params }) => {
  const { serviceType } = params;

  try {
    const result = await graphql<{ serviceLogs: LogEntry[] }>(`
      query($serviceType: String!) {
        serviceLogs(serviceType: $serviceType, limit: 200) {
          timestamp
          level
          message
          serviceType
          moduleId
          logger
        }
      }
    `, { serviceType });

    return {
      serviceType,
      initialLogs: result.data?.serviceLogs ?? [],
      error: result.errors?.[0]?.message ?? null,
    };
  } catch (e) {
    return {
      serviceType,
      initialLogs: [],
      error: e instanceof Error ? e.message : 'Failed to load logs',
    };
  }
};
