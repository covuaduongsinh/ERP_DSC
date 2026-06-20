import { DEFAULT_USER_ROLE, USER_ROLES, type UserRole } from '../../access/roles'

/**
 * Tích hợp Keycloak SSO (realm "vierp" của ERP) cho NHÂN VIÊN.
 *
 * Hai URL gốc:
 *  - SSO_URL        : nội bộ container (server-side: token, userinfo, logout backchannel).
 *  - SSO_PUBLIC_URL : công khai cho TRÌNH DUYỆT (authorize redirect). Issuer của Keycloak
 *                     phải khớp host này. Nếu không set → fallback SSO_URL (dev/local).
 *
 * Client Keycloak: SSO_CLIENT_ID (mặc định "clb"), confidential, có SSO_CLIENT_SECRET.
 */

function trimSlash(u: string): string {
  return u.replace(/\/+$/, '')
}
function serverBase(): string {
  return trimSlash(process.env.SSO_URL || 'http://localhost:8080')
}
function publicBase(): string {
  return trimSlash(process.env.SSO_PUBLIC_URL || process.env.SSO_URL || 'http://localhost:8080')
}
function realm(): string {
  return process.env.SSO_REALM || 'vierp'
}
function clientId(): string {
  return process.env.SSO_CLIENT_ID || 'clb'
}
function clientSecret(): string {
  return process.env.SSO_CLIENT_SECRET || ''
}

/** SSO chỉ bật khi có cả endpoint lẫn client secret (nếu thiếu → ẩn nút, dùng login local). */
export function ssoConfigured(): boolean {
  return Boolean(process.env.SSO_URL && process.env.SSO_CLIENT_SECRET)
}

export function buildAuthorizeUrl(opts: { state: string; redirectUri: string }): string {
  const p = new URLSearchParams({
    client_id: clientId(),
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: opts.redirectUri,
    state: opts.state,
  })
  return `${publicBase()}/realms/${realm()}/protocol/openid-connect/auth?${p.toString()}`
}

export type KeycloakTokens = {
  access_token: string
  id_token?: string
  refresh_token?: string
  expires_in?: number
}

export async function exchangeCodeForTokens(opts: {
  code: string
  redirectUri: string
}): Promise<KeycloakTokens> {
  const res = await fetch(`${serverBase()}/realms/${realm()}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: opts.code,
      redirect_uri: opts.redirectUri,
      client_id: clientId(),
      client_secret: clientSecret(),
    }),
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`Keycloak token exchange thất bại: ${res.status} ${await res.text()}`)
  }
  return (await res.json()) as KeycloakTokens
}

export type KeycloakUserInfo = {
  sub: string
  email?: string
  email_verified?: boolean
  preferred_username?: string
  name?: string
  realm_access?: { roles?: string[] }
  resource_access?: Record<string, { roles?: string[] }>
}

export async function fetchUserInfo(accessToken: string): Promise<KeycloakUserInfo> {
  const res = await fetch(`${serverBase()}/realms/${realm()}/protocol/openid-connect/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Keycloak userinfo thất bại: ${res.status}`)
  return (await res.json()) as KeycloakUserInfo
}

export function buildLogoutUrl(opts: { idToken?: string; redirectUri: string }): string {
  const p = new URLSearchParams({
    post_logout_redirect_uri: opts.redirectUri,
    client_id: clientId(),
  })
  if (opts.idToken) p.set('id_token_hint', opts.idToken)
  return `${publicBase()}/realms/${realm()}/protocol/openid-connect/logout?${p.toString()}`
}

/**
 * Map vai trò Keycloak → vai trò Payload (admin/manager/coach/accountant/receptionist/assistant).
 * Nhận cả realm role lẫn client role; chấp nhận tiền tố "clb-" (vd "clb-manager").
 * Không khớp vai trò nào → DEFAULT_USER_ROLE (receptionist — quyền thấp nhất, fail-safe).
 */
export function mapKeycloakRolesToPayload(info: KeycloakUserInfo): UserRole[] {
  const raw = new Set<string>()
  for (const r of info.realm_access?.roles ?? []) raw.add(r.toLowerCase())
  for (const r of info.resource_access?.[clientId()]?.roles ?? []) raw.add(r.toLowerCase())
  const mapped = USER_ROLES.filter((role) => raw.has(role) || raw.has(`clb-${role}`))
  return mapped.length ? mapped : [DEFAULT_USER_ROLE]
}
