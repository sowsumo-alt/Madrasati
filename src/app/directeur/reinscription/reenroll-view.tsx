"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/lib/i18n/language-provider";
import { reenrollStudent, reenrollClass, markNotReenrolled } from "./actions";

export interface ReenrollStudent {
  id: string;
  firstName: string;
  lastName: string;
  classId: string | null;
  className: string | null;
  yearLabel: string | null;
}

export interface ReenrollClassOption {
  id: string;
  name: string;
}

interface Group {
  key: string;
  className: string;
  yearLabel: string | null;
  students: ReenrollStudent[];
}

export function ReenrollView({
  students,
  targetClasses,
  hasCurrentYear,
}: {
  students: ReenrollStudent[];
  targetClasses: ReenrollClassOption[];
  hasCurrentYear: boolean;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [groupSelections, setGroupSelections] = useState<Record<string, string>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, Group>();
    for (const s of students) {
      const key = s.classId ?? "none";
      if (!map.has(key)) {
        map.set(key, {
          key,
          className: s.className ?? "—",
          yearLabel: s.yearLabel,
          students: [],
        });
      }
      map.get(key)!.students.push(s);
    }
    return Array.from(map.values());
  }, [students]);

  async function handleReenroll(studentId: string) {
    const targetId = selections[studentId];
    if (!targetId) return;
    setLoadingKey(studentId);
    try {
      await reenrollStudent(studentId, targetId);
      toast.success(t("reenroll.reenrolled"));
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setLoadingKey(null);
    }
  }

  async function handleMarkInactive(studentId: string) {
    setLoadingKey(studentId);
    try {
      await markNotReenrolled(studentId);
      toast.success(t("reenroll.markedInactive"));
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setLoadingKey(null);
    }
  }

  async function handleReenrollGroup(sourceClassId: string) {
    const targetId = groupSelections[sourceClassId];
    if (!targetId) return;
    setLoadingKey(sourceClassId);
    try {
      await reenrollClass(sourceClassId, targetId);
      toast.success(t("reenroll.reenrolled"));
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setLoadingKey(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t("reenroll.title")}</h1>
        <p className="mt-1 text-sm text-foreground/60">{t("reenroll.subtitle")}</p>
      </div>

      {!hasCurrentYear ? (
        <div className="rounded-xl border border-border bg-surface px-5 py-16 text-center text-sm text-foreground/50">
          {t("reenroll.noCurrentYear")}
        </div>
      ) : targetClasses.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-5 py-16 text-center text-sm text-foreground/50">
          {t("reenroll.noTargetClasses")}
        </div>
      ) : students.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-5 py-16 text-center text-sm text-foreground/50">
          {t("reenroll.emptyList")}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div
              key={group.key}
              className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
            >
              <div className="flex flex-col gap-3 border-b border-border bg-surface-muted/60 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-foreground">
                  {t("reenroll.fromClass")} {group.className}
                  {group.yearLabel && (
                    <span className="ml-1.5 font-normal text-foreground/50">
                      ({group.yearLabel})
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <Select
                    value={groupSelections[group.key] || undefined}
                    onValueChange={(v) =>
                      setGroupSelections((prev) => ({ ...prev, [group.key]: v }))
                    }
                  >
                    <SelectTrigger className="h-8 w-48 text-xs">
                      <SelectValue placeholder={t("reenroll.selectClass")} />
                    </SelectTrigger>
                    <SelectContent>
                      {targetClasses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!groupSelections[group.key] || loadingKey === group.key}
                    onClick={() => handleReenrollGroup(group.key)}
                  >
                    {t("reenroll.reenrollAll")}
                  </Button>
                </div>
              </div>
              <div className="divide-y divide-border">
                {group.students.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {s.firstName} {s.lastName}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value={selections[s.id] || undefined}
                        onValueChange={(v) =>
                          setSelections((prev) => ({ ...prev, [s.id]: v }))
                        }
                      >
                        <SelectTrigger className="h-8 w-48 text-xs">
                          <SelectValue placeholder={t("reenroll.selectClass")} />
                        </SelectTrigger>
                        <SelectContent>
                          {targetClasses.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        disabled={!selections[s.id] || loadingKey === s.id}
                        onClick={() => handleReenroll(s.id)}
                      >
                        <ArrowRight className="h-4 w-4" />
                        {t("reenroll.reenroll")}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={loadingKey === s.id}
                        onClick={() => handleMarkInactive(s.id)}
                      >
                        {t("reenroll.markNotReenrolled")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
