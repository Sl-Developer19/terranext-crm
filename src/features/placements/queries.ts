import 'server-only';

import { findPlacementById, findPlacements } from './repository';
import type { Placement } from './schema';

/** Read models for the placements pipeline (S31). */

export async function listPlacements(): Promise<Placement[]> {
  return findPlacements();
}

export async function getPlacement(placementId: string): Promise<Placement | null> {
  return findPlacementById(placementId);
}
