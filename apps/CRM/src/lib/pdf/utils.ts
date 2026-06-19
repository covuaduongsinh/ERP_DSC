import { getSettingOrDefault } from "@/lib/settings";

export interface CompanyInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  logo?: string;
}

export function pdfFormatCurrency(amount: number): string {
  const formatted = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formatted} ₫`;
}

export function pdfFormatDate(date: Date | string | null | undefined): string {
  if (!date) return "--";
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function pdfFormatNumber(num: number): string {
  const [intPart, decPart] = num.toString().split(".");
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return decPart ? `${formatted},${decPart}` : formatted;
}

export function getDefaultCompanyInfo(): CompanyInfo {
  return {
    name: "Cờ vua Dương Sinh CRM",
    address: "Hà Nội, Việt Nam",
    phone: "(+84) 123 456 789",
    email: "contact@your-domain.com",
  };
}

/**
 * Fetch company info from database settings, fallback to defaults.
 */
export async function getCompanySettings(): Promise<CompanyInfo> {
  try {
    const settings = await getSettingOrDefault("company");
    return {
      name: settings.name || "Cờ vua Dương Sinh CRM",
      address: settings.address || "Hà Nội, Việt Nam",
      phone: settings.phone || "(+84) 123 456 789",
      email: settings.email || "contact@your-domain.com",
      logo: settings.logo,
    };
  } catch {
    return getDefaultCompanyInfo();
  }
}

export function getDefaultTerms(): string {
  return `1. Báo giá có hiệu lực trong thời hạn ghi trên.
2. Giá đã bao gồm thuế VAT (nếu có ghi).
3. Thời gian giao hàng sẽ được thỏa thuận sau khi xác nhận đơn hàng.
4. Thanh toán theo điều khoản đã thỏa thuận giữa hai bên.
5. Mọi thắc mắc xin liên hệ bộ phận kinh doanh.`;
}
