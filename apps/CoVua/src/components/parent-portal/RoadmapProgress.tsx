import { brand } from '@ds/brand';
import { getNoteForLevel } from '@/lib/roadmap';
import type { ChessLevel } from '@/lib/roadmap';
import { levelOrder, PIECE_TO_LEVEL } from '@/lib/roadmap';

type RoadmapProgressProps = {
  currentLevel?: ChessLevel | null;
};

export function RoadmapProgress({ currentLevel }: RoadmapProgressProps) {
  const currentIndex = currentLevel ? levelOrder.indexOf(currentLevel) : -1;

  return (
    <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ol className="flex min-w-max items-start gap-1 px-0.5 sm:gap-2">
        {brand.roadmap.map((step, index) => {
          const levelSlug = PIECE_TO_LEVEL[step.piece];
          const isCurrent = index === currentIndex;
          const isCompleted = currentIndex >= 0 && index < currentIndex;
          const isFuture = currentIndex >= 0 && index > currentIndex;
          const note = getNoteForLevel(levelSlug);

          let circleClass =
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-bold sm:h-12 sm:w-12 sm:text-sm ';
          if (isCurrent) {
            circleClass +=
              'bg-primary text-[var(--ds-text-on-primary)] ring-4 ring-primary/25';
          } else if (isCompleted) {
            circleClass += 'bg-primary text-[var(--ds-text-on-primary)]';
          } else if (isFuture || currentIndex < 0) {
            circleClass +=
              'border-2 border-primary/25 bg-[var(--ds-white)] text-[var(--ds-text-muted)]';
          }

          return (
            <li key={step.piece} className="flex items-center gap-1 sm:gap-2">
              <div className="flex w-[3.25rem] flex-col items-center sm:w-14">
                <span
                  className={circleClass}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {step.piece}
                </span>
                {note ? (
                  <span className="mt-1 max-w-[3.25rem] text-center text-[9px] leading-tight text-[var(--ds-text-muted)] sm:max-w-14 sm:text-[10px]">
                    {note}
                  </span>
                ) : null}
                {isCurrent ? (
                  <span className="mt-0.5 text-[9px] font-semibold text-primary sm:text-[10px]">
                    Đang học
                  </span>
                ) : null}
              </div>
              {index < brand.roadmap.length - 1 ? (
                <span
                  className={`mb-4 text-sm font-bold sm:text-base ${
                    isCompleted ? 'text-primary' : 'text-primary/20'
                  }`}
                  aria-hidden
                >
                  →
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
