import { Bell } from "lucide-react";
import { requireRole } from "@/lib/session";
import { ROLES } from "@/lib/roles";
import { getTranslations } from "@/lib/i18n/server";
import { FeatureComingSoon } from "@/components/layout/feature-coming-soon";

export default async function NotificationsPage() {
  await requireRole(ROLES.DIRECTOR);
  const { t } = await getTranslations();
  return (
    <FeatureComingSoon
      icon={Bell}
      title={t("nav.notifications")}
      badge={t("soon.title")}
      description={t("soon.description")}
      backLabel={t("soon.back")}
    />
  );
}
