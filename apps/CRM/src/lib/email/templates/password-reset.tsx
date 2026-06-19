import { Button, Heading, Text, Section } from "@react-email/components";
import * as React from "react";
import { BaseLayout } from "./base-layout";

export interface PasswordResetEmailProps {
  userName: string;
  resetUrl: string;
  expiresIn: string;
}

export function PasswordResetEmail({
  userName,
  resetUrl,
  expiresIn,
}: PasswordResetEmailProps) {
  return (
    <BaseLayout preview="Đặt lại mật khẩu Cờ vua Dương Sinh CRM">
      <Heading style={heading}>Đặt lại mật khẩu</Heading>
      <Text style={text}>Xin chào {userName},</Text>
      <Text style={text}>
        Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản Cờ vua Dương
        Sinh CRM của bạn. Nhấn vào nút bên dưới để tạo mật khẩu mới.
      </Text>

      <Button style={button} href={resetUrl}>
        Đặt lại mật khẩu
      </Button>

      <Section style={warningBox}>
        <Text style={warningText}>
          Link hết hạn sau <strong>{expiresIn}</strong>.
        </Text>
      </Section>

      <Text style={securityNote}>
        Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. Mật khẩu
        hiện tại của bạn vẫn không thay đổi.
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

export default PasswordResetEmail;
