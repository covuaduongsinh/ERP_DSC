import { Button, Heading, Text, Section } from "@react-email/components";
import * as React from "react";
import { BaseLayout } from "./base-layout";

export interface PortalMagicLinkEmailProps {
  customerName: string;
  magicLinkUrl: string;
  expiresIn: string;
}

export function PortalMagicLinkEmail({
  customerName,
  magicLinkUrl,
  expiresIn,
}: PortalMagicLinkEmailProps) {
  return (
    <BaseLayout preview="Đăng nhập vào Cờ vua Dương Sinh CRM Portal">
      <Heading style={heading}>Đăng nhập Portal</Heading>
      <Text style={text}>Xin chào {customerName},</Text>
      <Text style={text}>
        Nhấn vào nút bên dưới để đăng nhập vào Portal khách hàng của bạn.
      </Text>

      <Button style={button} href={magicLinkUrl}>
        Đăng nhập Portal
      </Button>

      <Section style={warningBox}>
        <Text style={warningText}>
          Link này hết hạn sau <strong>{expiresIn}</strong>. Mỗi link chỉ sử
          dụng được một lần.
        </Text>
      </Section>

      <Text style={securityNote}>
        Nếu bạn không yêu cầu đăng nhập, hãy bỏ qua email này. Tài khoản của bạn
        vẫn an toàn.
      </Text>
    </BaseLayout>
  );
}

const heading: React.CSSProperties = {
  color: "#1F2937",
  fontSize: "22px",
  fontWeight: 700,
  lineHeight: "28px",
  margin: "0 0 16px",
};

const text: React.CSSProperties = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "24px",
  margin: "0 0 12px",
};

const button: React.CSSProperties = {
  backgroundColor: "#2563EB",
  borderRadius: "6px",
  color: "#FFFFFF",
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 600,
  lineHeight: "1",
  padding: "12px 24px",
  textDecoration: "none",
  textAlign: "center" as const,
  margin: "8px 0 16px",
};

const warningBox: React.CSSProperties = {
  backgroundColor: "#FEF3C7",
  borderRadius: "6px",
  border: "1px solid #FDE68A",
  padding: "12px 16px",
  margin: "16px 0",
};

const warningText: React.CSSProperties = {
  color: "#92400E",
  fontSize: "13px",
  lineHeight: "20px",
  margin: 0,
};

const securityNote: React.CSSProperties = {
  color: "#9CA3AF",
  fontSize: "12px",
  lineHeight: "18px",
  margin: "16px 0 0",
  fontStyle: "italic",
};

export default PortalMagicLinkEmail;
