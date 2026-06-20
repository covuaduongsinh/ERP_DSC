#!/bin/bash
# ============================================================
# VietERP Platform — GitHub Setup Script
# ============================================================
# Script này sẽ:
# 1. Xóa .git con trong các apps (gom thành 1 monorepo)
# 2. Khởi tạo git repo chính
# 3. Tạo GitHub repo trên org Viet-ERP
# 4. Commit và push toàn bộ
#
# Cách dùng / Usage:
#   cd ~/erp
#   chmod +x scripts/setup-github.sh
#   ./scripts/setup-github.sh
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   VietERP Platform — GitHub Setup               ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ─── Step 0: Check prerequisites ─────────────────────────────
echo -e "${YELLOW}[0/6] Kiểm tra prerequisites...${NC}"

if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ git chưa được cài đặt${NC}"
    exit 1
fi

if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) chưa được cài đặt${NC}"
    echo "   Cài đặt: brew install gh"
    echo "   Sau đó: gh auth login"
    exit 1
fi

# Check gh auth
if ! gh auth status &> /dev/null; then
    echo -e "${RED}❌ Chưa đăng nhập GitHub CLI${NC}"
    echo "   Chạy: gh auth login"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites OK${NC}"

# ─── Step 1: Remove nested .git directories ──────────────────
echo ""
echo -e "${YELLOW}[1/6] Xóa .git con trong apps (gom monorepo)...${NC}"

NESTED_GITS=$(find apps -maxdepth 2 -name ".git" -type d 2>/dev/null)
if [ -n "$NESTED_GITS" ]; then
    for gitdir in $NESTED_GITS; do
        echo "   Removing $gitdir"
        rm -rf "$gitdir"
    done
    echo -e "${GREEN}✅ Đã xóa $(echo "$NESTED_GITS" | wc -l | tr -d ' ') nested .git directories${NC}"
else
    echo -e "${GREEN}✅ Không có .git con${NC}"
fi

# Also remove TPM nested git if exists
if [ -d "TPM/.git" ]; then
    rm -rf TPM/.git
    echo "   Removed TPM/.git"
fi

# ─── Step 2: Initialize git repo ─────────────────────────────
echo ""
echo -e "${YELLOW}[2/6] Khởi tạo git repo...${NC}"

if [ -d ".git" ]; then
    echo "   Git repo đã tồn tại, reset..."
    rm -rf .git
fi

git init
git checkout -b main
echo -e "${GREEN}✅ Git repo initialized on 'main' branch${NC}"

# ─── Step 3: Create GitHub organization repo ─────────────────
echo ""
echo -e "${YELLOW}[3/6] Tạo GitHub repo Viet-ERP/erp-platform...${NC}"

# Check if org exists, if not create under user
ORG="Viet-ERP"
REPO="erp-platform"

# Try to create org repo, fallback to user repo
if gh api "orgs/$ORG" &> /dev/null; then
    echo "   Organization $ORG đã tồn tại"
else
    echo -e "${YELLOW}   Organization $ORG chưa tồn tại. Tạo mới...${NC}"
    gh api \
      --method POST \
      -H "Accept: application/vnd.github+json" \
      /user/orgs \
      -f login="$ORG" \
      -f name="VietERP Open-Source Platform" \
      -f description="Nền tảng ERP mã nguồn mở cho doanh nghiệp Việt Nam" \
      -f blog="https://github.com/Viet-ERP" 2>/dev/null || {
        echo -e "${YELLOW}   Không thể tạo org tự động. Sẽ push lên nclamvn/$REPO${NC}"
        ORG="nclamvn"
    }
fi

# Create repo
if gh repo view "$ORG/$REPO" &> /dev/null; then
    echo -e "${YELLOW}   Repo $ORG/$REPO đã tồn tại${NC}"
else
    gh repo create "$ORG/$REPO" \
        --public \
        --description "VietERP Platform — Nền tảng ERP mã nguồn mở cho doanh nghiệp Việt Nam / Open-source ERP for Vietnamese enterprises" \
        --homepage "https://github.com/$ORG" \
        --license mit \
        || {
            echo -e "${RED}❌ Không thể tạo repo. Tạo thủ công tại: https://github.com/new${NC}"
            echo "   Repo name: $REPO"
            echo "   Sau đó chạy lại script"
            exit 1
        }
    echo -e "${GREEN}✅ Repo created: https://github.com/$ORG/$REPO${NC}"
fi

# ─── Step 4: Stage all files ─────────────────────────────────
echo ""
echo -e "${YELLOW}[4/6] Stage toàn bộ files...${NC}"

# Add everything except what's in .gitignore
git add -A

# Show summary
STAGED=$(git diff --cached --stat | tail -1)
echo -e "${GREEN}✅ Staged: $STAGED${NC}"

# ─── Step 5: Commit ──────────────────────────────────────────
echo ""
echo -e "${YELLOW}[5/6] Commit...${NC}"

git commit -m "$(cat <<'EOF'
feat: VietERP Platform v1.0.0 — Open-source ERP ecosystem

Nền tảng ERP mã nguồn mở toàn diện cho doanh nghiệp Việt Nam.
Comprehensive open-source ERP platform for Vietnamese enterprises.

## Modules (14 ứng dụng / applications)
- HRM-Unified — Quản lý nhân sự (tích hợp AI)
- CRM — Quản lý khách hàng
- MRP — Quản lý sản xuất
- Accounting — Kế toán (TT200)
- Ecommerce — Thương mại điện tử
- OTB — Open-To-Buy Planning
- TPM (Web + API) — Quản lý khuyến mãi
- PM — Quản lý dự án
- ExcelAI — Phân tích Excel AI

## Packages (20 shared libraries)
@vierp/branding, events, auth, security, ai-copilot,
api-middleware, cache, database, errors, health,
i18n, logger, notifications, saas, sdk, and more.

## Tech Stack
Next.js 14, React 18, TypeScript 5, PostgreSQL 16,
Prisma ORM, NATS JetStream, Keycloak SSO, Kong Gateway

## Key Features
- Bilingual Vi-En UI (song ngữ)
- VAS Accounting TT200 compliance
- e-Invoice NĐ123 integration
- VNPay/MoMo/ZaloPay payments
- GHN/GHTK/Viettel Post shipping
- White-label ready (scripts/rebrand.ts)
- MIT License
EOF
)"

echo -e "${GREEN}✅ Committed${NC}"

# ─── Step 6: Push ────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[6/6] Push lên GitHub...${NC}"

git remote add origin "https://github.com/$ORG/$REPO.git"
git push -u origin main

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   ✅ HOÀN TẤT / COMPLETE                       ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║   Repo: https://github.com/$ORG/$REPO    ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
