import { brand } from '@ds/brand';

export function FloatingZalo() {
  return (
    <a
      href={brand.zaloLink}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat Zalo với Dương Sinh"
      className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#0068FF] text-white shadow-lg ring-1 ring-black/5 transition hover:scale-105 hover:bg-[#0055cc] focus:outline-none focus:ring-2 focus:ring-[#0068FF]/40 sm:bottom-6 sm:right-6 sm:h-14 sm:w-14"
    >
      <svg
        viewBox="0 0 64 64"
        aria-hidden="true"
        className="h-8 w-8 sm:h-10 sm:w-10"
      >
        <path
          fill="currentColor"
          d="M32 8C16.54 8 4 18.06 4 30.46c0 7.05 4.06 13.33 10.4 17.42-.36 2-1.5 5.85-1.72 6.62-.27 1 .73 1.74 1.66 1.26.78-.4 6.16-3.5 8.5-4.84 2.84.72 5.84 1.12 8.96 1.12 15.46 0 28-10.06 28-22.46S47.46 8 32 8Z"
        />
        <text
          x="32"
          y="36"
          textAnchor="middle"
          fontFamily="Arial, Helvetica, sans-serif"
          fontWeight="700"
          fontSize="14"
          fill="#0068FF"
          letterSpacing="-0.5"
        >
          Zalo
        </text>
      </svg>
    </a>
  );
}
