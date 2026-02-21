import type { PageServerLoad } from './$types';
import { graphql } from '$lib/server/graphql';

interface NatsTrafficEntry {
  timestamp: string;
  subject: string;
  size: number;
  payload: string;
}

export const load: PageServerLoad = async () => {
  try {
    const result = await graphql<{ natsTraffic: NatsTrafficEntry[] }>(`
      query {
        natsTraffic(limit: 200) {
          timestamp
          subject
          size
          payload
        }
      }
    `);

    return {
      initialTraffic: result.data?.natsTraffic ?? [],
      error: result.errors?.[0]?.message ?? null,
    };
  } catch (e) {
    return {
      initialTraffic: [],
      error: e instanceof Error ? e.message : 'Failed to load traffic',
    };
  }
};
