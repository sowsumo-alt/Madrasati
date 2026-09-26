import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_OFFICIAL_HEADER,
  schoolPhoneLine,
  schoolPlaceLine,
  splitHeaderLines,
  toSchoolIdentity,
} from "../src/lib/official-header";

test("le bloc officiel livré est celui des bulletins mauritaniens, en français et en arabe", () => {
  assert.deepEqual(DEFAULT_OFFICIAL_HEADER.linesFr, [
    "République Islamique de Mauritanie",
    "Honneur — Fraternité — Justice",
    "Ministère de l'Éducation Nationale",
    "Direction de l'Enseignement Fondamental et Secondaire",
  ]);
  assert.deepEqual(DEFAULT_OFFICIAL_HEADER.linesAr, [
    "الجمهورية الإسلامية الموريتانية",
    "شرف - إخاء - عدالة",
    "وزارة التهذيب الوطني",
    "مديرية التعليم الأساسي والثانوي",
  ]);
});

test("une école qui n'a rien rempli garde un en-tête propre, sans ligne vide", () => {
  const school = toSchoolIdentity({ name: "École Ngalam Avenir", address: "  ", city: null, phone: "", logoUrl: "" });
  assert.equal(school.logoUrl, null);
  assert.equal(schoolPlaceLine(school), null);
  assert.equal(schoolPhoneLine(school), null);
  assert.equal(toSchoolIdentity(null).name, "Madrasati");
});

test("l'adresse et la ville forment une seule ligne, sans répéter la ville", () => {
  const base = { name: "Ets Amal Wa Saada", phone: "+22236123456", logoUrl: null };
  assert.equal(
    schoolPlaceLine(toSchoolIdentity({ ...base, address: "Tevragh Zeina", city: "Nouakchott" })),
    "Tevragh Zeina, Nouakchott",
  );
  assert.equal(
    schoolPlaceLine(toSchoolIdentity({ ...base, address: "Tevragh Zeina, Nouakchott", city: "Nouakchott" })),
    "Tevragh Zeina, Nouakchott",
  );
  assert.equal(schoolPlaceLine(toSchoolIdentity({ ...base, address: null, city: "Kiffa" })), "Kiffa");
  assert.equal(schoolPhoneLine(toSchoolIdentity({ ...base, address: null, city: null })), "+222 36 12 34 56");
});

test("le texte saisi par le Super Admin est découpé en lignes non vides", () => {
  assert.deepEqual(splitHeaderLines("  Ligne 1 \r\n\n Ligne 2\n"), ["Ligne 1", "Ligne 2"]);
});
