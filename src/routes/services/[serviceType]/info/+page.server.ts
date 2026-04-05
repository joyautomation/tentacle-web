import type { PageServerLoad } from './$types';
import { graphql } from '$lib/server/graphql';
import type { Variable, GatewayConfig, BrowseCache, GatewayBrowseState } from '$lib/types/gateway';

export const load: PageServerLoad = async ({ params }) => {
  const { serviceType } = params;

  // Gateway: load gateway config + browse cache for unified variable view
  if (serviceType === 'gateway') {
    try {
      const result = await graphql<{ gatewayConfig: GatewayConfig }>(`
        query GatewayConfig($gatewayId: String!) {
          gatewayConfig(gatewayId: $gatewayId) {
            gatewayId
            devices { deviceId protocol config scanRate deadband { value minTime maxTime } disableRBE }
            variables { id description datatype default deviceId tag bidirectional deadband { value minTime maxTime } disableRBE }
            udtTemplates { name version members { name datatype templateRef } }
            udtVariables { id deviceId tag templateName memberTags memberCipTypes }
            updatedAt
          }
        }
      `, { gatewayId: 'gateway' });

      if (result.errors) {
        return { variables: [], serviceType, gatewayConfig: null, browseCaches: [] as BrowseCache[], browseStates: [] as GatewayBrowseState[], error: result.errors[0].message };
      }

      const config = result.data?.gatewayConfig ?? null;

      // Fetch browse caches and browse states in parallel
      const [browseCaches, browseStates] = await Promise.all([
        // Browse cache for each device
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
        // Active browse states
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
        variables: [],
        serviceType,
        gatewayConfig: config,
        browseCaches,
        browseStates,
        error: null,
      };
    } catch (e) {
      return {
        variables: [],
        serviceType,
        gatewayConfig: null,
        browseCaches: [] as BrowseCache[],
        browseStates: [] as GatewayBrowseState[],
        error: e instanceof Error ? e.message : 'Failed to fetch gateway config',
      };
    }
  }

  // Only PLC uses this page for variables
  if (serviceType !== 'plc') {
    return { variables: [], serviceType, gatewayConfig: null, browseCaches: [] as BrowseCache[], browseStates: [] as GatewayBrowseState[], error: null };
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
        browseCaches: [] as BrowseCache[],
        browseStates: [] as GatewayBrowseState[],
        error: result.errors[0].message,
      };
    }

    return {
      variables: result.data?.variables ?? [],
      serviceType,
      gatewayConfig: null,
      browseCaches: [] as BrowseCache[],
      browseStates: [] as GatewayBrowseState[],
      error: null,
    };
  } catch (e) {
    return {
      variables: [],
      serviceType,
      gatewayConfig: null,
      browseCaches: [] as BrowseCache[],
      browseStates: [] as GatewayBrowseState[],
      error: e instanceof Error ? e.message : 'Failed to fetch variables',
    };
  }
};
