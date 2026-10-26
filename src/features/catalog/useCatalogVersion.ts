import { useSyncExternalStore } from 'react'
import { catalogService } from '@/services/catalog'

/** Số phiên bản dữ liệu danh mục; tăng mỗi lần tải lại. Dùng làm dependency để vẽ lại. */
export function useCatalogVersion(): number {
  return useSyncExternalStore(catalogService.subscribe, catalogService.getVersion, catalogService.getVersion)
}
