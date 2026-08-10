"use client";

import { useMemo, useState } from "react";
import { Search, Plus, Pencil, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ParentFormDialog,
  type ParentEditTarget,
  type ParentStudentOption,
} from "./parent-form-dialog";
import { buildWhatsAppUrl, buildTelUrl } from "@/lib/whatsapp";

export interface ParentRow {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  address: string | null;
  relationship: string | null;
  children: { id: string; name: string }[];
}

export function ParentsView({
  parents,
  students,
  schoolName,
}: {
  parents: ParentRow[];
  students: ParentStudentOption[];
  schoolName: string;
}) {
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ParentEditTarget | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return parents;
    return parents.filter(
      (p) =>
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
        p.children.some((c) => c.name.toLowerCase().includes(q)),
    );
  }, [parents, query]);

  function openCreate() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(p: ParentRow) {
    setEditTarget({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      phone: p.phone,
      email: p.email,
      address: p.address,
      relationship: p.relationship,
      studentIds: p.children.map((c) => c.id),
    });
    setFormOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Parents</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Gérez les parents et leurs enfants inscrits.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nouveau parent
        </Button>
      </div>

      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un parent ou un enfant…"
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        {filtered.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-foreground/50">
            {parents.length === 0
              ? "Aucun parent pour l'instant. Ajoutez le premier."
              : "Aucun parent ne correspond à votre recherche."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/60 text-left text-xs font-medium uppercase tracking-wide text-foreground/50">
                  <th className="px-5 py-3">Nom</th>
                  <th className="px-5 py-3">Téléphone</th>
                  <th className="px-5 py-3">Enfant(s)</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((p) => {
                  const waMessage = `Bonjour ${p.firstName}, ici ${schoolName}.`;
                  return (
                    <tr key={p.id} className="hover:bg-surface-muted/40">
                      <td className="px-5 py-3 font-medium text-foreground">
                        {p.firstName} {p.lastName}
                        {p.relationship && (
                          <span className="ml-1.5 text-xs font-normal text-foreground/40">
                            ({p.relationship})
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-foreground/70">{p.phone}</td>
                      <td className="px-5 py-3 text-foreground/70">
                        {p.children.length === 0 ? (
                          <span className="text-foreground/40">Aucun enfant lié</span>
                        ) : (
                          p.children.map((c) => c.name).join(", ")
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={buildWhatsAppUrl(p.phone, waMessage)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Contacter sur WhatsApp"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-primary-700 transition-colors hover:bg-primary-50"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </a>
                          <a
                            href={buildTelUrl(p.phone)}
                            title="Appeler"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface-muted"
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                          <button
                            onClick={() => openEdit(p)}
                            title="Modifier"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-surface-muted"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ParentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        students={students}
        editTarget={editTarget}
      />
    </div>
  );
}
