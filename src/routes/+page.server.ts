import type { PageServerLoad, Actions } from './$types';
import { graphql } from '$lib/server/graphql';
import { fail } from '@sveltejs/kit';

interface Project {
  id: string;
  lastActivity: string | null;
  isConnected: boolean;
  variableCount: number;
  isStale: boolean;
}

export const load: PageServerLoad = async () => {
  try {
    const result = await graphql<{ projects: Project[] }>(`
      query {
        projects {
          id
          lastActivity
          isConnected
          variableCount
          isStale
        }
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

export const actions: Actions = {
  deleteProject: async ({ request }) => {
    const formData = await request.formData();
    const projectId = formData.get('projectId') as string;
    const confirmText = formData.get('confirmText') as string;

    if (!projectId || confirmText !== projectId) {
      return fail(400, { error: 'Project name confirmation does not match' });
    }

    try {
      const result = await graphql<{ deleteProject: boolean }>(`
        mutation($projectId: String!) {
          deleteProject(projectId: $projectId)
        }
      `, { projectId });

      if (result.errors) {
        return fail(500, { error: result.errors[0].message });
      }

      if (!result.data?.deleteProject) {
        return fail(500, { error: 'Failed to delete project' });
      }

      return { success: true };
    } catch (e) {
      return fail(500, { error: e instanceof Error ? e.message : 'Delete failed' });
    }
  }
};
