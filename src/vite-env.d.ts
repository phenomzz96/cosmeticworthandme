/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL của Supabase project, ví dụ https://abcd1234.supabase.co */
  readonly VITE_SUPABASE_URL?: string
  /** Khóa công khai (anon / publishable key). KHÔNG đặt service_role key ở đây. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
