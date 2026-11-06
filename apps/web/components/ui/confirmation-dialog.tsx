"use client";

import type { ReactNode } from "react";
import { Alert } from "./alert";
import { Button } from "./button";
import { Modal } from "./modal";

export function ConfirmationDialog({
  open,
  title,
  description,
  consequence,
  details,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "warning",
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  consequence: ReactNode;
  details?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "warning" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const close = () => {
    if (!busy) onClose();
  };

  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={close}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={busy} onClick={close}>{cancelLabel}</Button>
          <Button type="button" variant={tone === "danger" ? "danger" : "primary"} disabled={busy} onClick={onConfirm}>
            {busy ? "Working..." : confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {details}
        <Alert tone="warning" title={tone === "danger" ? "This action has serious consequences" : "Review before continuing"}>
          {consequence}
        </Alert>
      </div>
    </Modal>
  );
}