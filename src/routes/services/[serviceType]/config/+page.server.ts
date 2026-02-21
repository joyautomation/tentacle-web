import type { PageServerLoad } from './$types';
import { graphql } from '$lib/server/graphql';

interface NetworkInterfaceConfig {
  interfaceName: string;
  dhcp4: boolean | null;
  addresses: string[] | null;
  gateway4: string | null;
  nameservers: string[] | null;
  mtu: number | null;
}

interface NetworkState {
  interfaces: {
    name: string;
    type: number;
    addresses: { family: string; address: string; prefixlen: number }[];
  }[];
}

interface NatRule {
  id: string;
  enabled: boolean;
  protocol: string;
  connectingDevices: string;
  incomingInterface: string;
  outgoingInterface: string;
  natAddr: string;
  originalPort: string;
  translatedPort: string;
  deviceAddr: string;
  deviceName: string;
  doubleNat: boolean;
  doubleNatAddr: string;
  comment: string;
}

interface NftablesConfig {
  natRules: NatRule[];
}

export const load: PageServerLoad = async ({ params }) => {
  if (params.serviceType === 'nftables') {
    return loadNftablesConfig();
  }
  return loadNetworkConfig();
};

async function loadNetworkConfig() {
  try {
    const result = await graphql<{ networkConfig: NetworkInterfaceConfig[]; networkInterfaces: NetworkState }>(`
      query {
        networkConfig {
          interfaceName
          dhcp4
          addresses
          gateway4
          nameservers
          mtu
        }
        networkInterfaces {
          interfaces {
            name
            type
          }
        }
      }
    `);

    // type 1 = ethernet (ARPHRD_ETHER), filter out loopback etc.
    const allNames = result.data?.networkInterfaces?.interfaces
      ?.filter((i) => i.type === 1)
      ?.map((i) => i.name) ?? [];

    return {
      configs: result.data?.networkConfig ?? [],
      availableInterfaces: allNames,
      error: result.errors?.[0]?.message ?? null,
    };
  } catch (e) {
    return {
      configs: [],
      availableInterfaces: [],
      error: e instanceof Error ? e.message : 'Failed to load network config',
    };
  }
}

async function loadNftablesConfig() {
  try {
    const result = await graphql<{ nftablesConfig: NftablesConfig; networkInterfaces: NetworkState }>(`
      query {
        nftablesConfig {
          natRules {
            id
            enabled
            protocol
            connectingDevices
            incomingInterface
            outgoingInterface
            natAddr
            originalPort
            translatedPort
            deviceAddr
            deviceName
            doubleNat
            doubleNatAddr
            comment
          }
        }
        networkInterfaces {
          interfaces {
            name
            type
            addresses {
              family
              address
              prefixlen
            }
          }
        }
      }
    `);

    // type 1 = ethernet (ARPHRD_ETHER), filter out loopback etc.
    const ethInterfaces = result.data?.networkInterfaces?.interfaces
      ?.filter((i) => i.type === 1) ?? [];
    const allNames = ethInterfaces.map((i) => i.name);

    // Build a map of interface name → primary IPv4 address for Double NAT placeholders
    const interfaceAddresses: Record<string, { address: string; prefixlen: number }> = {};
    for (const iface of ethInterfaces) {
      const ipv4 = iface.addresses?.find((a) => a.family === 'inet');
      if (ipv4) {
        interfaceAddresses[iface.name] = { address: ipv4.address, prefixlen: ipv4.prefixlen };
      }
    }

    return {
      nftablesConfig: result.data?.nftablesConfig ?? { natRules: [] },
      availableInterfaces: allNames,
      interfaceAddresses,
      error: result.errors?.[0]?.message ?? null,
    };
  } catch (e) {
    return {
      nftablesConfig: { natRules: [] },
      availableInterfaces: [],
      interfaceAddresses: {},
      error: e instanceof Error ? e.message : 'Failed to load nftables config',
    };
  }
}
