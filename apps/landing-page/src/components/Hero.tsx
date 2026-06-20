"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import CircuitBackground from "./CircuitBackground";
import {
  ArrowRight,
  Calculator,
  Users,
  Factory,
  ShoppingCart,
} from "lucide-react";

export default function Hero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const card1Y = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const card2Y = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const card3Y = useTransform(scrollYProgress, [0, 1], [0, -80]);

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen pt-[120px] md:pt-[160px] pb-[60px] md:pb-[80px]"
    >
      <CircuitBackground variant="hero" className="opacity-70" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,255,255,0.08),transparent)]" />

      <div className="max-w-[1400px] mx-auto px-5 md:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="max-w-[540px]">
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-[12px] md:text-[11px] text-white/60 tracking-[0.15em] uppercase mb-4 md:mb-5 font-medium"
            >
              Nền tảng ERP Mã nguồn mở cho Việt Nam
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="text-[clamp(2rem,7vw,4.5rem)] font-bold tracking-[-0.03em] leading-[1.1] mb-5 md:mb-6"
            >
              <span className="text-white">Nền tảng </span>
              <span className="vierp-logo text-[1.1em]">
                <span className="viet-text">Việt</span>
                <span className="erp-text">
                  <span className="erp-e">E</span>
                  <span className="erp-r">R</span>
                  <span className="erp-p">P</span>
                </span>
              </span>
              <br />
              <span className="text-white/50">Mã nguồn mở.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55 }}
              className="text-[15px] md:text-[17px] text-text-secondary leading-[1.7] mb-6 md:mb-8 max-w-[480px]"
            >
              16 modules ERP cho doanh nghiệp Việt Nam. Tuân thủ VAS TT200, hoá
              đơn điện tử NĐ123, BHXH/BHYT. 1.4 triệu dòng mã TypeScript.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.65 }}
              className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-8 md:mb-10"
            >
              <a
                href="https://github.com/nclamvn/Viet-ERP"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 sharp-button text-white px-6 py-3.5 md:py-3 text-[15px] md:text-[14px] font-medium min-h-[48px]"
              >
                Fork trên GitHub
              </a>
              <a
                href="#modules"
                className="inline-flex items-center gap-1.5 text-[15px] md:text-[14px] text-text-secondary hover:text-text-primary transition-colors font-medium group min-h-[48px]"
              >
                Khám phá Modules
                <ArrowRight
                  size={16}
                  className="group-hover:translate-x-0.5 transition-transform"
                />
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.75 }}
              className="flex items-baseline gap-6 md:gap-8 flex-wrap"
            >
              {[
                { value: "16", label: "Modules" },
                { value: "1.4M+", label: "Dòng mã" },
                { value: "980", label: "Models" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-baseline gap-1.5 md:gap-2"
                >
                  <span className="text-[22px] md:text-[24px] font-bold text-white tracking-[-0.02em]">
                    {stat.value}
                  </span>
                  <span className="text-[11px] md:text-[11px] text-text-tertiary uppercase tracking-[0.05em]">
                    {stat.label}
                  </span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Cards - hidden on small mobile, shown from md */}
          <div
            className="hidden md:block relative h-[520px] lg:h-[580px]"
            style={{ perspective: "1200px" }}
          >
            {/* Card 1: Core Enterprise */}
            <motion.div
              initial={{ opacity: 0, x: 40, rotateX: 25 }}
              animate={{ opacity: 1, x: 0, rotateX: 25 }}
              whileHover={{ rotateX: 15 }}
              transition={{ duration: 0.8, delay: 0.7 }}
              style={{ y: card1Y, transformStyle: "preserve-3d" }}
              className="absolute top-0 left-0 right-0"
            >
              <div
                className="relative overflow-hidden"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(35, 38, 45, 0.95) 0%, rgba(20, 21, 24, 0.9) 40%, rgba(8, 9, 10, 0.98) 100%)",
                  border: "1px solid rgba(34, 197, 94, 0.2)",
                  boxShadow:
                    "0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(34, 197, 94, 0.1)",
                }}
              >
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.03) 25%, transparent 50%, rgba(0, 0, 0, 0.3) 100%)",
                  }}
                />
                <div className="p-5 relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-[#22c55e]/20 flex items-center justify-center">
                      <Calculator size={16} className="text-[#22c55e]" />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-semibold text-text-primary leading-relaxed">
                        Core Enterprise
                      </h3>
                      <p className="text-[11px] text-text-tertiary leading-relaxed">
                        Kế toán, Nhân sự, CRM
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {["Accounting", "HRM", "CRM"].map((p) => (
                      <span
                        key={p}
                        className="text-[10px] px-2.5 py-1 bg-[#22c55e]/10 text-[#22c55e] font-medium"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Card 2: Commerce */}
            <motion.div
              initial={{ opacity: 0, x: -20, rotateX: 20 }}
              animate={{ opacity: 1, x: 0, rotateX: 20 }}
              whileHover={{ rotateX: 12 }}
              transition={{ duration: 0.8, delay: 0.9 }}
              style={{ y: card2Y, transformStyle: "preserve-3d" }}
              className="absolute top-[160px] left-0 z-20"
            >
              <div
                className="w-[220px] p-4 relative overflow-hidden"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(40, 43, 50, 0.98) 0%, rgba(22, 24, 28, 0.95) 40%, rgba(8, 9, 10, 0.98) 100%)",
                  border: "1px solid rgba(6, 182, 212, 0.2)",
                  boxShadow:
                    "0 25px 50px -12px rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(6, 182, 212, 0.1)",
                }}
              >
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.03) 25%, transparent 50%, rgba(0, 0, 0, 0.35) 100%)",
                  }}
                />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 bg-[#06b6d4]/20 flex items-center justify-center">
                      <ShoppingCart size={14} className="text-[#06b6d4]" />
                    </div>
                    <span className="text-[13px] font-semibold text-text-primary leading-relaxed">
                      Commerce
                    </span>
                  </div>
                  <p className="text-[11px] text-text-tertiary mb-2 leading-relaxed">
                    Thương mại & Bán hàng
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {["Ecommerce", "OTB", "TPM"].map((p) => (
                      <span
                        key={p}
                        className="text-[10px] px-2.5 py-1 bg-[#06b6d4]/10 text-[#06b6d4] font-medium"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Card 3: Operations */}
            <motion.div
              initial={{ opacity: 0, x: 40, rotateX: 22 }}
              animate={{ opacity: 1, x: 0, rotateX: 22 }}
              whileHover={{ rotateX: 14 }}
              transition={{ duration: 0.8, delay: 1.1 }}
              style={{ y: card3Y, transformStyle: "preserve-3d" }}
              className="absolute top-[280px] left-[80px] right-0"
            >
              <div
                className="relative overflow-hidden"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(35, 38, 45, 0.95) 0%, rgba(20, 21, 24, 0.9) 40%, rgba(8, 9, 10, 0.98) 100%)",
                  border: "1px solid rgba(139, 92, 246, 0.2)",
                  boxShadow:
                    "0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(139, 92, 246, 0.1)",
                }}
              >
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.03) 25%, transparent 50%, rgba(0, 0, 0, 0.3) 100%)",
                  }}
                />
                <div className="p-4 relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 bg-[#8b5cf6]/20 flex items-center justify-center">
                      <Factory size={14} className="text-[#8b5cf6]" />
                    </div>
                    <span className="text-[13px] font-semibold text-text-primary leading-relaxed">
                      Operations
                    </span>
                  </div>
                  <p className="text-[11px] text-text-tertiary mb-2 leading-relaxed">
                    Sản xuất & Vận hành
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {["MRP", "PM"].map((p) => (
                      <span
                        key={p}
                        className="text-[10px] px-2.5 py-1 bg-[#8b5cf6]/10 text-[#8b5cf6] font-medium"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Card 4: Intelligence */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.3 }}
              className="absolute top-[420px] right-0"
            >
              <div
                className="w-[200px] p-4 relative overflow-hidden"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(35, 38, 45, 0.95) 0%, rgba(20, 21, 24, 0.9) 40%, rgba(8, 9, 10, 0.98) 100%)",
                  border: "1px solid rgba(245, 158, 11, 0.2)",
                  boxShadow:
                    "0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(245, 158, 11, 0.1)",
                }}
              >
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 bg-[#f59e0b]/20 flex items-center justify-center">
                      <Users size={14} className="text-[#f59e0b]" />
                    </div>
                    <span className="text-[13px] font-semibold text-text-primary leading-relaxed">
                      Intelligence
                    </span>
                  </div>
                  <p className="text-[11px] text-text-tertiary mb-2 leading-relaxed">
                    Trí tuệ Nhân tạo
                  </p>
                  <div className="flex gap-1.5">
                    {["ExcelAI"].map((p) => (
                      <span
                        key={p}
                        className="text-[10px] px-2.5 py-1 bg-[#f59e0b]/10 text-[#f59e0b] font-medium"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Mobile cards - horizontal scroll */}
          <div className="md:hidden -mx-5 px-5 overflow-x-auto">
            <div
              className="flex gap-3 pb-4"
              style={{ minWidth: "max-content" }}
            >
              {[
                {
                  name: "Core Enterprise",
                  desc: "Kế toán, Nhân sự, CRM",
                  tags: ["Accounting", "HRM", "CRM"],
                  color: "#22c55e",
                  Icon: Calculator,
                },
                {
                  name: "Commerce",
                  desc: "Thương mại & Bán hàng",
                  tags: ["Ecommerce", "OTB", "TPM"],
                  color: "#06b6d4",
                  Icon: ShoppingCart,
                },
                {
                  name: "Operations",
                  desc: "Sản xuất & Vận hành",
                  tags: ["MRP", "PM"],
                  color: "#8b5cf6",
                  Icon: Factory,
                },
                {
                  name: "Intelligence",
                  desc: "Trí tuệ Nhân tạo",
                  tags: ["ExcelAI"],
                  color: "#f59e0b",
                  Icon: Users,
                },
              ].map((card) => (
                <div
                  key={card.name}
                  className="w-[200px] shrink-0 p-4 border border-white/10 bg-bg-elevated/80"
                >
                  <div className="flex items-center gap-2 mb-2.5">
                    <div
                      className="w-7 h-7 flex items-center justify-center"
                      style={{ backgroundColor: `${card.color}20` }}
                    >
                      <card.Icon size={14} style={{ color: card.color }} />
                    </div>
                    <span className="text-[13px] font-semibold text-text-primary leading-relaxed">
                      {card.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-tertiary mb-2 leading-relaxed">
                    {card.desc}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {card.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-2 py-0.5 font-medium"
                        style={{
                          backgroundColor: `${card.color}15`,
                          color: card.color,
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-bg to-transparent pointer-events-none" />
    </section>
  );
}
