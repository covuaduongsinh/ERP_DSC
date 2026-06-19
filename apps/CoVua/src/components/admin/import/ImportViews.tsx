import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import type { AdminViewServerProps } from 'payload';
import { IMPORT_KIND_META, type ImportKind } from '@/lib/imports/kinds';
import { SpreadsheetImportClient } from './SpreadsheetImportClient';

/**
 * 5 admin view import (một cho mỗi collection). Tất cả dùng chung renderer +
 * registry `IMPORT_KIND_META` để mô tả cột/khóa/mẫu file không lệch nhau.
 */
function renderImportView(kind: ImportKind, props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props;
  const {
    req: { user, payload, i18n },
    permissions,
    visibleEntities,
    locale,
  } = initPageResult;

  if (!user) {
    return (
      <Gutter>
        <p>Bạn cần đăng nhập tài khoản nhân viên để sử dụng trang này.</p>
      </Gutter>
    );
  }

  const meta = IMPORT_KIND_META[kind];

  return (
    <DefaultTemplate
      i18n={i18n}
      locale={locale}
      params={params}
      payload={payload}
      permissions={permissions}
      searchParams={searchParams}
      user={user}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        <SpreadsheetImportClient
          importKind={kind}
          title={meta.title}
          description={meta.description}
          keyDescription={meta.keyDescription}
          columnGuide={meta.columnGuide}
          templateHref={`/api/admin-import-templates/${kind}`}
          templateFileName={meta.template.fileName}
        />
      </Gutter>
    </DefaultTemplate>
  );
}

export function StudentsImportView(props: AdminViewServerProps) {
  return renderImportView('students', props);
}

export function AttendanceImportView(props: AdminViewServerProps) {
  return renderImportView('attendance', props);
}

export function ProgressReportsImportView(props: AdminViewServerProps) {
  return renderImportView('progress-reports', props);
}

export function CoachesImportView(props: AdminViewServerProps) {
  return renderImportView('coaches', props);
}

export function PaymentsImportView(props: AdminViewServerProps) {
  return renderImportView('payments', props);
}

export function ClassesImportView(props: AdminViewServerProps) {
  return renderImportView('classes', props);
}

export function EnrollmentsImportView(props: AdminViewServerProps) {
  return renderImportView('enrollments', props);
}
