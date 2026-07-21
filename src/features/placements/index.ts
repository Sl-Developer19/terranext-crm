/** Public API of the placements feature (Doc 02 §3). */
export { CreatePlacementDialog } from './components/create-placement-dialog';
export { PlacementsBoard } from './components/placements-board';
export { getPlacement, listPlacements } from './queries';
export { canCreatePlacement } from './logic';
export {
  PLACEMENT_STAGE_ORDER,
  PLACEMENT_STATUSES,
  type Placement,
  type PlacementStatus,
} from './schema';
