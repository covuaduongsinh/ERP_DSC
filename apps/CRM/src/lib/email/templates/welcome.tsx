import { Button, Heading, Text } from "@react-email/components";
import * as React from "react";
import { BaseLayout } from "./base-layout";

export interface WelcomeEmailProps {
  userName: string;
  loginUrl: string;
}

export function WelcomeEmail({ userName, loginUrl }: WelcomeEmailProps) {
  return (
    <BaseLayout
      preview={`Chào mừng ${userName} đến với Cờ vua Dương Sinh CRM!`}
    >
      <Heading style={heading}>
        Chào mừng đến với Cờ vua Dương Sinh CRM!
      </Heading>
      <Text style={text}>
        Xin chào <strong>{userName}</strong>,
      </Text>
      <Text style={text}>
        Tài khoản của bạn đã được tạo thành công. Bạn có thể bắt đầu sử dụng Cờ
        vua Dương Sinh CRM để quản lý khách hàng, theo dõi deal và tối ưu hóa
        quy trình bán hàng.
      </Text>
      <Button style={button} href={loginUrl}>
        Đăng nhập ngay
      </Button>
      <Text style={subtext}>
        Nếu bạn có bất kỳ câu hỏi nào, đừng ngần ngại liên hệ với đội ngũ hỗ trợ
        của chúng tôi.
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

const subtext: React.CSSProperties = {
  color: "#6B7280",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "16px 0 0",
};

export default WelcomeEmail;
