import type { PageServerLoad } from './$types';
import { graphql } from '$lib/server/graphql';

interface MqttTemplateMember {
  name: string;
  datatype: string;
  description: string | null;
  templateRef: string | null;
  isArray: boolean | null;
}

interface MqttTemplateInfo {
  name: string;
  version: string | null;
  members: MqttTemplateMember[];
}

interface MqttMetricInfo {
  name: string;
  sparkplugType: string;
  value: unknown;
  moduleId: string;
  datatype: string;
  templateRef: string | null;
  timestamp: number | null;
}

interface MqttMetricsResponse {
  metrics: MqttMetricInfo[];
  templates: MqttTemplateInfo[];
  deviceId: string;
  timestamp: string;
}

export const load: PageServerLoad = async () => {
  try {
    const result = await graphql<{
      mqttMetrics: MqttMetricsResponse;
    }>(`
      query {
        mqttMetrics {
          metrics {
            name
            sparkplugType
            value
            moduleId
            datatype
            templateRef
            timestamp
          }
          templates {
            name
            version
            members {
              name
              datatype
              description
              templateRef
              isArray
            }
          }
          deviceId
          timestamp
        }
      }
    `);

    if (result.errors) {
      return {
        metrics: [],
        templates: [],
        deviceId: '',
        error: result.errors[0].message,
      };
    }

    return {
      metrics: result.data?.mqttMetrics.metrics ?? [],
      templates: result.data?.mqttMetrics.templates ?? [],
      deviceId: result.data?.mqttMetrics.deviceId ?? '',
      error: null,
    };
  } catch (e) {
    return {
      metrics: [],
      templates: [],
      deviceId: '',
      error: e instanceof Error ? e.message : 'Failed to fetch metrics',
    };
  }
};
