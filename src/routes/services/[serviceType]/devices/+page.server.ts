import type { PageServerLoad } from './$types';
import { graphql } from '$lib/server/graphql';
import type { Variable, ActiveDevice, GatewayConfig } from '$lib/types/gateway';

interface Service {
  serviceType: string;
  moduleId: string;
  metadata: Record<string, unknown> | null;
}

export const load: PageServerLoad = async ({ params }) => {
  const { serviceType } = params;

  // Gateway: load gateway config (includes availableProtocols from active services)
  if (serviceType === 'gateway') {
    try {
      const result = await graphql<{ gatewayConfig: GatewayConfig }>(`
        query GatewayConfig($gatewayId: String!) {
          gatewayConfig(gatewayId: $gatewayId) {
            gatewayId
            devices { deviceId protocol config scanRate deadband { value minTime maxTime } disableRBE }
            variables { id description datatype deviceId tag bidirectional }
            udtVariables { id deviceId tag templateName }
            availableProtocols
            updatedAt
          }
        }
      `, { gatewayId: 'gateway' });

      if (result.errors) {
        return {
          serviceType,
          variables: [],
          deviceInfo: {} as Record<string, ActiveDevice>,
          gatewayConfig: null,
          error: result.errors[0].message,
        };
      }

      return {
        serviceType,
        variables: [],
        deviceInfo: {} as Record<string, ActiveDevice>,
        gatewayConfig: result.data?.gatewayConfig ?? null,
        error: null,
      };
    } catch (e) {
      return {
        serviceType,
        variables: [],
        deviceInfo: {} as Record<string, ActiveDevice>,
        gatewayConfig: null,
        error: e instanceof Error ? e.message : 'Failed to fetch gateway config',
      };
    }
  }

  // EtherNet/IP: load variables and device info
  try {
    const result = await graphql<{
      variables: Variable[];
      services: Service[];
    }>(`
      query {
        variables(moduleId: "ethernetip") {
          variableId
          value
          datatype
          cipType
          udtType
          quality
          moduleId
          deviceId
          lastUpdated
        }
        services {
          serviceType
          moduleId
          metadata
        }
      }
    `);

    if (result.errors) {
      return {
        serviceType,
        variables: [],
        deviceInfo: {} as Record<string, ActiveDevice>,
        gatewayConfig: null,
        error: result.errors[0].message,
      };
    }

    // Extract device connection info from EIP heartbeat metadata
    const deviceInfo: Record<string, ActiveDevice> = {};
    const eipServices = (result.data?.services ?? []).filter(s => s.serviceType === 'ethernetip');
    for (const svc of eipServices) {
      if (svc.metadata?.devices) {
        try {
          const devices: ActiveDevice[] = typeof svc.metadata.devices === 'string'
            ? JSON.parse(svc.metadata.devices)
            : svc.metadata.devices;
          for (const d of devices) {
            deviceInfo[d.deviceId] = d;
          }
        } catch { /* ignore parse errors */ }
      }
    }

    return {
      serviceType,
      variables: result.data?.variables ?? [],
      deviceInfo,
      gatewayConfig: null,
      error: null,
    };
  } catch (e) {
    return {
      serviceType,
      variables: [],
      deviceInfo: {} as Record<string, ActiveDevice>,
      gatewayConfig: null,
      error: e instanceof Error ? e.message : 'Failed to fetch variables',
    };
  }
};
