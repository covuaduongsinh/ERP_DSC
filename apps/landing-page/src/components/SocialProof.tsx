"use client";

import { motion } from "framer-motion";
import ScrollReveal from "./ScrollReveal";
import CircuitBackground from "./CircuitBackground";
import { Calculator, ShoppingCart, Factory, Brain } from "lucide-react";

const categoryIcons = [
  { icon: Calculator, name: "Core", color: "#22c55e", count: 3 },
  { icon: ShoppingCart, name: "Commerce", color: "#06b6d4", count: 3 },
  { icon: Factory, name: "Operations", color: "#8b5cf6", count: 2 },
  { icon: Brain, name: "Intelligence", color: "#f59e0b", count: 1 },
];

export default function SocialProof() {
  return (
    <section className="py-[80px] md:py-[140px] bg-bg-secondary overflow-hidden relative">
      <CircuitBackground variant="social" className="opacity-50" />
      <div className="max-w-[1400px] mx-auto px-5 md:px-6 text-center relative z-10">
        <ScrollReveal>
          <div className="relative mb-12">
            <div className="flex flex-wrap items-center justify-center gap-4 max-w-[600px] mx-auto mb-10">
              {categoryIcons.map((line, i) => (
                <motion.div
                  key={line.name}
                  initial={{ opacity: 0, scale: 0.5 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{
                    delay: i * 0.1,
                    duration: 0.3,
                    type: "spring",
                    stiffness: 300,
                  }}
                  className="flex flex-col items-center gap-2 p-4 border border-border bg-bg-tertiary/50 hover:border-white/20 transition-all duration-200 cursor-pointer group min-w-[120px]"
                >
                  <div
                    className="w-10 h-10 flex items-center justify-center transition-colors"
                    style={{ backgroundColor: `${line.color}15` }}
                  >
                    <line.icon size={20} style={{ color: line.color }} />
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] font-medium text-text-primary">
                      {line.name}
                    </p>
                    <p className="text-[9px] text-text-tertiary">
                      {line.count} modules
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.3}>
          <h2 className="text-[clamp(1.8rem,4vw,3rem)] font-bold tracking-[-0.03em] leading-[1.1] mb-5">
            <span className="gradient-text">16 modules. 27 packages.</span>
            <br />
            <span className="text-text-tertiary">
              Một hệ sinh thái mã nguồn mở.
            </span>
          </h2>
          <p className="text-[14px] text-text-tertiary leading-[1.7] max-w-[500px] mx-auto mb-8">
            Từ kế toán đến sản xuất, từ CRM đến AI analytics — tất cả trong một
            monorepo, sẵn sàng fork và deploy.
          </p>
          <div className="flex items-center justify-center gap-4 mt-8">
            <a
              href="https://github.com/nclamvn/Viet-ERP"
              target="_blank"
              rel="noopener noreferrer"
              className="sharp-button text-white px-5 py-[10px] text-[14px] font-medium"
            >
              Fork trên GitHub
            </a>
            <a
              href="#modules"
              className="text-[14px] text-text-secondary hover:text-text-primary transition-colors font-medium"
            >
              Xem tất cả modules
            </a>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.4} className="mt-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: "1.4M+", label: "Dòng mã" },
              { value: "16", label: "Modules" },
              { value: "980", label: "Prisma Models" },
              { value: "723", label: "Test Files" },
            ].map((s) => (
              <div key={s.label} className="group">
                <p className="text-[28px] md:text-[36px] font-bold tracking-[-0.03em] text-white group-hover:opacity-100 opacity-90 transition-opacity">
                  {s.value}
                </p>
                <p className="text-[12px] text-text-tertiary mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
