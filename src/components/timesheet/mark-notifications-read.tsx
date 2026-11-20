"use client";

import { useEffect } from "react";
import { markTeacherNotificationsRead } from "@/app/enseignant/pointage/actions";

/** Les messages affichés sont lus : la cloche s'éteint à la prochaine page. */
export function MarkNotificationsRead() {
  useEffect(() => {
    markTeacherNotificationsRead().catch(() => {});
  }, []);
  return null;
}
