import type { PageServerLoad, Actions } from './$types';
import { graphql } from '$lib/server/graphql';

interface ConfigEntry {
  key: string;
  envVar: string;
  value: string;
  moduleId: string;
}

export const load: PageServerLoad = async ({ params }) => {
  const { serviceType } = params;

  try {
    const result = await graphql<{
      serviceConfig: ConfigEntry[];
    }>(`
      query($moduleId: String!) {
        serviceConfig(moduleId: $moduleId) {
          key
          envVar
          value
          moduleId
        }
      }
    `, { moduleId: serviceType });

    return {
      serviceType,
      config: result.data?.serviceConfig ?? [],
      error: result.errors?.[0]?.message ?? null,
    };
  } catch (e) {
    return {
      serviceType,
      config: [],
      error: e instanceof Error ? e.message : 'Failed to load config',
    };
  }
};

export const actions: Actions = {
  save: async ({ request, params }) => {
    const formData = await request.formData();
    const { serviceType } = params;

    // Collect all form fields and save each one
    const errors: string[] = [];
    for (const [envVar, value] of formData.entries()) {
      if (typeof value !== 'string') continue;

      try {
        const result = await graphql<{
          updateServiceConfig: ConfigEntry;
        }>(`
          mutation($moduleId: String!, $envVar: String!, $value: String!) {
            updateServiceConfig(moduleId: $moduleId, envVar: $envVar, value: $value) {
              key
              envVar
              value
              moduleId
            }
          }
        `, {
          moduleId: serviceType,
          envVar,
          value,
        });

        if (result.errors) {
          errors.push(`${envVar}: ${result.errors[0].message}`);
        }
      } catch (e) {
        errors.push(`${envVar}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true };
  },
};
