'use client';

import { Button, useListQuery } from '@payloadcms/ui';
import { useCallback, useState } from 'react';

type Format = 'csv' | 'xlsx';

/**
 * Nút "Xuất CSV" / "Xuất Excel" trên list view các collection chính.
 *
 * Đọc bộ lọc HIỆN TẠI qua `useListQuery` (where + search + sort) rồi POST sang
 * /api/admin-export/[slug]. Server fetch lại đúng tập đang lọc (mọi trang, không
 * chỉ trang hiển thị) với access control, sinh file header tiếng Việt + tên file
 * có ngày, trả về để tải. Component chỉ render trong /admin nên chỉ nhân viên
 * thấy; endpoint vẫn tự kiểm tra quyền nhân viên.
 */
export function ExportButtons() {
  const { collectionSlug, query, data } = useListQuery();
  const [busy, setBusy] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalDocs = data?.totalDocs;

  const handleExport = useCallback(
    async (format: Format) => {
      if (!collectionSlug || busy) return;
      setBusy(format);
      setError(null);

      try {
        const response = await fetch(
          `/api/admin-export/${encodeURIComponent(collectionSlug)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
              format,
              where: query?.where,
              sort: query?.sort,
              search: query?.search,
            }),
          },
        );

        if (!response.ok) {
          let message = `Xuất thất bại (mã ${response.status}).`;
          try {
            const json = (await response.json()) as { error?: string };
            if (json?.error) message = json.error;
          } catch {
            /* giữ message mặc định */
          }
          setError(message);
          return;
        }

        const blob = await response.blob();
        const fileName =
          parseFileName(response.headers.get('Content-Disposition')) ??
          `xuat.${format}`;

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      } catch {
        setError('Không kết nối được máy chủ để xuất. Thử lại.');
      } finally {
        setBusy(null);
      }
    },
    [busy, collectionSlug, query],
  );

  return (
    <div className="ds-export">
      <div className="ds-export__buttons">
        <Button
          buttonStyle="secondary"
          size="small"
          type="button"
          disabled={busy !== null}
          onClick={() => handleExport('csv')}
        >
          {busy === 'csv' ? 'Đang xuất…' : 'Xuất CSV'}
        </Button>
        <Button
          buttonStyle="secondary"
          size="small"
          type="button"
          disabled={busy !== null}
          onClick={() => handleExport('xlsx')}
        >
          {busy === 'xlsx' ? 'Đang xuất…' : 'Xuất Excel'}
        </Button>
        {typeof totalDocs === 'number' ? (
          <span className="ds-export__hint">
            Xuất {totalDocs} bản ghi theo bộ lọc hiện tại
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="ds-export__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Lấy filename từ header Content-Disposition: attachment; filename="...". */
function parseFileName(disposition: string | null): string | null {
  if (!disposition) return null;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export default ExportButtons;
