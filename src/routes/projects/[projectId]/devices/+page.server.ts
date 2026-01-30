import type { PageServerLoad } from './$types';
import { graphql } from '$lib/server/graphql';

interface Device {
  id: string;
  projectId: string;
  host: string;
  port: number;
  type: string;
  slot: number | null;
  scanRate: number;
  enabled: boolean;
}

export const load: PageServerLoad = async ({ params }) => {
  const { projectId } = params;

  try {
    const result = await graphql<{ devices: Device[] }>(`
      query($projectId: String!) {
        devices(projectId: $projectId) {
          id
          projectId
          host
          port
          type
          slot
          scanRate
          enabled
        }
      }
    `, { projectId });

    if (result.errors) {
      return {
        projectId,
        devices: [],
        error: result.errors[0].message
      };
    }

    return {
      projectId,
      devices: result.data?.devices ?? [],
      error: null
    };
  } catch (e) {
    return {
      projectId,
      devices: [],
      error: e instanceof Error ? e.message : 'Failed to load devices'
    };
  }
};
