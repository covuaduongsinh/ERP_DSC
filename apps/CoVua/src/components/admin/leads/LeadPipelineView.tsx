import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import type { AdminViewServerProps } from 'payload';
import { hasRole } from '@/access';
import type { Lead, Location } from '@/payload-types';
import { LeadPipelineClient, type LeadCard } from './LeadPipelineClient';

/**
 * Lead Pipeline (kanban) — admin view tại `/admin/lead-pipeline`.
 *
 * Server: gate đọc = `canManageLeads` (admin/manager/receptionist) — role khác
 * thấy thông báo chặn, KHÔNG truy vấn (không lộ lead). Nạp lead 4 giai đoạn board
 * (loại `khong_phu_hop`) qua Local API `overrideAccess:false`, map sang model gọn
 * cho client. Tương tác (kéo-thả, drawer) ở `LeadPipelineClient`.
 */

const canManageLeads = hasRole('admin', 'manager', 'receptionist');
const BOARD_STATUSES = ['moi', 'da_lien_he', 'dang_ky_hoc_thu', 'da_chot'] as const;

export async function LeadPipelineView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props;
  const {
    req,
    req: { user, payload, i18n },
    permissions,
    visibleEntities,
    locale,
  } = initPageResult;

  if (!user) {
    return (
      <Gutter>
        <p>Bạn cần đăng nhập tài khoản nhân viên để xem pipeline lead.</p>
      </Gutter>
    );
  }

  const allowed = canManageLeads({ req }) === true;

  let cards: LeadCard[] = [];
  if (allowed) {
    const { docs } = await payload.find({
      collection: 'leads',
      where: { status: { in: BOARD_STATUSES as unknown as string[] } },
      user,
      overrideAccess: false,
      depth: 1,
      limit: 300,
      pagination: false,
      sort: 'nextFollowUpAt',
    });
    const now = Date.now();
    cards = (docs as Lead[]).map((l) => {
      const loc = l.interestedLocation as Location | number | null | undefined;
      return {
        id: l.id as number,
        fullName: l.fullName,
        phone: l.phone,
        childAge: l.childAge ?? null,
        source: l.source,
        status: l.status,
        note: l.note ?? null,
        locationName: loc && typeof loc === 'object' ? loc.name : null,
        nextFollowUpAt: l.nextFollowUpAt ?? null,
        overdue: !!l.nextFollowUpAt && new Date(l.nextFollowUpAt).getTime() < now,
        converted: !!l.convertedStudent,
        activity: (l.activityLog ?? [])
          .map((e) => ({ type: e.type, at: e.at ?? null, note: e.note ?? null }))
          .slice(-12)
          .reverse(),
      };
    });
  }

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
        {allowed ? (
          <LeadPipelineClient initialCards={cards} />
        ) : (
          <p role="alert" style={{ color: 'var(--theme-warning-600)', fontWeight: 600 }}>
            Chỉ lễ tân, quản lý hoặc admin mới xem được pipeline lead.
          </p>
        )}
      </Gutter>
    </DefaultTemplate>
  );
}

export default LeadPipelineView;
