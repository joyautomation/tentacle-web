import type { PageServerLoad } from './$types';
import { graphql } from '$lib/server/graphql';

export const load: PageServerLoad = async () => {
  try {
    const result = await graphql<{ projects: string[] }>(`
      query {
        projects
      }
    `);

    if (result.errors) {
      return {
        projects: [],
        error: result.errors[0].message
      };
    }

    return {
      projects: result.data?.projects ?? [],
      error: null
    };
  } catch (e) {
    return {
      projects: [],
      error: e instanceof Error ? e.message : 'Failed to load projects'
    };
  }
};
