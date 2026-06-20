// ============================================================
// CRM ↔ Master Data (chống trùng "khách" giữa CRM / CoVua / Ecommerce).
//
// Phụ huynh trong CRM (Contact) ⇄ Customer canonical (@vierp/master-data). CRM
// tham chiếu Contact.customerId; khi tạo/chốt lead, CRM map Contact → Customer rồi
// publish lên kênh erp.customer.* để service master-data ingest (xem
// erp-integration/events.ts → publishCustomerUpsert).
// ============================================================
import type { Customer } from "@vierp/shared";

export interface CrmContactLike {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  customerId?: string | null;
}

/** Ghép họ tên VN (lastName = họ, firstName = tên) thành tên đầy đủ hiển thị. */
export function fullNameOf(
  contact: Pick<CrmContactLike, "firstName" | "lastName">,
): string {
  return [contact.lastName, contact.firstName].filter(Boolean).join(" ").trim();
}

/** Map Contact (CRM) → payload Customer canonical (bỏ các field audit do service tự quản). */
export function mapContactToCustomer(
  contact: CrmContactLike,
  tenantId = "default",
): Partial<Customer> & { id: string; name: string } {
  return {
    id: contact.customerId ?? contact.id,
    code: contact.customerId ?? contact.id,
    name: fullNameOf(contact),
    email: contact.email ?? undefined,
    phone: contact.phone ?? undefined,
    tenantId,
    type: "individual",
    status: "active",
  };
}
