"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ChevronRight, Plus, Upload, Users } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { FamilyFilterBanner } from "@/components/family/family-filter-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AlphabetFilter, matchesLetter } from "@/components/ui/alphabet-filter";
import { useLanguage } from "@/lib/i18n/language-provider";
import { joinFullName } from "@/lib/student-form";
import {
  StudentFormDialog,
  type StudentClassOption,
  type StudentEditTarget,
} from "./student-form-dialog";
import { ImportDialog } from "./import-dialog";
import { moveStudentsToClass, setStudentStatus, setStudentsStatus } from "./actions";
import {
  StudentsToolbar,
  type ClassFilter,
  type StatusFilter,
} from "./students-list/students-toolbar";
import { StudentsTable } from "./students-list/students-table";
import { StudentsPagination } from "./students-list/students-pagination";
import { BulkActionsBar } from "./students-list/bulk-actions-bar";
import { BulkMoveDialog } from "./students-list/bulk-move-dialog";
import { StudentProfileSheet } from "./students-list/student-profile-sheet";

export interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  status: string;
  classId: string | null;
  className: string | null;
  photoUrl: string | null;
  placeOfBirth: string | null;
  nationality: string | null;
  motherName: string | null;
  enrollmentDate: string;
  parent: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    address: string | null;
    familyName: string | null;
    /** Enfants rattachés à ce parent : sa famille, à partir de deux. */
    familySize: number;
  } | null;
}

// Dix lignes par page : la liste tient sur un écran d'ordinateur portable
// sans défiler, et reste lisible sur un téléphone.
const PAGE_SIZE = 10;

function toEditTarget(s: StudentRow): StudentEditTarget {
  return {
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    dateOfBirth: s.dateOfBirth ? s.dateOfBirth.slice(0, 10) : null,
    gender: s.gender,
    classId: s.classId,
    status: s.status,
    photoUrl: s.photoUrl,
    placeOfBirth: s.placeOfBirth,
    nationality: s.nationality,
    motherName: s.motherName,
    enrollmentDate: s.enrollmentDate.slice(0, 10),
    parentName: s.parent ? joinFullName(s.parent.firstName, s.parent.lastName) : "",
    parentPhone: s.parent?.phone ?? "",
    parentAddress: s.parent?.address ?? "",
  };
}

export function StudentsView({
  students,
  classes,
  schoolName,
  currentYearLabel,
  initialQuery = "",
  initialClassFilter = "ALL",
  initialFamilyFilter = null,
  autoOpenNew = false,
}: {
  students: StudentRow[];
  classes: StudentClassOption[];
  schoolName: string;
  currentYearLabel: string | null;
  /** Terme envoyé par la recherche globale de l'en-tête (?q=…). */
  initialQuery?: string;
  /** Classe présélectionnée (?classe=…), depuis la page Classes. */
  initialClassFilter?: ClassFilter;
  /** Famille présélectionnée (?famille=<parentId>). */
  initialFamilyFilter?: string | null;
  /** Ouvre directement le formulaire d'inscription (?new=1), depuis le menu "Inscription". */
  autoOpenNew?: boolean;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const [query, setQuery] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [classFilter, setClassFilter] = useState<ClassFilter>(initialClassFilter);
  const [letter, setLetter] = useState<string | null>(null);
  const [familyFilter, setFamilyFilter] = useState<string | null>(initialFamilyFilter);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StudentEditTarget | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<StudentRow | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkRemoveOpen, setBulkRemoveOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    if (autoOpenNew) {
      setEditTarget(null);
      setFormOpen(true);
      router.replace("/directeur/eleves");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenNew]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      const matchesQuery =
        !q ||
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        (s.className ?? "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || s.status === statusFilter;
      const matchesClass =
        classFilter === "ALL" ||
        (classFilter === "NONE" ? s.className == null : s.classId === classFilter);
      const matchesInitial = matchesLetter(`${s.firstName} ${s.lastName}`, letter);
      const matchesFamily = !familyFilter || s.parent?.id === familyFilter;
      return matchesQuery && matchesStatus && matchesClass && matchesInitial && matchesFamily;
    });
  }, [students, query, statusFilter, classFilter, letter, familyFilter]);

  const familyParent = familyFilter
    ? (students.find((s) => s.parent?.id === familyFilter)?.parent ?? null)
    : null;

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Seuls les élèves actifs comptent : un élève transféré ou diplômé n'a pas
  // vocation à porter une classe, le signaler serait un faux positif.
  const unassignedCount = useMemo(
    () => students.filter((s) => s.className == null && s.status === "ACTIVE").length,
    [students],
  );

  // Une sélection ne garde que les élèves encore présents dans la liste.
  const selectedIds = useMemo(
    () => students.filter((s) => selected.has(s.id)).map((s) => s.id),
    [students, selected],
  );
  const profile = students.find((s) => s.id === profileId) ?? null;

  /** Tout changement de filtre ramène à la première page. */
  function onFilter<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  function openCreate() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(s: StudentRow) {
    setProfileId(null);
    setEditTarget(toEditTarget(s));
    setFormOpen(true);
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const row of pageRows) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  }

  async function handleConfirmToggle() {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    try {
      const nextStatus = confirmTarget.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await setStudentStatus(confirmTarget.id, nextStatus);
      toast.success(
        nextStatus === "INACTIVE" ? t("students.removed") : t("students.reactivated"),
      );
      setConfirmTarget(null);
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setConfirmLoading(false);
    }
  }

  async function handleBulkMove(classId: string) {
    setBulkLoading(true);
    try {
      const count = await moveStudentsToClass(selectedIds, classId);
      toast.success(t("students.bulkMovedSuccess").replace("{count}", String(count)));
      setSelected(new Set());
      setBulkMoveOpen(false);
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkRemove() {
    setBulkLoading(true);
    try {
      const count = await setStudentsStatus(selectedIds, "INACTIVE");
      toast.success(t("students.bulkRemovedSuccess").replace("{count}", String(count)));
      setSelected(new Set());
      setBulkRemoveOpen(false);
      router.refresh();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <nav
            aria-label={t("nav.category.schooling")}
            className="mb-1.5 flex items-center gap-1.5 text-xs text-foreground/50"
          >
            <span>{t("nav.category.schooling")}</span>
            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            <span className="font-medium text-foreground/70">{t("students.title")}</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("students.title")}
          </h1>
          <p className="mt-1 text-sm text-foreground/60">{t("students.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="h-11 px-4" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" />
            {t("students.importExcel")}
          </Button>
          {/* Parcours à part, pour plusieurs enfants d'une même famille :
              « Nouvel élève » garde exactement le formulaire d'un seul enfant. */}
          <Link
            href="/directeur/familles/inscription"
            title={t("family.enrollButtonHint")}
            className={buttonVariants({ variant: "secondary", className: "h-11 px-4" })}
          >
            <Users className="h-4 w-4" />
            {t("family.enrollButton")}
          </Link>
          <Button className="h-11 px-5 shadow-sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t("students.new")}
          </Button>
        </div>
      </div>

      {familyFilter && familyParent && (
        <FamilyFilterBanner
          parentId={familyFilter}
          parent={familyParent}
          clearLabelKey="family.clearStudents"
          onClear={() => {
            setFamilyFilter(null);
            setPage(1);
          }}
        />
      )}

      <StudentsToolbar
        query={query}
        onQueryChange={onFilter(setQuery)}
        classFilter={classFilter}
        onClassFilterChange={onFilter(setClassFilter)}
        statusFilter={statusFilter}
        onStatusFilterChange={onFilter(setStatusFilter)}
        classes={classes}
      />

      {/* Accès direct par initiale : sur une école de plusieurs centaines
          d'élèves, faire défiler la liste ou taper un nom complet est le geste
          le plus fréquent de la journée. Les lettres sans élève sont grisées,
          pour ne jamais mener à une liste vide. */}
      <AlphabetFilter
        names={students.map((s) => `${s.firstName} ${s.lastName}`)}
        value={letter}
        onChange={onFilter(setLetter)}
      />

      {/* Explique l'écart entre cette liste et les compteurs des autres écrans :
          les élèves sans classe n'apparaissent ni à l'appel, ni sur un bulletin,
          ni dans la répartition par niveau. */}
      {unassignedCount > 0 && (
        <button
          type="button"
          onClick={() => {
            setStatusFilter("ALL");
            setQuery("");
            setClassFilter((current) => (current === "NONE" ? "ALL" : "NONE"));
            setPage(1);
          }}
          className={`flex w-full items-center gap-2.5 rounded-xl border px-4 py-3 text-start text-sm transition-colors ${
            classFilter === "NONE"
              ? "border-amber-400 bg-amber-100"
              : "border-amber-200 bg-amber-50 hover:bg-amber-100"
          }`}
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="text-amber-900">
            <span className="font-medium">
              {unassignedCount} élève{unassignedCount > 1 ? "s" : ""} sans classe assignée
            </span>
            <span className="ms-1 text-amber-800/80">
              — {classFilter === "NONE" ? "cliquez pour revoir toute la liste" : "ils sont exclus de l'appel, des bulletins et des statistiques par niveau"}
            </span>
          </span>
        </button>
      )}

      <section className="overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-soft">
        {selectedIds.length > 0 && (
          <BulkActionsBar
            count={selectedIds.length}
            onMove={() => setBulkMoveOpen(true)}
            onRemove={() => setBulkRemoveOpen(true)}
            onClear={() => setSelected(new Set())}
          />
        )}
        {filtered.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-foreground/50">
            {students.length === 0 ? t("students.emptyList") : t("students.noMatch")}
          </div>
        ) : (
          <>
            <StudentsTable
              rows={pageRows}
              selected={selected}
              onToggleRow={toggleRow}
              onTogglePage={togglePage}
              onView={(s) => setProfileId(s.id)}
              onEdit={openEdit}
              onToggleStatus={setConfirmTarget}
              onFamily={(parentId) => {
                setFamilyFilter(parentId);
                setPage(1);
              }}
              schoolName={schoolName}
            />
            <StudentsPagination
              page={currentPage}
              pageCount={pageCount}
              total={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </section>

      <StudentProfileSheet
        student={profile}
        currentYearLabel={currentYearLabel}
        schoolName={schoolName}
        onClose={() => setProfileId(null)}
        onEdit={openEdit}
      />
      <StudentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        classes={classes}
        editTarget={editTarget}
        currentYearLabel={currentYearLabel}
      />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <ConfirmDialog
        open={Boolean(confirmTarget)}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title={
          confirmTarget?.status === "ACTIVE"
            ? t("students.deleteConfirm")
            : t("students.reactivateConfirm")
        }
        description={
          confirmTarget?.status === "ACTIVE"
            ? t("students.deleteConfirmBody")
            : t("students.reactivateBody")
        }
        confirmLabel={
          confirmTarget?.status === "ACTIVE" ? t("students.remove") : t("students.reactivate")
        }
        variant={confirmTarget?.status === "ACTIVE" ? "danger" : "primary"}
        loading={confirmLoading}
        onConfirm={handleConfirmToggle}
      />
      <BulkMoveDialog
        open={bulkMoveOpen}
        onOpenChange={setBulkMoveOpen}
        count={selectedIds.length}
        classes={classes}
        loading={bulkLoading}
        onConfirm={handleBulkMove}
      />
      <ConfirmDialog
        open={bulkRemoveOpen}
        onOpenChange={setBulkRemoveOpen}
        title={t("students.bulkRemoveConfirm").replace("{count}", String(selectedIds.length))}
        description={t("students.deleteConfirmBody")}
        confirmLabel={t("students.remove")}
        variant="danger"
        loading={bulkLoading}
        onConfirm={handleBulkRemove}
      />
    </div>
  );
}
