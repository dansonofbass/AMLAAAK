'use client';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
export function DetailDialog({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: React.ReactNode }) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}><DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="dialog-overlay" />
    <DialogPrimitive.Content className="detail-dialog"><DialogPrimitive.Title>{title}</DialogPrimitive.Title>
      <DialogPrimitive.Description>Structured sale record. Personal information and precise location are excluded.</DialogPrimitive.Description>
      <DialogPrimitive.Close className="dialog-close" aria-label="Close property details"><X size={18}/></DialogPrimitive.Close>
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal></DialogPrimitive.Root>;
}
