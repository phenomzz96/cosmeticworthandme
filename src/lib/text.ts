/** Bỏ dấu tiếng Việt và chuyển về chữ thường, để tìm "kem chong nang" vẫn ra "Kem chống nắng" */
export function normalizeVi(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

export function slugify(input: string): string {
  return normalizeVi(input)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
