#!/usr/bin/env bash
# ============================================================
# VietERP — Bootstrap VPS (Hetzner CAX31, Ubuntu 24.04, ARM64)
# Cài Docker + tạo swap + firewall. Chạy 1 lần với quyền root.
#   ssh root@<IP>  →  bash setup-vps.sh
# ============================================================
set -euo pipefail

SWAP_SIZE="${SWAP_SIZE:-6G}"     # đệm cho lúc build image (tránh OOM trên 16GB)
TIMEZONE="${TIMEZONE:-Asia/Ho_Chi_Minh}"

echo "==> [1/5] Cập nhật hệ thống & timezone ($TIMEZONE)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y && apt-get upgrade -y
timedatectl set-timezone "$TIMEZONE" || true
apt-get install -y ca-certificates curl git ufw

echo "==> [2/5] Tạo swap $SWAP_SIZE (nếu chưa có)"
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l "$SWAP_SIZE" /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=$(( ${SWAP_SIZE%G} * 1024 ))
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -w vm.swappiness=10
  grep -q 'vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
fi

echo "==> [3/5] Cài Docker Engine + plugin compose"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

echo "==> [4/5] Firewall (ufw): mở 22/80/443, đóng cổng nội bộ ra ngoài"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
# KHÔNG mở 5432/6379/8001/8080/3001-3013 — chỉ truy cập nội bộ qua Docker network / reverse proxy.
ufw --force enable

echo "==> [5/5] Xong. Kiểm tra:"
docker --version
docker compose version
free -h | sed -n '1,3p'
echo "Tiếp theo: clone repo về /opt/vierp, tạo .env (xem deploy/.env.prod.example), rồi build + up."
