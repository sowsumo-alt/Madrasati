import { Lightbulb } from "lucide-react";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { getTranslations } from "@/lib/i18n/server";
import { FeatureComingSoon } from "@/components/layout/feature-coming-soon";

export default async function HelpPage() {
  await requireRole(ROLES.DIRECTOR);
  const { t } = await getTranslations();
  return (
    <FeatureComingSoon
      icon={Lightbulb}
      title={t("soon.help")}
      badge={t("soon.title")}
      description={t("soon.description")}
      backLabel={t("soon.back")}
    />
  );
}
