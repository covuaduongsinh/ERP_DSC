import { ChessPiece } from './ChessPiece'
import type { PieceCode } from '@/lib/chess'

export type BoardPiece = {
  code: PieceCode
  /** Vị trí tuyệt đối trong bàn cờ (%) */
  left: string
  top: string
}

type ChessBoardProps = {
  /** Quân đặt sẵn trên bàn (mặc định Mã/Vua/Tốt như hero design) */
  pieces?: BoardPiece[]
  className?: string
}

const DEFAULT_PIECES: BoardPiece[] = [
  { code: 'wn', left: '13%', top: '60%' },
  { code: 'wk', left: '50%', top: '30%' },
  { code: 'wp', left: '68%', top: '66%' },
]

// Bàn cờ 8×8 dựng bằng component (không chèn DOM bằng JS như prototype).
const CELLS = Array.from({ length: 64 }, (_, i) => {
  const row = Math.floor(i / 8)
  const col = i % 8
  return (row + col) % 2 === 0
})

export function ChessBoard({ pieces = DEFAULT_PIECES, className }: ChessBoardProps) {
  return (
    <div
      aria-hidden="true"
      className={`relative aspect-square w-[min(420px,90%)] overflow-hidden rounded-ds-2xl border-[10px] border-navy-ink bg-navy-ink shadow-ds-lg${
        className ? ` ${className}` : ''
      }`}
    >
      <div className="grid h-full w-full grid-cols-8 grid-rows-8">
        {CELLS.map((light, i) => (
          <span key={`cell-${i}`} className={light ? 'bg-[#EDEFF7]' : 'bg-[#33409A]'} />
        ))}
      </div>
      {pieces.map((p) => (
        <ChessPiece
          key={`${p.code}-${p.left}-${p.top}`}
          code={p.code}
          className="absolute w-[21%] -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_6px_10px_rgba(21,29,73,.45)]"
          style={{ left: p.left, top: p.top }}
        />
      ))}
    </div>
  )
}
