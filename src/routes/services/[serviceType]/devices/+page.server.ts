import type { PageServerLoad } from './$types';
import { graphql } from '$lib/server/graphql';

interface Variable {
  variableId: string;
  value: unknown;
  datatype: string;
  cipType: string | null;
  udtType: string | null;
  quality: string;
  moduleId: string;
  deviceId: string | null;
  lastUpdated: string;
}

interface Service {
  serviceType: string;
  moduleId: string;
  metadata: Record<string, unknown> | null;
}

interface ActiveDevice {
  deviceId: string;
  host: string;
  port: number;
  tagCount: number;
}

export const load: PageServerLoad = async () => {
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
        variables: [],
        deviceInfo: {} as Record<string, ActiveDevice>,
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
      variables: result.data?.variables ?? [],
      deviceInfo,
      error: null,
    };
  } catch (e) {
    return {
      variables: [],
      deviceInfo: {} as Record<string, ActiveDevice>,
      error: e instanceof Error ? e.message : 'Failed to fetch variables',
    };
  }
};
