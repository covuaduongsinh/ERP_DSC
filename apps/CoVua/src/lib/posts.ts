import type { Where } from 'payload';
import type { Post } from '@/payload-types';

export const POSTS_PER_PAGE = 9;

/** Tham chiếu thời gian ISR (giây). Trong page.tsx phải dùng literal `export const revalidate = 3600`. */
export const REVALIDATE_POSTS = 3600;

export const publishedPostsWhere: Where = {
  publishedAt: {
    exists: true,
  },
};

/** Danh mục bài viết để lọc trên trang Blog (khớp enum Posts.category). */
export const POST_CATEGORIES: Post['category'][] = [
  'tin_tuc',
  'kien_thuc_co_vua',
  'su_kien',
  'hoat_dong',
  'khac',
];

/** Validate query ?cat= → trả category hợp lệ hoặc undefined. */
export function parsePostCategory(value?: string): Post['category'] | undefined {
  return value && (POST_CATEGORIES as string[]).includes(value)
    ? (value as Post['category'])
    : undefined;
}

export function getPostAuthorName(
  author: Post['author'],
  fallback = 'Dương Sinh',
): string {
  if (!author || typeof author === 'number') {
    return fallback;
  }

  const value = author.value;

  if (typeof value === 'number') {
    return fallback;
  }

  if (author.relationTo === 'coaches' && 'name' in value) {
    return value.name;
  }

  if (author.relationTo === 'users' && 'email' in value && value.email) {
    const localPart = value.email.split('@')[0];
    return localPart || fallback;
  }

  return fallback;
}

export function parsePostsPage(pageParam?: string): number {
  const parsed = Number.parseInt(pageParam ?? '1', 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}
