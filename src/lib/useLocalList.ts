import { useEffect, useState } from 'react'
import { readList, subscribeList } from './localList'

/** Đọc danh sách lưu trên trình duyệt và tự cập nhật khi danh sách đổi (cùng tab) */
export function useLocalList(key: string): string[] {
  const [list, setList] = useState<string[]>(() => readList(key))
  useEffect(() => {
    setList(readList(key))
    return subscribeList(key, () => setList(readList(key)))
  }, [key])
  return list
}
