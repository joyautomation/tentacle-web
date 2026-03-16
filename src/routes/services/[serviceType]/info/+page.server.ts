import type { PageServerLoad } from './$types';
import { graphql } from '$lib/server/graphql';

interface Variable {
  variableId: string;
  value: unknown;
  datatype: string;
  udtType: string | null;
  quality: string;
  moduleId: string;
  deviceId: string | null;
  lastUpdated: string;
}

export const load: PageServerLoad = async ({ params }) => {
  const { serviceType } = params;

  // Only PLC uses this page for variables
  if (serviceType !== 'plc') {
    return { variables: [], serviceType, error: null };
  }

  try {
    const result = await graphql<{
      variables: Variable[];
    }>(`
      query {
        variables {
          variableId
          value
          datatype
          udtType
          quality
          moduleId
          deviceId
          lastUpdated
        }
      }
    `);

    if (result.errors) {
      return {
        variables: [],
        serviceType,
        error: result.errors[0].message,
      };
    }

    return {
      variables: result.data?.variables ?? [],
      serviceType,
      error: null,
    };
  } catch (e) {
    return {
      variables: [],
      serviceType,
      error: e instanceof Error ? e.message : 'Failed to fetch variables',
    };
  }
};
