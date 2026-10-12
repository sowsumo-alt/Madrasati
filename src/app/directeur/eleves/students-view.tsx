"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ChevronRight, Plus, Upload, Users } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { FamilyFilterBanner } from "@/components/family/family-filter-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AlphabetFilter } from "@/components/ui/alphabet-filter";
import { STUDENTS_PAGE_SIZE, studentsParamsOf, type StudentsListState } from "@/lib/students-query";
import { useSearchParamInput } from "@/lib/use-search-param-input";
import { useLanguage } from "@/lib/i18n/language-provider";
import { joinFullName } from "@/lib/student-form";
import type { StudentClassOption, StudentEditTarget } from "./student-form-dialog";
import { useOpenedOnce } from "@/lib/use-opened-once";
import { RemovalDialog } from "@/app/directeur/familles/removal-dialog";
import type { CatalogGroup } from "@/lib/class-catalog";
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
import type { TuitionSettings, StudentMoney, TuitionSummary } from "@/lib/tuition-data";

// Fenêtres chargées au premier clic (next/dynamic) : leur code n'est pas
// téléchargé avec la page — plus léger en 3G. Voir useOpenedOnce.
const StudentFormDialog = dynamic(() => import("./student-form-dialog").then((m) => m.StudentFormDialog), { ssr: false });
const ImportDialog = dynamic(() => import("./import-dialog").then((m) => m.ImportDialog), { ssr: false });
const StudentProfileSheet = dynamic(
  () => import("./students-list/student-profile-sheet").then((m) => m.StudentProfileSheet),
  { ssr: false },
);
const TuitionPlanDialog = dynamic(
  () => import("@/components/finance/tuition-plan-dialog").then((m) => m.TuitionPlanDialog),
  { ssr: false },
);

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
  nni: string | null;
  rimNumber: string | null;
  /** « 2026-0042 » : donné à l'inscription, modifiable. */
  matricule: string | null;
  motherName: string | null;
  /** Formule de paiement des frais de scolarité ; null si aucune. */
  tuition: TuitionSummary | null;
  /** Sa part : facturé, versé, dû à ce jour — ou « inclus dans la fiche familiale ». */
  money: StudentMoney | null;
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

// Dix lignes par page (STUDENTS_PAGE_SIZE) : la liste tient sur un écran
// d'ordinateur portable sans défiler, et reste lisible sur un téléphone.
const PAGE_SIZE = STUDENTS_PAGE_SIZE;

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
    nni: s.nni,
    rimNumber: s.rimNumber,
    matricule: s.matricule,
    motherName: s.motherName,
    enrollmentDate: s.enrollmentDate.slice(0, 10),
    parentName: s.parent ? joinFullName(s.parent.firstName, s.parent.lastName) : "",
    parentPhone: s.parent?.phone ?? "",
    parentAddress: s.parent?.address ?? "",
  };
}

export function StudentsView({
  state,
  students,
  total,
  pageCount,
  hasStudents,
  letters,
  unassignedCount,
  familyParent,
  classes,
  schoolName,
  currentYearLabel,
  catalog,
  tuitionSettings,
  draftKey,
  autoOpenNew = false,
}: {
  /** Recherche, filtres et page lus dans l'adresse (voir lib/students-query). */
  state: StudentsListState;
  /** Les élèves de la page affichée seulement. */
  students: StudentRow[];
  /** Élèves correspondant aux filtres, toutes pages confondues. */
  total: number;
  pageCount: number;
  hasStudents: boolean;
  /** Lettres du filtre A-Z qui ont au moins un élève. */
  letters: string[];
  /** Élèves actifs sans classe, dans toute l'école. */
  unassignedCount: number;
  /** Parent de la famille filtrée (?famille=…), pour le bandeau. */
  familyParent: StudentRow["parent"];
  classes: StudentClassOption[];
  /** Catégories et niveaux, pour créer une classe depuis l'import. */
  catalog: CatalogGroup[];
  /** Frais de scolarité d'un mois de l'école, proposés à l'inscription. */
  tuitionSettings: TuitionSettings;
  /** Clé du brouillon d'inscription, propre à l'école. */
  draftKey: string;
  schoolName: string;
  currentYearLabel: string | null;
  /** Ouvre directement le formulaire d'inscription (?new=1), depuis le menu "Inscription". */
  autoOpenNew?: boolean;
}) {
  const router = useRouter();
  const { t } = useLanguage();
  const [isNavigating, startNavigation] = useTransition();
  /** Nouvel état de la liste : l'adresse change, le serveur renvoie la page. */
  function navigate(next: StudentsListState) {
    const qs = studentsParamsOf(next);
    startNavigation(() => router.replace(`/directeur/eleves${qs ? `?${qs}` : ""}`, { scroll: false }));
  }
  // Recherche tapée ici (y compris celle de l'en-tête, ?q=…), envoyée après une pause.
  const [query, setQuery] = useSearchParamInput(state.query, (q) => navigate({ ...state, query: q, page: 1 }));
  const statusFilter: StatusFilter = state.status;
  const classFilter: ClassFilter = state.classFilter;
  const letter = state.letter;
  const familyFilter = familyParent ? state.family : null;
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [tuitionFor, setTuitionFor] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<StudentEditTarget | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<StudentRow | null>(null);
  const [removeTarget, setRemoveTarget] = useState<StudentRow | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkRemoveOpen, setBulkRemoveOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const formLoaded = useOpenedOnce(formOpen);
  const importLoaded = useOpenedOnce(importOpen);
  const profileLoaded = useOpenedOnce(profileId != null);
  const tuitionLoaded = useOpenedOnce(tuitionFor != null);

  useEffect(() => {
    if (autoOpenNew) {
      setEditTarget(null);
      setFormOpen(true);
      router.replace("/directeur/eleves");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenNew]);

  const currentPage = state.page;
  const pageRows = students;
  // Sélection gardée d'une page à l'autre (identifiants seulement).
  const selectedIds = [...selected];
  const profile = students.find((s) => s.id === profileId) ?? null;

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
          onClear={() => navigate({ ...state, query, family: null, page: 1 })}
        />
      )}

      <StudentsToolbar
        query={query}
        onQueryChange={setQuery}
        classFilter={classFilter}
        onClassFilterChange={(value) => navigate({ ...state, query, classFilter: value, page: 1 })}
        statusFilter={statusFilter}
        onStatusFilterChange={(value) => navigate({ ...state, query, status: value, page: 1 })}
        classes={classes}
      />

      {/* Accès direct par initiale : sur une école de plusieurs centaines
          d'élèves, faire défiler la liste ou taper un nom complet est le geste
          le plus fréquent de la journée. Les lettres sans élève sont grisées,
          pour ne jamais mener à une liste vide. */}
      <AlphabetFilter
        names={letters}
        value={letter}
        onChange={(value) => navigate({ ...state, query, letter: value, page: 1 })}
      />

      {/* Explique l'écart entre cette liste et les compteurs des autres écrans :
          les élèves sans classe n'apparaissent ni à l'appel, ni sur un bulletin,
          ni dans la répartition par niveau. */}
      {unassignedCount > 0 && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            navigate({ ...state, status: "ALL", query: "", classFilter: classFilter === "NONE" ? "ALL" : "NONE", page: 1 });
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

      <section
        className={`overflow-hidden rounded-2xl border border-border/80 bg-surface shadow-soft transition-opacity ${isNavigating ? "opacity-60" : ""}`}
        aria-busy={isNavigating}
      >
        {selectedIds.length > 0 && (
          <BulkActionsBar
            count={selectedIds.length}
            onMove={() => setBulkMoveOpen(true)}
            onRemove={() => setBulkRemoveOpen(true)}
            onClear={() => setSelected(new Set())}
          />
        )}
        {students.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-foreground/50">
            {!hasStudents ? t("students.emptyList") : t("students.noMatch")}
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
              onRemove={setRemoveTarget}
              onFamily={(parentId) => navigate({ ...state, query, family: parentId, page: 1 })}
              schoolName={schoolName}
            />
            <StudentsPagination
              page={currentPage}
              pageCount={pageCount}
              total={total}
              pageSize={PAGE_SIZE}
              onPageChange={(page) => navigate({ ...state, query, page })}
            />
          </>
        )}
      </section>

      {profileLoaded && (
      <StudentProfileSheet
        student={profile}
        currentYearLabel={currentYearLabel}
        schoolName={schoolName}
        onClose={() => setProfileId(null)}
        onEdit={openEdit}
        onTuition={(student) => setTuitionFor(student.id)}
      />
      )}
      {tuitionLoaded && (
        <TuitionPlanDialog studentId={tuitionFor} onOpenChange={(open) => !open && setTuitionFor(null)} />
      )}
      {formLoaded && (
      <StudentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        classes={classes}
        editTarget={editTarget}
        currentYearLabel={currentYearLabel}
        tuitionSettings={tuitionSettings}
        draftKey={draftKey}
      />
      )}
      {importLoaded && (
        <ImportDialog open={importOpen} onOpenChange={setImportOpen} classes={classes} catalog={catalog} />
      )}
      {removeTarget && (
        <RemovalDialog
          kind="student"
          initialMode="DELETE"
          id={removeTarget.id}
          open
          onOpenChange={(open) => !open && setRemoveTarget(null)}
          onDone={() => {
            setRemoveTarget(null);
            setSelected((prev) => {
              const next = new Set(prev);
              next.delete(removeTarget.id);
              return next;
            });
            router.refresh();
          }}
        />
      )}
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
