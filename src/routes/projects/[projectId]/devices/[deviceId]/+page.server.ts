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

interface Variable {
  projectId: string;
  deviceId: string | null;
  variableId: string;
  value: unknown;
  datatype: string;
  quality: string;
  source: string;
  lastUpdated: string;
}

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
  const { projectId, deviceId } = params;

  try {
    // Load device, variables, and MQTT config in parallel
    const [deviceResult, variablesResult, mqttResult] = await Promise.all([
      graphql<{ device: Device | null }>(`
        query($projectId: String!, $deviceId: String!) {
          device(projectId: $projectId, deviceId: $deviceId) {
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
      `, { projectId, deviceId }),

      graphql<{ variables: Variable[] }>(`
        query($projectId: String!) {
          variables(projectId: $projectId) {
            projectId
            deviceId
            variableId
            value
            datatype
            quality
            source
            lastUpdated
          }
        }
      `, { projectId }),

      graphql<{ mqttConfig: MqttConfig }>(`
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
      `, { projectId })
    ]);

    if (deviceResult.errors) {
      return {
        projectId,
        deviceId,
        device: null,
        variables: [],
        mqttConfig: null,
        error: deviceResult.errors[0].message
      };
    }

    // Filter variables to only show those from this device
    const filteredVariables = (variablesResult.data?.variables ?? []).filter(v =>
      v.deviceId === deviceId || v.deviceId === null
    );

    return {
      projectId,
      deviceId,
      device: deviceResult.data?.device ?? null,
      variables: filteredVariables,
      mqttConfig: mqttResult.data?.mqttConfig ?? null,
      error: null
    };
  } catch (e) {
    return {
      projectId,
      deviceId,
      device: null,
      variables: [],
      mqttConfig: null,
      error: e instanceof Error ? e.message : 'Failed to load device data'
    };
  }
};
