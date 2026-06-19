import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { registerFonts } from "./fonts";
import {
  pdfFormatCurrency,
  pdfFormatDate,
  getDefaultCompanyInfo,
  getDefaultTerms,
  type CompanyInfo,
} from "./utils";

registerFonts();

export interface QuotePDFData {
  quoteNumber: string;
  status: string;
  createdAt: string | Date;
  validUntil?: string | Date | null;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  total: number;
  notes?: string | null;
  terms?: string | null;
  contact?: {
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
  } | null;
  company?: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  items: Array<{
    product?: { name: string } | null;
    description?: string | null;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
  }>;
}

interface QuotePDFProps {
  quote: QuotePDFData;
  companyInfo?: CompanyInfo;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    fontSize: 10,
    padding: 40,
    color: "#1F2937",
    backgroundColor: "#FFFFFF",
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontWeight: 700,
    color: "#2563EB",
    marginBottom: 4,
  },
  companyDetail: {
    fontSize: 9,
    color: "#6B7280",
    marginBottom: 2,
  },
  titleBlock: {
    alignItems: "flex-end",
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: "#2563EB",
    marginBottom: 6,
  },
  quoteNumber: {
    fontSize: 10,
    color: "#374151",
    marginBottom: 2,
  },
  // Customer info
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "#1F2937",
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  customerBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 4,
    padding: 12,
    marginBottom: 20,
  },
  customerRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  customerLabel: {
    width: 80,
    fontSize: 9,
    color: "#6B7280",
  },
  customerValue: {
    flex: 1,
    fontSize: 9,
    color: "#1F2937",
  },
  // Items table
  table: {
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#2563EB",
    padding: 6,
    borderRadius: 2,
  },
  tableHeaderText: {
    fontSize: 8,
    fontWeight: 700,
    color: "#FFFFFF",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
    padding: 6,
    minHeight: 24,
    alignItems: "center",
  },
  tableRowAlt: {
    backgroundColor: "#F9FAFB",
  },
  tableCell: {
    fontSize: 9,
    color: "#374151",
  },
  // Column widths
  colNum: { width: "6%" },
  colProduct: { width: "30%" },
  colQty: { width: "10%", textAlign: "right" },
  colPrice: { width: "18%", textAlign: "right" },
  colDiscount: { width: "12%", textAlign: "right" },
  colTotal: { width: "24%", textAlign: "right" },
  // Totals
  totalsContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  totalsBox: {
    width: 240,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalLabel: {
    fontSize: 9,
    color: "#6B7280",
  },
  totalValue: {
    fontSize: 9,
    color: "#1F2937",
    textAlign: "right",
  },
  totalDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#2563EB",
    marginVertical: 4,
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#1F2937",
  },
  grandTotalValue: {
    fontSize: 12,
    fontWeight: 700,
    color: "#2563EB",
    textAlign: "right",
  },
  // Notes / Terms
  notesSection: {
    marginTop: 20,
  },
  notesText: {
    fontSize: 9,
    color: "#374151",
    lineHeight: 1.6,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: "#E5E7EB",
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: "#9CA3AF",
  },
});

export function QuotePDF({ quote, companyInfo }: QuotePDFProps) {
  const company = companyInfo || getDefaultCompanyInfo();
  const terms = quote.terms || getDefaultTerms();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>{company.name}</Text>
            <Text style={styles.companyDetail}>{company.address}</Text>
            <Text style={styles.companyDetail}>{company.phone}</Text>
            <Text style={styles.companyDetail}>{company.email}</Text>
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>BÁO GIÁ</Text>
            <Text style={styles.quoteNumber}>Số: {quote.quoteNumber}</Text>
            <Text style={styles.quoteNumber}>
              Ngày: {pdfFormatDate(quote.createdAt)}
            </Text>
            {quote.validUntil && (
              <Text style={styles.quoteNumber}>
                Hiệu lực: {pdfFormatDate(quote.validUntil)}
              </Text>
            )}
          </View>
        </View>

        {/* Customer Info */}
        <Text style={styles.sectionTitle}>THÔNG TIN KHÁCH HÀNG</Text>
        <View style={styles.customerBox}>
          {quote.contact && (
            <View style={styles.customerRow}>
              <Text style={styles.customerLabel}>Tên:</Text>
              <Text style={styles.customerValue}>
                {quote.contact.firstName} {quote.contact.lastName}
              </Text>
            </View>
          )}
          {quote.company && (
            <View style={styles.customerRow}>
              <Text style={styles.customerLabel}>Công ty:</Text>
              <Text style={styles.customerValue}>{quote.company.name}</Text>
            </View>
          )}
          {(quote.contact?.email || quote.company?.email) && (
            <View style={styles.customerRow}>
              <Text style={styles.customerLabel}>Email:</Text>
              <Text style={styles.customerValue}>
                {quote.contact?.email || quote.company?.email}
              </Text>
            </View>
          )}
          {(quote.contact?.phone || quote.company?.phone) && (
            <View style={styles.customerRow}>
              <Text style={styles.customerLabel}>Điện thoại:</Text>
              <Text style={styles.customerValue}>
                {quote.contact?.phone || quote.company?.phone}
              </Text>
            </View>
          )}
          {quote.company?.address && (
            <View style={styles.customerRow}>
              <Text style={styles.customerLabel}>Địa chỉ:</Text>
              <Text style={styles.customerValue}>{quote.company.address}</Text>
            </View>
          )}
        </View>

        {/* Items Table */}
        <Text style={styles.sectionTitle}>CHI TIẾT BÁO GIÁ</Text>
        <View style={styles.table}>
          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colNum]}>#</Text>
            <Text style={[styles.tableHeaderText, styles.colProduct]}>
              Sản phẩm
            </Text>
            <Text style={[styles.tableHeaderText, styles.colQty]}>SL</Text>
            <Text style={[styles.tableHeaderText, styles.colPrice]}>
              Đơn giá
            </Text>
            <Text style={[styles.tableHeaderText, styles.colDiscount]}>CK</Text>
            <Text style={[styles.tableHeaderText, styles.colTotal]}>
              Thành tiền
            </Text>
          </View>

          {/* Table Rows */}
          {quote.items.map((item, idx) => (
            <View
              key={idx}
              style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <Text style={[styles.tableCell, styles.colNum]}>{idx + 1}</Text>
              <View style={styles.colProduct}>
                <Text style={styles.tableCell}>
                  {item.product?.name || item.description || "Sản phẩm"}
                </Text>
                {item.product?.name && item.description && (
                  <Text
                    style={[
                      styles.tableCell,
                      { color: "#9CA3AF", fontSize: 8 },
                    ]}
                  >
                    {item.description}
                  </Text>
                )}
              </View>
              <Text style={[styles.tableCell, styles.colQty]}>
                {Number(item.quantity)}
              </Text>
              <Text style={[styles.tableCell, styles.colPrice]}>
                {pdfFormatCurrency(Number(item.unitPrice))}
              </Text>
              <Text style={[styles.tableCell, styles.colDiscount]}>
                {Number(item.discount) > 0
                  ? pdfFormatCurrency(Number(item.discount))
                  : "--"}
              </Text>
              <Text
                style={[styles.tableCell, styles.colTotal, { fontWeight: 700 }]}
              >
                {pdfFormatCurrency(Number(item.total))}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tạm tính</Text>
              <Text style={styles.totalValue}>
                {pdfFormatCurrency(quote.subtotal)}
              </Text>
            </View>
            {quote.discountAmount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  Chiết khấu ({quote.discountPercent}%)
                </Text>
                <Text style={[styles.totalValue, { color: "#EF4444" }]}>
                  -{pdfFormatCurrency(quote.discountAmount)}
                </Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                Thuế VAT ({quote.taxPercent}%)
              </Text>
              <Text style={styles.totalValue}>
                +{pdfFormatCurrency(quote.taxAmount)}
              </Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.totalRow}>
              <Text style={styles.grandTotalLabel}>TỔNG CỘNG</Text>
              <Text style={styles.grandTotalValue}>
                {pdfFormatCurrency(quote.total)}
              </Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {quote.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.sectionTitle}>GHI CHÚ</Text>
            <Text style={styles.notesText}>{quote.notes}</Text>
          </View>
        )}

        {/* Terms */}
        <View style={styles.notesSection}>
          <Text style={styles.sectionTitle}>ĐIỀU KHOẢN</Text>
          <Text style={styles.notesText}>{terms}</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Cờ vua Dương Sinh CRM</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Trang ${pageNumber}/${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export default QuotePDF;
