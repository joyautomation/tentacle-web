import type { PageServerLoad } from './$types';
import { graphql } from '$lib/server/graphql';

interface Service {
  serviceType: string;
  moduleId: string;
  uptime: number;
  version: string | null;
  metadata: Record<string, unknown> | null;
  startedAt: string;
  enabled: boolean;
}

export const load: PageServerLoad = async ({ params }) => {
  const { serviceType } = params;

  // All services: show overview based on heartbeats
  try {
    const result = await graphql<{
      services: Service[];
    }>(`
      query {
        services {
          serviceType
          moduleId
          uptime
          version
          metadata
          startedAt
          enabled
        }
      }
    `);

    if (result.errors) {
      return {
        serviceType,
        instances: [],
        graphqlConnected: false,
        error: result.errors[0].message,
      };
    }

    const instances = (result.data?.services ?? []).filter(
      s => s.serviceType === serviceType
    );

    // Pre-fetch store-forward status for MQTT service page
    let storeForwardStatus = null;
    if (serviceType === 'mqtt') {
      try {
        const sfResult = await graphql<{ storeForwardStatus: unknown }>(`
          query {
            storeForwardStatus {
              primaryHostId primaryHostOnline
              bufferedRecords bufferSizeBytes
              bufferCapacityRecords bufferCapacityBytes
              bufferUsedPercentRecords bufferUsedPercentBytes
              draining drainProgress drainRecordsRemaining
              drainTotalRecords drainEtaSeconds drainStartedAt
              totalBuffered totalDrained totalEvicted publishRate
              timeline { timestamp state }
            }
          }
        `);
        storeForwardStatus = sfResult.data?.storeForwardStatus ?? null;
      } catch { /* ignore */ }
    }

    return {
      serviceType,
      instances,
      graphqlConnected: true,
      error: null,
      storeForwardStatus,
    };
  } catch (e) {
    return {
      serviceType,
      instances: [],
      graphqlConnected: false,
      error: e instanceof Error ? e.message : 'Failed to connect',
    };
  }
};
