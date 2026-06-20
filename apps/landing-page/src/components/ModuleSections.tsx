"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import ScrollReveal from "./ScrollReveal";
import CircuitBackground from "./CircuitBackground";
import {
  ArrowRight,
  Calculator,
  Users,
  Users2,
  ShoppingCart,
  Package,
  Tag,
  Factory,
  ClipboardList,
  FileSpreadsheet,
  Brain,
} from "lucide-react";

function SectionDivider() {
  return (
    <div className="max-w-[1400px] mx-auto px-6">
      <div className="border-t border-border" />
    </div>
  );
}

function CoreSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);

  const mods = [
    {
      id: "accounting",
      name: "Accounting",
      icon: Calculator,
      desc: "Kế toán VAS TT200",
    },
    { id: "hrm", name: "HRM", icon: Users, desc: "Quản trị nhân sự" },
    { id: "crm", name: "CRM", icon: Users2, desc: "Quản lý khách hàng" },
  ];

  return (
    <div ref={ref} className="py-[80px] md:py-[120px] relative overflow-hidden">
      <CircuitBackground variant="products" className="opacity-40" />
      <div className="max-w-[1400px] mx-auto px-5 md:px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-10 md:gap-16 items-center">
          <ScrollReveal direction="up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#22c55e]/15 flex items-center justify-center">
                <Calculator size={20} className="text-[#22c55e]" />
              </div>
              <p className="text-[12px] text-[#22c55e] tracking-[0.08em] uppercase font-medium">
                Core Enterprise
              </p>
            </div>
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-[-0.03em] leading-[1.1] mb-5">
              <span className="gradient-text">Kế toán, Nhân sự, CRM</span>
              <br />
              <span className="text-text-tertiary">
                chuẩn doanh nghiệp Việt Nam.
              </span>
            </h2>
            <p className="text-[15px] text-text-secondary leading-[1.7] mb-6 max-w-[420px]">
              Tuân thủ VAS TT200, hoá đơn điện tử NĐ123, BHXH/BHYT/BHTN. Tích
              hợp VNPay, 20+ ngân hàng, Zalo/Facebook.
            </p>
            <a
              href="https://github.com/nclamvn/Viet-ERP"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#22c55e] hover:gap-2.5 transition-all group min-h-[44px] inline-flex items-center"
            >
              Xem mã nguồn{" "}
              <ArrowRight
                size={13}
                className="group-hover:translate-x-0.5 transition-transform"
              />
            </a>
          </ScrollReveal>

          <ScrollReveal delay={0.15}>
            <div style={{ perspective: "1000px" }}>
              <motion.div
                style={{ y }}
                className="relative"
                whileHover={{ rotateX: 10 }}
                transition={{ duration: 0.3 }}
                initial={{ rotateX: 15 }}
                animate={{ rotateX: 15 }}
              >
                <div
                  className="overflow-hidden relative p-6"
                  style={{
                    background:
                      "linear-gradient(145deg, rgba(35, 38, 45, 0.95) 0%, rgba(20, 21, 24, 0.9) 50%, rgba(12, 13, 15, 0.95) 100%)",
                    border: "1px solid rgba(34, 197, 94, 0.15)",
                    boxShadow:
                      "0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(34, 197, 94, 0.1)",
                    transformStyle: "preserve-3d",
                  }}
                >
                  <div
                    className="absolute inset-0 pointer-events-none z-10"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 25%, transparent 50%, rgba(0, 0, 0, 0.4) 100%)",
                    }}
                  />
                  <div className="grid grid-cols-3 gap-3 relative z-0">
                    {mods.map((p) => (
                      <div
                        key={p.id}
                        className="group/card p-4 bg-bg-tertiary/50 border border-border hover:border-[#22c55e]/30 hover:bg-[#22c55e]/5 transition-all duration-300"
                      >
                        <p.icon
                          size={18}
                          className="text-[#22c55e] mb-2 group-hover/card:scale-110 transition-transform"
                        />
                        <p className="text-[13px] font-semibold text-text-primary mb-0.5 leading-relaxed">
                          {p.name}
                        </p>
                        <p className="text-[11px] text-text-tertiary leading-relaxed">
                          {p.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
}

function CommerceSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);

  const mods = [
    {
      id: "ecommerce",
      name: "Ecommerce",
      icon: ShoppingCart,
      desc: "Thương mại điện tử",
    },
    { id: "otb", name: "OTB", icon: Package, desc: "Open-To-Buy" },
    { id: "tpm", name: "TPM", icon: Tag, desc: "Khuyến mãi thương mại" },
  ];

  return (
    <div ref={ref} className="py-[80px] md:py-[120px] relative overflow-hidden">
      <CircuitBackground variant="products" className="opacity-40" />
      <div className="max-w-[1400px] mx-auto px-5 md:px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-10 md:gap-16 items-center">
          <ScrollReveal delay={0.15} className="order-2 lg:order-1">
            <div style={{ perspective: "1000px" }}>
              <motion.div
                style={{ y }}
                className="relative"
                whileHover={{ rotateX: 10 }}
                transition={{ duration: 0.3 }}
                initial={{ rotateX: 15 }}
                animate={{ rotateX: 15 }}
              >
                <div
                  className="overflow-hidden relative p-6"
                  style={{
                    background:
                      "linear-gradient(145deg, rgba(35, 38, 45, 0.95) 0%, rgba(20, 21, 24, 0.9) 50%, rgba(12, 13, 15, 0.95) 100%)",
                    border: "1px solid rgba(6, 182, 212, 0.15)",
                    boxShadow:
                      "0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(6, 182, 212, 0.1)",
                    transformStyle: "preserve-3d",
                  }}
                >
                  <div
                    className="absolute inset-0 pointer-events-none z-10"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 25%, transparent 50%, rgba(0, 0, 0, 0.4) 100%)",
                    }}
                  />
                  <div className="grid grid-cols-3 gap-3 relative z-0">
                    {mods.map((p) => (
                      <div
                        key={p.id}
                        className="group/card p-4 bg-bg-tertiary/50 border border-border hover:border-[#06b6d4]/30 hover:bg-[#06b6d4]/5 transition-all duration-300"
                      >
                        <p.icon
                          size={18}
                          className="text-[#06b6d4] mb-2 group-hover/card:scale-110 transition-transform"
                        />
                        <p className="text-[13px] font-semibold text-text-primary mb-0.5 leading-relaxed">
                          {p.name}
                        </p>
                        <p className="text-[11px] text-text-tertiary leading-relaxed">
                          {p.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </ScrollReveal>

          <ScrollReveal className="order-1 lg:order-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#06b6d4]/15 flex items-center justify-center">
                <ShoppingCart size={20} className="text-[#06b6d4]" />
              </div>
              <p className="text-[12px] text-[#06b6d4] tracking-[0.08em] uppercase font-medium">
                Commerce & Trade
              </p>
            </div>
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-[-0.03em] leading-[1.1] mb-5">
              <span className="gradient-text">Thương mại & Bán hàng</span>
              <br />
              <span className="text-text-tertiary">đa kênh, tối ưu.</span>
            </h2>
            <p className="text-[15px] text-text-secondary leading-[1.7] mb-6 max-w-[420px]">
              TMĐT tích hợp VNPay/MoMo, GHN/GHTK. OTB cho Retail/FMCG. Trade
              Promotion Management end-to-end.
            </p>
            <a
              href="https://github.com/nclamvn/Viet-ERP"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#06b6d4] hover:gap-2.5 transition-all group min-h-[44px] inline-flex items-center"
            >
              Xem mã nguồn{" "}
              <ArrowRight
                size={13}
                className="group-hover:translate-x-0.5 transition-transform"
              />
            </a>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
}

function OperationsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);

  const mods = [
    { id: "mrp", name: "MRP", icon: Factory, desc: "Hoạch định sản xuất" },
    { id: "pm", name: "PM", icon: ClipboardList, desc: "Quản lý dự án" },
  ];

  return (
    <div ref={ref} className="py-[80px] md:py-[120px] relative overflow-hidden">
      <CircuitBackground variant="products" className="opacity-40" />
      <div className="max-w-[1400px] mx-auto px-5 md:px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-10 md:gap-16 items-center">
          <ScrollReveal>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#8b5cf6]/15 flex items-center justify-center">
                <Factory size={20} className="text-[#8b5cf6]" />
              </div>
              <p className="text-[12px] text-[#8b5cf6] tracking-[0.08em] uppercase font-medium">
                Operations & Manufacturing
              </p>
            </div>
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-[-0.03em] leading-[1.1] mb-5">
              <span className="gradient-text">Sản xuất & Vận hành</span>
              <br />
              <span className="text-text-tertiary">thông minh, tự động.</span>
            </h2>
            <p className="text-[15px] text-text-secondary leading-[1.7] mb-6 max-w-[420px]">
              MRP/MES cho nhà máy: BOM, Work Orders, Quality Control. PM với
              Kanban, Gantt, Sprint planning.
            </p>
            <a
              href="https://github.com/nclamvn/Viet-ERP"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#8b5cf6] hover:gap-2.5 transition-all group min-h-[44px] inline-flex items-center"
            >
              Xem mã nguồn{" "}
              <ArrowRight
                size={13}
                className="group-hover:translate-x-0.5 transition-transform"
              />
            </a>
          </ScrollReveal>

          <ScrollReveal delay={0.15}>
            <div style={{ perspective: "1000px" }}>
              <motion.div
                style={{ y }}
                className="relative"
                whileHover={{ rotateX: 10 }}
                transition={{ duration: 0.3 }}
                initial={{ rotateX: 15 }}
                animate={{ rotateX: 15 }}
              >
                <div
                  className="overflow-hidden relative p-6"
                  style={{
                    background:
                      "linear-gradient(145deg, rgba(35, 38, 45, 0.95) 0%, rgba(20, 21, 24, 0.9) 50%, rgba(12, 13, 15, 0.95) 100%)",
                    border: "1px solid rgba(139, 92, 246, 0.15)",
                    boxShadow:
                      "0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(139, 92, 246, 0.1)",
                    transformStyle: "preserve-3d",
                  }}
                >
                  <div
                    className="absolute inset-0 pointer-events-none z-10"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 25%, transparent 50%, rgba(0, 0, 0, 0.4) 100%)",
                    }}
                  />
                  <div className="grid grid-cols-2 gap-3 relative z-0">
                    {mods.map((p) => (
                      <div
                        key={p.id}
                        className="group/card p-4 bg-bg-tertiary/50 border border-border hover:border-[#8b5cf6]/30 hover:bg-[#8b5cf6]/5 transition-all duration-300"
                      >
                        <p.icon
                          size={18}
                          className="text-[#8b5cf6] mb-2 group-hover/card:scale-110 transition-transform"
                        />
                        <p className="text-[13px] font-semibold text-text-primary mb-0.5 leading-relaxed">
                          {p.name}
                        </p>
                        <p className="text-[11px] text-text-tertiary leading-relaxed">
                          {p.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
}

function IntelligenceSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);

  const mods = [
    {
      id: "excel-ai",
      name: "ExcelAI",
      icon: FileSpreadsheet,
      desc: "Phân tích Excel bằng AI",
    },
  ];

  return (
    <div ref={ref} className="py-[80px] md:py-[120px] relative overflow-hidden">
      <CircuitBackground variant="products" className="opacity-40" />
      <div className="max-w-[1400px] mx-auto px-5 md:px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-10 md:gap-16 items-center">
          <ScrollReveal delay={0.15} className="order-2 lg:order-1">
            <div style={{ perspective: "1000px" }}>
              <motion.div
                style={{ y }}
                className="relative"
                whileHover={{ rotateX: 10 }}
                transition={{ duration: 0.3 }}
                initial={{ rotateX: 15 }}
                animate={{ rotateX: 15 }}
              >
                <div
                  className="overflow-hidden relative p-6"
                  style={{
                    background:
                      "linear-gradient(145deg, rgba(35, 38, 45, 0.95) 0%, rgba(20, 21, 24, 0.9) 50%, rgba(12, 13, 15, 0.95) 100%)",
                    border: "1px solid rgba(245, 158, 11, 0.15)",
                    boxShadow:
                      "0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(245, 158, 11, 0.1)",
                    transformStyle: "preserve-3d",
                  }}
                >
                  <div
                    className="absolute inset-0 pointer-events-none z-10"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 25%, transparent 50%, rgba(0, 0, 0, 0.4) 100%)",
                    }}
                  />
                  <div className="relative z-0">
                    <div className="mb-4 p-3 bg-black/50 border border-border font-mono text-[10px]">
                      <div className="flex items-center gap-2 mb-2 text-text-tertiary">
                        <span className="text-[#f59e0b]">AI</span>
                        <span>Analyzing sales_q4.xlsx...</span>
                      </div>
                      <div className="text-[#22c55e]">
                        Found 3 insights, 2 anomalies
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {mods.map((p) => (
                        <div
                          key={p.id}
                          className="group/card p-4 bg-bg-tertiary/50 border border-border hover:border-[#f59e0b]/30 hover:bg-[#f59e0b]/5 transition-all duration-300"
                        >
                          <p.icon
                            size={18}
                            className="text-[#f59e0b] mb-2 group-hover/card:scale-110 transition-transform"
                          />
                          <p className="text-[13px] font-semibold text-text-primary mb-0.5 leading-relaxed">
                            {p.name}
                          </p>
                          <p className="text-[11px] text-text-tertiary leading-relaxed">
                            {p.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </ScrollReveal>

          <ScrollReveal className="order-1 lg:order-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[#f59e0b]/15 flex items-center justify-center">
                <Brain size={20} className="text-[#f59e0b]" />
              </div>
              <p className="text-[12px] text-[#f59e0b] tracking-[0.08em] uppercase font-medium">
                AI & Intelligence
              </p>
            </div>
            <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-[-0.03em] leading-[1.1] mb-5">
              <span className="gradient-text">Trí tuệ Nhân tạo</span>
              <br />
              <span className="text-text-tertiary">cho mọi quy trình.</span>
            </h2>
            <p className="text-[15px] text-text-secondary leading-[1.7] mb-6 max-w-[420px]">
              AI phân tích Excel, screening CV tự động, dự đoán turnover,
              chatbot HR, workforce analytics.
            </p>
            <a
              href="https://github.com/nclamvn/Viet-ERP"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#f59e0b] hover:gap-2.5 transition-all group min-h-[44px] inline-flex items-center"
            >
              Xem mã nguồn{" "}
              <ArrowRight
                size={13}
                className="group-hover:translate-x-0.5 transition-transform"
              />
            </a>
          </ScrollReveal>
        </div>
      </div>
    </div>
  );
}

export default function ModuleSections() {
  return (
    <section id="modules">
      <CoreSection />
      <SectionDivider />
      <CommerceSection />
      <SectionDivider />
      <OperationsSection />
      <SectionDivider />
      <IntelligenceSection />
    </section>
  );
}
