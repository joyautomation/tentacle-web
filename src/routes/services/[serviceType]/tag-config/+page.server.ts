import type { PageServerLoad } from './$types';
import { graphql } from '$lib/server/graphql';
import type { GatewayConfig, BrowseCache, GatewayBrowseState } from '$lib/types/gateway';

export const load: PageServerLoad = async ({ params }) => {
  const { serviceType } = params;

  if (serviceType !== 'gateway') {
    return { serviceType, gatewayConfig: null, browseCaches: [] as BrowseCache[], browseStates: [] as GatewayBrowseState[], error: null };
  }

  try {
    const result = await graphql<{ gatewayConfig: GatewayConfig }>(`
      query GatewayConfig($gatewayId: String!) {
        gatewayConfig(gatewayId: $gatewayId) {
          gatewayId
          devices { deviceId protocol config scanRate deadband { value minTime maxTime } disableRBE templateNameOverrides }
          variables { id description datatype default deviceId tag bidirectional deadband { value minTime maxTime } disableRBE }
          udtTemplates { name version members { name datatype templateRef defaultDeadband { value minTime maxTime } } }
          udtVariables { id deviceId tag templateName memberTags memberCipTypes memberDeadbands }
          updatedAt
        }
      }
    `, { gatewayId: 'gateway' });

    if (result.errors) {
      return { serviceType, gatewayConfig: null, browseCaches: [] as BrowseCache[], browseStates: [] as GatewayBrowseState[], error: result.errors[0].message };
    }

    const config = result.data?.gatewayConfig ?? null;

    // Fetch browse caches and browse states in parallel
    const [browseCaches, browseStates] = await Promise.all([
      (async () => {
        const caches: BrowseCache[] = [];
        if (config?.devices) {
          const cacheResults = await Promise.allSettled(
            config.devices.map(async (device) => {
              const cacheResult = await graphql<{ gatewayBrowseCache: BrowseCache | null }>(`
                query BrowseCache($deviceId: String!) {
                  gatewayBrowseCache(deviceId: $deviceId) {
                    deviceId protocol
                    items { tag name datatype value protocolType }
                    udts { name members { name datatype cipType udtType isArray } }
                    structTags
                    cachedAt
                  }
                }
              `, { deviceId: device.deviceId });
              return cacheResult.data?.gatewayBrowseCache ?? null;
            })
          );
          for (const r of cacheResults) {
            if (r.status === 'fulfilled' && r.value) {
              caches.push(r.value);
            }
          }
        }
        return caches;
      })(),
      (async () => {
        try {
          const statesResult = await graphql<{ gatewayBrowseStates: GatewayBrowseState[] }>(`
            query {
              gatewayBrowseStates {
                deviceId browseId protocol status phase
                discoveredCount totalCount message
                startedAt updatedAt error
              }
            }
          `);
          return statesResult.data?.gatewayBrowseStates ?? [];
        } catch {
          return [] as GatewayBrowseState[];
        }
      })(),
    ]);

    return {
      serviceType,
      gatewayConfig: config,
      browseCaches,
      browseStates,
      error: null,
    };
  } catch (e) {
    return {
      serviceType,
      gatewayConfig: null,
      browseCaches: [] as BrowseCache[],
      browseStates: [] as GatewayBrowseState[],
      error: e instanceof Error ? e.message : 'Failed to fetch gateway config',
    };
  }
};
