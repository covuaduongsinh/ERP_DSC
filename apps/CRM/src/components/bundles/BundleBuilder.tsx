"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/i18n";
import { useProducts } from "@/hooks/use-products";
import { useCreateBundle, useUpdateBundle } from "@/hooks/use-bundles";
import { CompatibilityWarning } from "./CompatibilityWarning";
import { formatCurrency, BUNDLE_TYPES } from "@/lib/constants";
import type { Bundle } from "@/hooks/use-bundles";
import { useToast } from "@/hooks/use-toast";

interface BundleItemState {
  productId: string;
  quantity: number;
  isRequired: boolean;
  sortOrder: number;
}

interface BundleBuilderProps {
  bundle?: Bundle;
}

export function BundleBuilder({ bundle }: BundleBuilderProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: productsData } = useProducts();
  const createBundle = useCreateBundle();
  const updateBundle = useUpdateBundle();
  const { toast } = useToast();
  const products = productsData?.data || [];

  const [name, setName] = useState(bundle?.name || "");
  const [sku, setSku] = useState(bundle?.sku || "");
  const [description, setDescription] = useState(bundle?.description || "");
  const [bundleType, setBundleType] = useState(bundle?.bundleType || "PACKAGE");
  const [basePrice, setBasePrice] = useState(
    bundle?.basePrice?.toString() || "",
  );
  const [currency, setCurrency] = useState(bundle?.currency || "USD");
  const [items, setItems] = useState<BundleItemState[]>(
    bundle?.items?.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      isRequired: i.isRequired,
      sortOrder: i.sortOrder,
    })) || [],
  );

  const [compatRules, setCompatRules] = useState<
    Array<{
      type: string;
      notes: string | null;
      product: { id: string; name: string };
      relatedProduct: { id: string; name: string };
    }>
  >(bundle?.compatibilityWarnings || []);

  // Fetch compatibility rules when products change
  const productIds = items.map((i) => i.productId).filter(Boolean);

  const addItem = () => {
    setItems([
      ...items,
      { productId: "", quantity: 1, isRequired: true, sortOrder: items.length },
    ]);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, updates: Partial<BundleItemState>) => {
    setItems(
      items.map((item, i) => (i === idx ? { ...item, ...updates } : item)),
    );
  };

  // Calculate total from items
  const calculatedTotal = items.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product) return sum;
    return sum + Number(product.unitPrice) * item.quantity;
  }, 0);

  const handleSave = async () => {
    if (!name || !sku || items.length === 0) {
      toast({
        description: "Name, SKU and at least one item are required",
        variant: "destructive",
      });
      return;
    }

    const data = {
      name,
      sku,
      description: description || undefined,
      bundleType: bundleType as "PACKAGE" | "KIT" | "SERVICE_PLAN",
      basePrice: parseFloat(basePrice) || calculatedTotal,
      currency,
      isActive: true,
      sortOrder: 0,
      items: items
        .filter((i) => i.productId)
        .map((i, idx) => ({
          productId: i.productId,
          quantity: i.quantity,
          isRequired: i.isRequired,
          sortOrder: idx,
        })),
    };

    try {
      if (bundle) {
        await updateBundle.mutateAsync({ id: bundle.id, data });
        toast({ description: "Bundle updated" });
      } else {
        await createBundle.mutateAsync(data);
        toast({ description: "Bundle created" });
        router.push("/products?tab=bundles");
      }
    } catch (err: any) {
      toast({
        description: err.message || "Failed to save bundle",
        variant: "destructive",
      });
    }
  };

  const isPending = createBundle.isPending || updateBundle.isPending;

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="glass-card-static p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-[var(--crm-text-secondary)] mb-1 block">
              {t("common.name")} *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Hera Law Enforcement Package"
              className="input-premium bg-[var(--crm-bg-page)] border-[var(--crm-border)] text-[var(--crm-text-primary)]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--crm-text-secondary)] mb-1 block">
              SKU *
            </label>
            <Input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="CVDS-PKG-LAW"
              className="input-premium bg-[var(--crm-bg-page)] border-[var(--crm-border)] text-[var(--crm-text-primary)]"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-[var(--crm-text-secondary)] mb-1 block">
            {t("common.description")}
          </label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input-premium bg-[var(--crm-bg-page)] border-[var(--crm-border)] text-[var(--crm-text-primary)]"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-[var(--crm-text-secondary)] mb-1 block">
              {t("bundles.type.PACKAGE")}
            </label>
            <Select value={bundleType} onValueChange={setBundleType}>
              <SelectTrigger className="input-premium bg-[var(--crm-bg-page)] border-[var(--crm-border)] text-[var(--crm-text-primary)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[var(--crm-bg-hover)] border-[var(--crm-border)]">
                {BUNDLE_TYPES.map((bt) => (
                  <SelectItem
                    key={bt.value}
                    value={bt.value}
                    className="text-[var(--crm-text-primary)] focus:bg-[var(--crm-bg-subtle)] focus:text-[var(--crm-text-primary)]"
                  >
                    {t(bt.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--crm-text-secondary)] mb-1 block">
              {t("bundles.basePrice")}
            </label>
            <Input
              type="number"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              placeholder={calculatedTotal.toString()}
              className="input-premium bg-[var(--crm-bg-page)] border-[var(--crm-border)] text-[var(--crm-text-primary)]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--crm-text-secondary)] mb-1 block">
              {t("quotes.currency")}
            </label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="input-premium bg-[var(--crm-bg-page)] border-[var(--crm-border)] text-[var(--crm-text-primary)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[var(--crm-bg-hover)] border-[var(--crm-border)]">
                <SelectItem
                  value="USD"
                  className="text-[var(--crm-text-primary)] focus:bg-[var(--crm-bg-subtle)]"
                >
                  USD
                </SelectItem>
                <SelectItem
                  value="VND"
                  className="text-[var(--crm-text-primary)] focus:bg-[var(--crm-bg-subtle)]"
                >
                  VND
                </SelectItem>
                <SelectItem
                  value="EUR"
                  className="text-[var(--crm-text-primary)] focus:bg-[var(--crm-bg-subtle)]"
                >
                  EUR
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="glass-card-static p-4 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--crm-text-primary)]">
          {t("bundles.items")}
        </h3>

        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center gap-2 p-2 rounded-md bg-[var(--crm-bg-subtle)]"
          >
            <GripVertical className="w-4 h-4 text-[var(--crm-text-muted)] flex-shrink-0" />

            <Select
              value={item.productId}
              onValueChange={(v) => updateItem(idx, { productId: v })}
            >
              <SelectTrigger className="input-premium bg-[var(--crm-bg-page)] border-[var(--crm-border)] text-[var(--crm-text-primary)] flex-1 h-8 text-xs">
                <SelectValue placeholder={t("quotes.selectProduct")} />
              </SelectTrigger>
              <SelectContent className="bg-[var(--crm-bg-hover)] border-[var(--crm-border)]">
                {products
                  .filter((p) => p.isActive)
                  .map((p) => (
                    <SelectItem
                      key={p.id}
                      value={p.id}
                      className="text-[var(--crm-text-primary)] text-xs focus:bg-[var(--crm-bg-subtle)] focus:text-[var(--crm-text-primary)]"
                    >
                      {p.name} ({p.sku})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Input
              type="number"
              min={1}
              value={item.quantity}
              onChange={(e) =>
                updateItem(idx, { quantity: parseInt(e.target.value) || 1 })
              }
              className="input-premium bg-[var(--crm-bg-page)] border-[var(--crm-border)] text-[var(--crm-text-primary)] w-16 h-8 text-xs text-center"
            />

            <button
              type="button"
              onClick={() => updateItem(idx, { isRequired: !item.isRequired })}
              className={`px-2 py-1 rounded text-[10px] font-medium ${
                item.isRequired
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-gray-500/20 text-gray-400"
              }`}
            >
              {item.isRequired ? t("bundles.required") : t("bundles.optional")}
            </button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeItem(idx)}
              className="h-7 w-7 text-[var(--crm-text-muted)] hover:text-red-400 hover:bg-red-400/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
          className="border-[var(--crm-border)] text-[var(--crm-text-secondary)] hover:text-[var(--crm-text-primary)] hover:bg-[var(--crm-bg-subtle)]"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          {t("quotes.addProduct")}
        </Button>
      </div>

      {/* Compatibility warnings */}
      {compatRules.length > 0 && (
        <CompatibilityWarning rules={compatRules} productIds={productIds} />
      )}

      {/* Preview */}
      <div className="glass-card-static p-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs text-[var(--crm-text-muted)]">
              {t("bundles.items")}: {items.filter((i) => i.productId).length}
            </p>
            <p className="text-xs text-[var(--crm-text-muted)]">
              Calculated total: {formatCurrency(calculatedTotal, currency)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--crm-text-muted)]">
              {t("bundles.basePrice")}
            </p>
            <p className="text-lg font-bold text-[#10B981]">
              {formatCurrency(
                parseFloat(basePrice) || calculatedTotal,
                currency,
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="border-[var(--crm-border)] text-[var(--crm-text-secondary)]"
        >
          {t("common.cancel")}
        </Button>
        <Button
          onClick={handleSave}
          disabled={isPending}
          className="bg-[#10B981] hover:bg-[#059669] text-white"
        >
          <Save className="w-4 h-4 mr-1.5" />
          {isPending ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </div>
  );
}
