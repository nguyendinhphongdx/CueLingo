/**
 * Device — Đăng nhập cho app desktop: mã dùng một lần từ phiên web đổi lấy token thiết bị (chỉ lưu bản băm).
 */
import { deviceRoutes } from './device.routes';
import { createDeviceService } from './device.service';
import type { DeviceRepository } from './device.repository';

export function createDeviceModule(repo: DeviceRepository) {
  const device = createDeviceService(repo);
  return { device, routes: deviceRoutes(device) };
}

export type { DeviceRepository } from './device.repository';
export { createDeviceService } from './device.service';
export type { DeviceService } from './device.service';
export {
  createPostgresDeviceRepository,
  createInMemoryDeviceRepository,
} from './device.repository';
