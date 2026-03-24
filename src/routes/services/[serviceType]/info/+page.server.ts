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

interface GatewayDevice {
  deviceId: string;
  protocol: string;
  config: Record<string, unknown>;
}

interface GatewayVariable {
  id: string;
  description: string | null;
  datatype: string;
  default: unknown;
  deviceId: string;
  tag: string;
  bidirectional: boolean | null;
}

interface GatewayConfig {
  gatewayId: string;
  devices: GatewayDevice[];
  variables: GatewayVariable[];
  updatedAt: string;
}

export const load: PageServerLoad = async ({ params }) => {
  const { serviceType } = params;

  // Gateway: load gateway config for variable management
  if (serviceType === 'gateway') {
    try {
      const result = await graphql<{ gatewayConfig: GatewayConfig }>(`
        query GatewayConfig($gatewayId: String!) {
          gatewayConfig(gatewayId: $gatewayId) {
            gatewayId
            devices { deviceId protocol config }
            variables { id description datatype default deviceId tag bidirectional }
            updatedAt
          }
        }
      `, { gatewayId: 'gateway' });

      if (result.errors) {
        return { variables: [], serviceType, gatewayConfig: null, error: result.errors[0].message };
      }

      return {
        variables: [],
        serviceType,
        gatewayConfig: result.data?.gatewayConfig ?? null,
        error: null,
      };
    } catch (e) {
      return {
        variables: [],
        serviceType,
        gatewayConfig: null,
        error: e instanceof Error ? e.message : 'Failed to fetch gateway config',
      };
    }
  }

  // Only PLC uses this page for variables
  if (serviceType !== 'plc') {
    return { variables: [], serviceType, gatewayConfig: null, error: null };
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
        gatewayConfig: null,
        error: result.errors[0].message,
      };
    }

    return {
      variables: result.data?.variables ?? [],
      serviceType,
      gatewayConfig: null,
      error: null,
    };
  } catch (e) {
    return {
      variables: [],
      serviceType,
      gatewayConfig: null,
      error: e instanceof Error ? e.message : 'Failed to fetch variables',
    };
  }
};
