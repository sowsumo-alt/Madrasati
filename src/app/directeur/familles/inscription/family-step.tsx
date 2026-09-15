"use client";

import { Home, Info, MapPin, Phone, UserRound, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormSection } from "@/components/forms/form-section";
import { FormField, IconInput } from "@/components/forms/form-field";
import { familyLabel } from "@/lib/family";
import { formatPhone } from "@/lib/format";
import { useLanguage } from "@/lib/i18n/language-provider";
import type { KnownFamily } from "../actions";
import type { FamilyDraft, FieldErrors } from "./enrollment-draft";

/** « 46523896 » ou « +22246523896 » -> « +222 46 52 38 96 ». */
function displayPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return formatPhone(`+${digits.length === 8 ? `222${digits}` : digits}`);
}

/**
 * Étape 1 : le nom de la famille et le parent ou tuteur, saisis une seule
 * fois pour tous les enfants. Si le téléphone appartient déjà à une famille,
 * elle est proposée pour y ajouter les enfants au lieu d'en créer une autre.
 */
export function FamilyStep({
  draft,
  errors,
  onChange,
  known,
  usingKnown,
  onUseKnown,
  onLeaveKnown,
}: {
  draft: FamilyDraft;
  errors: FieldErrors;
  onChange: (patch: Partial<FamilyDraft>) => void;
  known: KnownFamily[];
  usingKnown: KnownFamily | null;
  onUseKnown: (family: KnownFamily) => void;
  onLeaveKnown: () => void;
}) {
  const { t } = useLanguage();
  const suggestions = usingKnown ? [] : known;

  return (
    <div className="space-y-4">
      <FormSection icon={Home} title={t("family.step.family")} bodyClassName="sm:grid-cols-1">
        <FormField label={t("family.familyName")} htmlFor="familyName" required error={errors.familyName}>
          <IconInput
            icon={Users}
            id="familyName"
            value={draft.familyName}
            onChange={(e) => onChange({ familyName: e.target.value })}
            placeholder={t("family.familyNamePlaceholder")}
            autoComplete="off"
          />
        </FormField>
      </FormSection>

      <FormSection icon={UserRound} title={t("family.parentSection")}>
        {usingKnown ? (
          <div className="flex flex-col gap-3 rounded-xl border border-primary-200 bg-primary-50/60 p-4 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-semibold text-foreground">
                {usingKnown.parentFirstName} {usingKnown.parentLastName}
              </p>
              <p className="text-sm text-foreground/60" dir="ltr">
                {displayPhone(draft.parentPhone)}
              </p>
              <p className="mt-1 text-xs text-primary-800">{t("family.usingKnown")}</p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={onLeaveKnown}>
              {t("family.changeFamily")}
            </Button>
          </div>
        ) : (
          <>
            <FormField
              label={t("family.parentName")}
              htmlFor="parentName"
              required
              error={errors.parentName}
            >
              <Input
                id="parentName"
                value={draft.parentName}
                onChange={(e) => onChange({ parentName: e.target.value })}
                placeholder={t("family.parentNamePlaceholder")}
                autoComplete="off"
              />
            </FormField>
            <FormField
              label={t("family.parentPhone")}
              htmlFor="parentPhone"
              required
              error={errors.parentPhone}
            >
              <IconInput
                icon={Phone}
                id="parentPhone"
                type="tel"
                inputMode="tel"
                dir="ltr"
                value={draft.parentPhone}
                onChange={(e) => onChange({ parentPhone: e.target.value })}
                placeholder="+222 12 34 56 78"
              />
            </FormField>
            <FormField label={t("family.parentAddress")} htmlFor="parentAddress" className="sm:col-span-2">
              <IconInput
                icon={MapPin}
                id="parentAddress"
                value={draft.parentAddress}
                onChange={(e) => onChange({ parentAddress: e.target.value })}
                placeholder={t("family.parentAddressPlaceholder")}
              />
            </FormField>
          </>
        )}

        {suggestions.map((family) => (
          <div
            key={family.parentId}
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:col-span-2"
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <Info className="h-4 w-4 shrink-0" />
              {t("family.knownTitle")}
            </p>
            <p className="mt-1 text-sm text-amber-900/80">
              <span className="font-semibold">
                {familyLabel(
                  { familyName: family.familyName, lastName: family.parentLastName },
                  t("family.defaultName"),
                )}
              </span>{" "}
              — {family.parentFirstName} {family.parentLastName} ·{" "}
              {family.children.length === 0
                ? t("family.noChildYet")
                : family.children
                    .map((c) => (c.className ? `${c.name} (${c.className})` : c.name))
                    .join(", ")}
            </p>
            <p className="mt-1 text-xs text-amber-900/70">{t("family.knownHint")}</p>
            <Button type="button" size="sm" className="mt-3" onClick={() => onUseKnown(family)}>
              {t("family.useKnown")}
            </Button>
          </div>
        ))}
      </FormSection>
    </div>
  );
}
