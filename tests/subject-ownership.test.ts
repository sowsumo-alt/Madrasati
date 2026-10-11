import { test } from "node:test";
import assert from "node:assert/strict";

import { teachesSubject } from "../src/lib/subject-ownership";

// 1AS : prof « maths » en Maths, prof « arabe » en Arabe ; « principal » est le professeur principal.
const maths = { teacherId: "maths" };
const arabe = { teacherId: "arabe" };
const sansProf = { teacherId: null };

test("chaque enseignant n'a que ses matières, même le professeur principal", () => {
  assert.equal(teachesSubject("maths", maths, "principal"), true);
  assert.equal(teachesSubject("arabe", maths, "principal"), false);
  // Le professeur principal ne voit pas les notes de mathématiques de son collègue.
  assert.equal(teachesSubject("principal", maths, "principal"), false);
  // Il garde la matière qu'il enseigne lui-même.
  assert.equal(teachesSubject("principal", { teacherId: "principal" }, "principal"), true);
});

test("une matière confiée à personne reste au professeur principal (primaire)", () => {
  assert.equal(teachesSubject("principal", sansProf, "principal"), true);
  assert.equal(teachesSubject("arabe", sansProf, "principal"), false);
  assert.equal(teachesSubject("principal", undefined, "principal"), true);
  assert.equal(teachesSubject("arabe", arabe, null), true);
  assert.equal(teachesSubject("", sansProf, null), false);
});
