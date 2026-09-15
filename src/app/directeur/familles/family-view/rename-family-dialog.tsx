"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n/language-provider";
import { renameFamily } from "../actions";

/** Renomme la famille (« Famille BA ») ; vide = nom déduit du parent. */
export function RenameFamilyDialog({
  open,
  onOpenChange,
  parentId,
  current,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId: string;
  current: string;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const [name, setName] = useState(current);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setName(current);
  }, [open, current]);

  async function save() {
    setSaving(true);
    try {
      await renameFamily(parentId, name);
      toast.success(t("family.renamed"));
      onOpenChange(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("family.rename")}</DialogTitle>
          <DialogDescription>{t("family.renameHint")}</DialogDescription>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("family.familyNamePlaceholder")}
          aria-label={t("family.familyName")}
          maxLength={80}
          autoFocus
        />
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="button" disabled={saving} onClick={save}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
