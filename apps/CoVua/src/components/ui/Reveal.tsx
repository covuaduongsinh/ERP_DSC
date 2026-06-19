'use client';

import { type ElementType, type ReactNode, useEffect, useRef, useState } from 'react';

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Thẻ bao ngoài (mặc định div) */
  as?: ElementType;
};

/**
 * Bọc nội dung để fade + rise khi cuộn vào viewport (IntersectionObserver, 1 lần).
 * prefers-reduced-motion được tôn trọng qua CSS (.reveal trong globals.css) — hiện
 * ngay, không animate. Không có JS thì <noscript> trong layout buộc hiện nội dung.
 */
export function Reveal({ children, className = '', as }: RevealProps) {
  const Tag = (as ?? 'div') as ElementType;
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={`reveal${shown ? ' in' : ''}${className ? ` ${className}` : ''}`}>
      {children}
    </Tag>
  );
}
