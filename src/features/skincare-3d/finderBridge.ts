/**
 * Cầu nối Beauty Finder ↔ Skincare Architect 3D, và tách dữ liệu module theo tài khoản trên cùng trình duyệt.
 * Chỉ là tiện ích riêng từng trình duyệt (localStorage), không phải dữ liệu dùng chung.
 */
import type { FinderAnswers } from '@/features/beauty-finder/questions'
import type { SkinConcern, SkinType } from '@/types/catalog'

const FINDER_KEY = 'wm-finder-skin'
const OWNER_KEY = 'wm-skc-owner'
const SYNCED_KEY = 'wm-skc-synced-quiz'

export interface FinderSkin {
  concerns: SkinConcern[]
  skinType: SkinType | 'unsure'
  at: string
}

export function saveFinderSkin(a: FinderAnswers) {
  try {
    localStorage.setItem(FINDER_KEY, JSON.stringify({ concerns: a.concerns, skinType: a.skinType, at: new Date().toISOString() }))
  } catch {
    /* trình duyệt chặn lưu: bỏ qua */
  }
}

export function readFinderSkin(): FinderSkin | null {
  try {
    const v = JSON.parse(localStorage.getItem(FINDER_KEY) ?? 'null') as FinderSkin | null
    return v && Array.isArray(v.concerns) && typeof v.skinType === 'string' ? v : null
  } catch {
    return null
  }
}

/** Chỉ gửi mục tiêu sang module khi câu trả lời Beauty Finder đổi, để không ghi đè lựa chọn khách tự sửa trong module */
export function quizChanged(signature: string): boolean {
  try {
    return localStorage.getItem(SYNCED_KEY) !== signature
  } catch {
    return true
  }
}
export function markQuizSynced(signature: string) {
  try {
    localStorage.setItem(SYNCED_KEY, signature)
  } catch {
    /* bỏ qua */
  }
}

/**
 * Module lưu chu trình, nhật ký, ảnh của "khách từ website" dưới một mã chung (HOST). Khi tài khoản đã đăng nhập trên trình
 * duyệt này đổi (đăng xuất, tài khoản khác), xóa dữ liệu đó (kể cả câu trả lời Beauty Finder đã lưu) để người sau không thấy
 * chu trình/nhật ký/ảnh của người trước. Khách chưa đăng nhập rồi đăng nhập: giữ lại (cùng một người vừa đăng nhập).
 */
export async function isolateModuleData(ownerId: string): Promise<void> {
  let previous: string | null = null
  try {
    previous = localStorage.getItem(OWNER_KEY)
  } catch {
    return
  }
  if (previous === ownerId) return
  if (previous === null || previous === 'guest') {
    try {
      localStorage.setItem(OWNER_KEY, ownerId)
    } catch {
      /* bỏ qua */
    }
    return
  }
  try {
    for (const k of Object.keys(localStorage)) if (k === 'skc:HOST' || k.startsWith('skc:HOST')) localStorage.removeItem(k)
    localStorage.removeItem(SYNCED_KEY)
    localStorage.removeItem(FINDER_KEY)
    localStorage.setItem(OWNER_KEY, ownerId)
  } catch {
    /* bỏ qua */
  }
  await new Promise<void>((resolve) => {
    try {
      const req = indexedDB.open('skc-photos', 1)
      req.onupgradeneeded = () => req.result.createObjectStore('p')
      req.onerror = () => resolve()
      req.onsuccess = () => {
        const db = req.result
        try {
          const tx = db.transaction('p', 'readwrite')
          const store = tx.objectStore('p')
          const cur = store.openCursor()
          cur.onsuccess = () => {
            const c = cur.result
            if (!c) return
            if (String(c.key).startsWith('HOST|')) c.delete()
            c.continue()
          }
          tx.oncomplete = tx.onerror = tx.onabort = () => {
            db.close()
            resolve()
          }
        } catch {
          db.close()
          resolve()
        }
      }
    } catch {
      resolve()
    }
  })
}
