"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useLanguage } from "../language";
export function DetailDialog({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content className="dialog-content">
          <DialogPrimitive.Title className="dialog-title">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="dialog-description">
            {t(
              "Historical structured record. No contacts or exact location.",
              "آگهی ساختاریافته تاریخی؛ بدون اطلاعات تماس و موقعیت دقیق.",
            )}
          </DialogPrimitive.Description>
          <DialogPrimitive.Close
            className="dialog-close button button-ghost button-icon"
            aria-label={t("Close property details", "بستن جزئیات ملک")}
          >
            <X size={18} />
          </DialogPrimitive.Close>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
