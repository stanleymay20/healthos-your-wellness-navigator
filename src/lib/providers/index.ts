import { OURA } from "./oura";
import type { ProviderDefinition, ProviderId } from "./types";

export const PROVIDERS: Record<ProviderId, ProviderDefinition> = {
  oura: OURA,
};

export function getProvider(id: ProviderId): ProviderDefinition {
  return PROVIDERS[id];
}

export function isIntegratedProvider(id: string): id is ProviderId {
  return id in PROVIDERS;
}

export type { ProviderId, ProviderDefinition } from "./types";
