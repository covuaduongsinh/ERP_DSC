import { Roboto, Roboto_Condensed } from 'next/font/google';

/**
 * Font Roboto chính thức của Dương Sinh, nạp qua next/font/google.
 * next/font tự host font (không gọi sang Google lúc người dùng tải trang)
 * → nhanh hơn và tốt cho SEO.
 *
 * Dùng trong app/layout.tsx:
 *   import { roboto, robotoCondensed } from '@ds/brand/fonts';
 *   <html className={`${roboto.variable} ${robotoCondensed.variable}`}>
 *
 * Rồi trong CSS: font-family: var(--ds-font-sans);  (trỏ tới --font-roboto)
 */
export const roboto = Roboto({
  subsets: ['latin', 'vietnamese'],
  weight: ['300', '400', '500', '700', '900'],
  variable: '--font-roboto',
  display: 'swap',
});

/**
 * Font phụ Roboto Condensed — dùng cho overline, nhãn IN HOA, số lớn (số bước/giá/
 * thống kê) và tên cấp độ quân cờ. Tạo nhịp & độ nén cho UI dày thông tin.
 *
 * Trong CSS: font-family: var(--ds-font-cond);  (trỏ tới --font-roboto-condensed)
 */
export const robotoCondensed = Roboto_Condensed({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-roboto-condensed',
  display: 'swap',
});
