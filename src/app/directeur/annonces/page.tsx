import { Megaphone } from "lucide-react";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { getTranslations } from "@/lib/i18n/server";
import { FeatureComingSoon } from "@/components/layout/feature-coming-soon";

export default async function AnnouncementsPage() {
  await requireRole(ROLES.DIRECTOR);
  const { t } = await getTranslations();
  return (
    <FeatureComingSoon
      icon={Megaphone}
      title={t("soon.announcements")}
      badge={t("soon.title")}
      description={t("soon.description")}
      backLabel={t("soon.back")}
    />
  );
}
