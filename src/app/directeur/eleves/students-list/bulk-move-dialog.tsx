"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { StudentClassOption } from "../student-form-dialog";

/** Choix de la nouvelle classe pour les élèves cochés. */
export function BulkMoveDialog({
  open,
  onOpenChange,
  count,
  classes,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  classes: StudentClassOption[];
  loading: boolean;
  onConfirm: (classId: string) => void;
}) {
  const { t } = useLanguage();
  const [classId, setClassId] = useState("");

  useEffect(() => {
    if (open) setClassId("");
  }, [open]);

  const selectedName = classes.find((c) => c.id === classId)?.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("students.bulkMoveTitle").replace("{count}", String(count))}</DialogTitle>
          <DialogDescription>{t("students.bulkMoveHint")}</DialogDescription>
        </DialogHeader>

        <Select value={classId || undefined} onValueChange={setClassId}>
          <SelectTrigger aria-label={t("students.class")}>
            <SelectValue placeholder={t("students.selectClass")}>{selectedName}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="button" disabled={!classId || loading} onClick={() => onConfirm(classId)}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("common.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
