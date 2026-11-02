/**
 * Placement — bài nghe đánh giá đầu vào: sáu đoạn nghe, chấm điểm, đặt mức nghe và mức hỗ trợ mặc định cho một ngôn ngữ.
 */
import { placementRoutes } from './placement.routes';
import { createPlacementService } from './placement.service';
import type { PlacementRepository } from './placement.repository';

export function createPlacementModule(repo: PlacementRepository) {
  const placement = createPlacementService(repo);
  return { placement, routes: placementRoutes(placement) };
}

export type { PlacementRepository } from './placement.repository';
export {
  createInMemoryPlacementRepository,
  createPostgresPlacementRepository,
} from './placement.repository';
