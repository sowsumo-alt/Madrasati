import type { TranslationKey } from "@/lib/i18n/dictionaries";
import type { FeeRow } from "../finance-view";

// Le lien de parenté est saisi en texte libre (« père », « Mère », « tuteur ») :
// seuls les cas connus sont traduits, les autres retombent sur « Parent ».
const RELATIONSHIPS: Record<string, TranslationKey> = {
  père: "finance.relationship.father",
  pere: "finance.relationship.father",
  mère: "finance.relationship.mother",
  mere: "finance.relationship.mother",
  tuteur: "finance.relationship.guardian",
  tutrice: "finance.relationship.guardian",
};

/** « Père : Ahmed Ould Mohamed », ou « Parent : … » quand le lien n'est pas renseigné. */
export function parentLine(
  fee: Pick<FeeRow, "parent">,
  t: (key: TranslationKey) => string,
): string | null {
  if (!fee.parent) return null;
  const relation =
    RELATIONSHIPS[(fee.parent.relationship ?? "").trim().toLowerCase()] ?? "finance.parentLabel";
  return t("finance.parentLine")
    .replace("{relation}", t(relation))
    .replace("{name}", `${fee.parent.firstName} ${fee.parent.lastName}`);
}
