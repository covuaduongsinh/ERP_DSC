'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LogOut,
  PanelLeftClose,
  ChevronRight,
  MapPin,
  type LucideIcon,
} from 'lucide-react';
import { Logo } from '@ds/brand/logo';
import type { UserRole } from '@/access/roles';
import {
  NAV_GROUPS,
  navForRoles,
  type NavBadgeKey,
  type NavGroup,
  type NavItem,
  type NavItemId,
} from './adminNavConfig';
import { BranchSwitcher, type BranchOption } from './BranchSwitcher';

export interface AdminNavClientProps {
  roles: UserRole[];
  counts: Record<NavBadgeKey, number>;
  branchOptions: BranchOption[];
  branchActive: 'all' | number[];
  branchCanChoose: boolean;
  branchLocked: boolean;
  branchAllLabel: string;
  /** Dòng phụ footer: phạm vi cơ sở đang xem. */
  scopeLabel: string;
  /** Nhãn vai trò (ghép nếu đa-role). */
  roleLabel: string;
  /** Màu avatar theo vai trò ưu tiên. */
  avatarColor: string;
  avatarText: string;
  userEmail: string;
}

/** Nhóm được GHIM trên cùng (không thuộc accordion). */
const PINNED_GROUP = 'Tổng quan';
const NAV_MODE_KEY = 'ds_nav_mode';

type NavMode = 'full' | 'rail';

/**
 * Route con không có mục nav riêng → highlight mục cha. Vd Hồ sơ lớp học
 * (`/admin/lop/:id`) sáng mục "Lớp học".
 */
const PARENT_ROUTE_MAP: { prefix: string; href: string }[] = [
  { prefix: '/admin/lop/', href: '/admin/collections/classes' },
];
function effectivePath(pathname: string): string {
  for (const m of PARENT_ROUTE_MAP) if (pathname.startsWith(m.prefix)) return m.href;
  return pathname;
}

function isItemActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(href + '/');
}

export function AdminNavClient({
  roles,
  counts,
  branchOptions,
  branchActive,
  branchCanChoose,
  branchLocked,
  branchAllLabel,
  scopeLabel,
  roleLabel,
  avatarColor,
  avatarText,
  userEmail,
}: AdminNavClientProps) {
  const pathname = usePathname() || '/admin';
  const navPath = effectivePath(pathname);
  const allowed: Set<NavItemId> = navForRoles(roles);

  const badgeOf = (it: NavItem): number => (it.badge ? counts[it.badge] : 0);
  const groupBadge = (g: NavGroup): number =>
    g.items.reduce((sum, it) => (allowed.has(it.id) ? sum + badgeOf(it) : sum), 0);

  // Nhóm sau khi lọc theo role (bỏ nhóm rỗng).
  const groups: NavGroup[] = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((it) => allowed.has(it.id)),
  })).filter((g) => g.items.length > 0);

  const pinned = groups.find((g) => g.group === PINNED_GROUP) ?? null;
  const accordions = groups.filter((g) => g.group !== PINNED_GROUP);

  const activeGroupKey =
    accordions.find((g) => g.items.some((it) => isItemActive(navPath, it.href)))?.group ?? null;

  // ---- State: rail/full + accordion 1-mở ----
  const [navMode, setNavMode] = useState<NavMode>('full');
  const [openKey, setOpenKey] = useState<string | null>(activeGroupKey);
  const [tip, setTip] = useState<{ label: string; y: number } | null>(null);

  // Nạp chế độ đã lưu sau hydrate (tránh mismatch SSR).
  useEffect(() => {
    const saved = window.localStorage.getItem(NAV_MODE_KEY);
    if (saved === 'rail' || saved === 'full') setNavMode(saved);
  }, []);

  // Áp marker lên <html> để custom.scss thu hẹp --nav-width; dọn khi unmount.
  useEffect(() => {
    const root = document.documentElement;
    if (navMode === 'rail') root.setAttribute('data-ds-nav', 'rail');
    else root.removeAttribute('data-ds-nav');
    return () => {
      root.removeAttribute('data-ds-nav');
    };
  }, [navMode]);

  // Mở đúng nhóm chứa route hiện tại khi điều hướng.
  useEffect(() => {
    setOpenKey(activeGroupKey);
  }, [activeGroupKey]);

  const changeMode = (mode: NavMode) => {
    setNavMode(mode);
    window.localStorage.setItem(NAV_MODE_KEY, mode);
  };

  // ---------------- RAIL (thanh icon thu gọn) ----------------
  if (navMode === 'rail') {
    return (
      <nav className="ds-side ds-side--rail" aria-label="Điều hướng quản trị">
        <div className="ds-side__brand ds-side__brand--rail">
          <button
            type="button"
            className="ds-side__expand"
            title="Mở rộng menu"
            aria-label="Mở rộng menu"
            onClick={() => changeMode('full')}
          >
            <span className="ds-side__mark">
              <Logo variant="symbol" color="#ffffff" style={{ width: 22, height: 24, display: 'block' }} />
            </span>
          </button>
        </div>

        <button
          type="button"
          className="ds-railloc"
          title="Đổi cơ sở (mở rộng menu)"
          aria-label="Đổi cơ sở"
          onClick={() => changeMode('full')}
        >
          <MapPin className="ds-navlink__ic" aria-hidden />
        </button>

        <div className="ds-side__scroll ds-railwrap">
          {groups.map((g, gi) => (
            <div className="ds-railgroup" key={g.group}>
              {gi > 0 && <div className="ds-raildiv" />}
              {g.items.map((it) => {
                const Icon: LucideIcon = it.icon;
                const badge = badgeOf(it);
                const active = isItemActive(navPath, it.href);
                return (
                  <Link
                    key={it.id}
                    href={it.href}
                    className={'ds-railitem' + (active ? ' ds-railitem--active' : '')}
                    aria-current={active ? 'page' : undefined}
                    aria-label={it.label}
                    onMouseEnter={(e) => {
                      const b = e.currentTarget.getBoundingClientRect();
                      setTip({ label: it.label, y: b.top + b.height / 2 });
                    }}
                    onMouseLeave={() => setTip(null)}
                  >
                    <Icon className="ds-navlink__ic" aria-hidden />
                    {badge > 0 && <span className="ds-railitem__b">{badge}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {tip && (
          <div className="ds-railtip" style={{ top: tip.y }} role="presentation">
            {tip.label}
          </div>
        )}

        <div className="ds-side__user ds-side__user--rail">
          <button
            type="button"
            className="ds-avatar"
            title={`${roleLabel} — mở rộng để xem thêm`}
            aria-label="Mở rộng menu"
            style={{ background: `linear-gradient(140deg, ${avatarColor}, var(--ds-primary))`, border: 'none', cursor: 'pointer' }}
            onClick={() => changeMode('full')}
          >
            {avatarText}
          </button>
        </div>
      </nav>
    );
  }

  // ---------------- FULL (pinned + accordion) ----------------
  return (
    <nav className="ds-side" aria-label="Điều hướng quản trị">
      <div className="ds-side__brand">
        <span className="ds-side__mark">
          <Logo variant="symbol" color="#ffffff" style={{ width: 24, height: 26, display: 'block' }} />
        </span>
        <span className="ds-side__brandtx">
          <b>Dương Sinh</b>
          <span>Quản trị</span>
        </span>
        <button
          type="button"
          className="ds-side__collapse"
          title="Thu gọn menu"
          aria-label="Thu gọn menu"
          onClick={() => changeMode('rail')}
        >
          <PanelLeftClose className="ds-side__collapseic" aria-hidden />
        </button>
      </div>

      <BranchSwitcher
        options={branchOptions}
        active={branchActive}
        canChoose={branchCanChoose}
        locked={branchLocked}
        allLabel={branchAllLabel}
      />

      <div className="ds-side__scroll">
        {pinned &&
          pinned.items.map((it) => {
            const Icon: LucideIcon = it.icon;
            const badge = badgeOf(it);
            const active = isItemActive(navPath, it.href);
            return (
              <Link
                key={it.id}
                href={it.href}
                className={'ds-navlink ds-navlink--solo' + (active ? ' ds-navlink--active' : '')}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="ds-navlink__ic" aria-hidden />
                <span className="ds-navlink__sp">{it.label}</span>
                {badge > 0 && <span className="ds-navbadge">{badge}</span>}
              </Link>
            );
          })}

        {pinned && accordions.length > 0 && <div className="ds-navsep" />}

        {accordions.map((g) => {
          const GroupIcon: LucideIcon = g.icon;
          const open = openKey === g.group;
          const hasActive = g.items.some((it) => isItemActive(navPath, it.href));
          const gb = groupBadge(g);
          return (
            <div
              className={
                'ds-navacc' + (open ? ' ds-navacc--open' : '') + (hasActive ? ' ds-navacc--has-active' : '')
              }
              key={g.group}
            >
              <button
                type="button"
                className="ds-navacc__head"
                aria-expanded={open}
                onClick={() => setOpenKey(open ? null : g.group)}
              >
                <GroupIcon className="ds-navacc__ic" aria-hidden />
                <span className="ds-navacc__nm">{g.group}</span>
                {!open && gb > 0 && <span className="ds-navacc__badge">{gb}</span>}
                <ChevronRight className="ds-navacc__chev" aria-hidden />
              </button>
              <div className="ds-navacc__body">
                <div className="ds-navacc__inner">
                  {g.items.map((it) => {
                    const Icon: LucideIcon = it.icon;
                    const badge = badgeOf(it);
                    const active = isItemActive(navPath, it.href);
                    return (
                      <Link
                        key={it.id}
                        href={it.href}
                        className={'ds-navlink' + (active ? ' ds-navlink--active' : '')}
                        aria-current={active ? 'page' : undefined}
                      >
                        <Icon className="ds-navlink__ic" aria-hidden />
                        <span className="ds-navlink__sp">{it.label}</span>
                        {badge > 0 && <span className="ds-navbadge">{badge}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="ds-side__user">
        <span
          className="ds-avatar"
          style={{ background: `linear-gradient(140deg, ${avatarColor}, var(--ds-primary))` }}
          aria-hidden
        >
          {avatarText}
        </span>
        <Link href="/admin/account" className="ds-side__usertx" title={userEmail}>
          <b>{roleLabel}</b>
          <span>{scopeLabel}</span>
        </Link>
        <Link href="/admin/logout" className="ds-side__logout" title="Đăng xuất" aria-label="Đăng xuất">
          <LogOut className="ds-side__logouticon" aria-hidden />
        </Link>
      </div>
    </nav>
  );
}

export default AdminNavClient;
