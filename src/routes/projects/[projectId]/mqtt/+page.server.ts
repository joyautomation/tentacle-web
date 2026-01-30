import type { PageServerLoad } from './$types';
import { graphql } from '$lib/server/graphql';

interface DeadBandConfig {
  value: number;
  maxTime: number | null;
}

interface MqttVariableEntry {
  variableId: string;
  enabled: boolean;
  deadband: DeadBandConfig | null;
}

interface MqttConfig {
  defaults: {
    deadband: DeadBandConfig;
  };
  variables: MqttVariableEntry[];
  enabledCount: number;
}

export const load: PageServerLoad = async ({ params }) => {
  const { projectId } = params;

  try {
    const result = await graphql<{ mqttConfig: MqttConfig }>(`
      query($projectId: String!) {
        mqttConfig(projectId: $projectId) {
          defaults {
            deadband {
              value
              maxTime
            }
          }
          variables {
            variableId
            enabled
            deadband {
              value
              maxTime
            }
          }
          enabledCount
        }
      }
    `, { projectId });

    if (result.errors) {
      return {
        projectId,
        mqttConfig: null,
        error: result.errors[0].message
      };
    }

    return {
      projectId,
      mqttConfig: result.data?.mqttConfig ?? null,
      error: null
    };
  } catch (e) {
    return {
      projectId,
      mqttConfig: null,
      error: e instanceof Error ? e.message : 'Failed to load MQTT config'
    };
  }
};
