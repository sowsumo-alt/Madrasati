# Rapport d'audit — Madrasati

Date : 12 août 2026
Portée : audit fonctionnel, sécurité, responsive/accessibilité et qualité de code sur l'ensemble de l'application, suivi de la correction des problèmes réels trouvés.

## Méthode

Il n'existe pas de suite de tests automatisés dans ce projet (aucun framework de test installé). L'audit s'est donc appuyé sur :

- **Revue de code exhaustive en trois passes indépendantes** : isolation multi-écoles et contrôle des rôles ; logique métier et calculs (moyennes, finance, présences) ; qualité de code, accessibilité et responsive/RTL. Chaque fichier `actions.ts`, `page.tsx` et `schema.ts` du projet a été lu.
- **Vérification statique** : `tsc --noEmit` (TypeScript strict), `eslint` (config `next/core-web-vitals` + `next/typescript`), `next build` (build de production complet).
- **Tests fonctionnels en conditions réelles** : build de production démarré (`next start`), connexion effective avec les 3 comptes de démonstration (directeur, enseignant, parent), requêtes HTTP authentifiées sur toutes les routes principales de chaque portail, et vérification explicite qu'un enseignant/parent qui tente d'ouvrir une URL réservée à un autre rôle est bien redirigé (307) sans jamais recevoir le contenu.

**Limite honnête** : je n'ai pas de navigateur pour observer visuellement le rendu (mise en page réelle sur téléphone, contraste des couleurs, comportement sous 3G réelle, lecteur d'écran en fonctionnement). Les points responsive/accessibilité ci-dessous sont vérifiés au niveau du code (classes Tailwind, attributs ARIA, structure HTML) et sont donc fiables sur ce qu'ils couvrent, mais un passage visuel humain (téléphone réel, Chrome DevTools en throttling 3G, VoiceOver/NVDA) reste recommandé avant un lancement à grande échelle.

---

## Problèmes trouvés et corrigés

### Sécurité — isolation entre écoles (critique)

L'application est multi-écoles : chaque requête doit être filtrée par `schoolId`. Plusieurs actions acceptaient un identifiant (élève, classe, enseignant) envoyé par le navigateur sans vérifier qu'il appartenait bien à l'école de la personne connectée. Un directeur malveillant aurait pu, en modifiant un identifiant dans une requête réseau, faire fuiter le nom/classe/téléphone d'un élève ou d'un enseignant d'une **autre** école, voire rattacher un parent à l'enfant d'un tiers.

Corrigé dans :
- `src/app/directeur/finance/actions.ts` (`createFee`) — l'élève est maintenant vérifié avant création d'un frais.
- `src/app/directeur/reinscription/actions.ts` (`reenrollStudent`) — la réinscription échoue proprement si l'élève n'appartient pas à l'école.
- `src/app/directeur/parents/actions.ts` (`syncStudentLinks`) — les identifiants d'élèves hors école sont désormais ignorés lors du rattachement à un parent.
- `src/app/directeur/discipline/actions.ts` (`createIncident`) — élève vérifié avant enregistrement d'un incident.
- `src/app/directeur/eleves/actions.ts` (`createStudent`, `updateStudent`) — la classe assignée est vérifiée.
- `src/app/directeur/classes/actions.ts` (`createClass`, `updateClass`, `assignSubjectToClass`) — enseignant principal, matière et enseignant assigné sont vérifiés.
- `src/app/parent/page.tsx` — filtre `schoolId` ajouté en défense en profondeur sur les requêtes présences/frais/emploi du temps, en plus des vérifications en amont.

### Finance — course critique sur le statut des paiements (critique)

`recordPayment` lisait le total déjà payé **avant** d'écrire le nouveau paiement, hors transaction. Deux paiements enregistrés au même instant pouvaient tous les deux conclure « statut partiel » alors que le frais était en réalité soldé. Le numéro de reçu était par ailleurs recalculé par une logique dupliquée (au lieu du helper dédié `generateReceiptNumber`), sans filtrage par année malgré le préfixe `REC-2026-...`, et sans protection réelle contre une collision.

Corrigé : `recordPayment` (`src/app/directeur/finance/actions.ts`) enveloppe maintenant la création du paiement et le recalcul du statut dans une transaction Postgres en isolation *Serializable*, avec relance automatique (jusqu'à 5 tentatives) en cas de collision de numéro de reçu. `generateReceiptNumber` (`src/lib/receipts.ts`) filtre désormais par année civile, comme son préfixe l'annonce.

### Bulletins et tableau de bord — incohérences de calcul (majeur)

- Le nombre de présences/absences affiché sur un bulletin comptait **tout l'historique de l'année**, identique quel que soit le trimestre choisi. `src/lib/report-card.ts` gagne une fonction `termDateRange()` qui découpe l'année scolaire en trois tiers ; `src/lib/report-card-data.ts` filtre désormais les présences sur la période réelle du trimestre.
- Le classement « Meilleures moyennes » du tableau de bord directeur ignorait les coefficients des matières (moyenne brute de toutes les notes), pouvant classer différemment un élève par rapport à son propre bulletin (qui, lui, pondère par coefficient). `src/app/directeur/page.tsx` calcule maintenant une moyenne par matière puis pondérée par coefficient, identique à la méthode des bulletins.

### Corrections mineures

- Numéro de téléphone : un numéro mauritanien saisi sans l'indicatif (8 chiffres) est désormais normalisé automatiquement avec le `222`, pour que les liens WhatsApp générés (wa.me) pointent vers le bon pays (`src/lib/phone.ts`, appliqué aux formulaires Parent, Enseignant, Élève).
- Le montant inséré dans le message WhatsApp de relance de paiement n'était pas formaté (`"125000"` au lieu de `"125 000"`) — corrigé via `formatAmount()` (`src/lib/format.ts`).
- Le lien « voir le reçu » de la liste Finance pouvait pointer vers un reçu qui n'était pas le plus récent faute de tri explicite — `orderBy: paidAt` ajouté.
- Une date de la page Présences était formatée par une logique locale dupliquée au lieu de la fonction centralisée `formatLongDate`.
- Le taux de présence affiché différait selon qu'on le consultait depuis le portail parent (30 derniers enregistrements) ou la page Présences du directeur (historique complet) — les deux utilisent maintenant la même méthode.
- Mot de passe temporaire (comptes créés par le directeur) généré avec `Math.random()` — remplacé par `crypto.randomInt` (générateur cryptographique), isolé dans `src/lib/account-server.ts` pour ne jamais être empaqueté côté navigateur.

### Accessibilité et RTL

- Le bouton de fermeture (×) de toutes les fenêtres modales de l'application n'avait pas de nom accessible pour les lecteurs d'écran — `aria-label="Fermer"` ajouté une fois dans `src/components/ui/dialog.tsx` (corrige toutes les modales d'un coup).
- 14 paires `<Label>`/`<Select>` non reliées (l'utilisateur au clavier/lecteur d'écran n'entendait que « Sélectionner… » sans savoir à quel champ ça correspondait) réparées dans 12 formulaires (élèves, enseignants, parents, examens, finance, classes, emploi du temps, discipline, présences, bulletins, réinscription).
- Menus d'actions (icône ⋮) des listes Élèves et Enseignants sans texte accessible — `aria-label` ajouté.
- Bouton de suppression d'un incident disciplinaire annonçait « Actions » au lieu de « Retirer » (mauvaise clé de traduction) — corrigé.
- Deux classes Tailwind physiques (`pr-10`, utilisée par l'icône du champ date ; `right-1.5`, utilisée par le bouton de suppression d'un cours enseignant) manquaient à la liste des classes inversées en arabe (RTL) dans `src/app/globals.css` — ajoutées.
- Grilles à 3 colonnes fixes (comptes de démonstration sur la page de connexion) resserrées/rendues responsives pour les très petits écrans.

### Bug de compilation introduit puis corrigé pendant l'audit

En durcissant la génération du mot de passe temporaire avec `crypto.randomInt` (module Node natif), le build de production a échoué : ce module ne peut pas être empaqueté pour le navigateur, et le fichier qui le contenait (`src/lib/account.ts`) était partiellement importé par un composant client (`mon-compte/password-form.tsx`). Isolé dans un nouveau fichier `src/lib/account-server.ts`, jamais importé côté client — build de production revérifié, propre.

---

## Vérifié et confirmé correct (rien à corriger)

- Contrôle de rôle (`requireRole`/`requireUser`) présent sur toutes les server actions du projet.
- Filtrage par `schoolId` correct sur la quasi-totalité des requêtes Prisma (hors les exceptions listées ci-dessus, maintenant corrigées).
- Périmètre enseignant (`getTeacherScope`/`assertClassAccess`) : un enseignant ne peut jamais agir sur les classes d'un collègue, y compris pour la fonctionnalité récente de créneaux auto-gérés.
- Aucune requête SQL brute (`$queryRaw`/`$executeRaw`) dans tout le dépôt ; toutes les entrées passent par un schéma zod avant Prisma.
- Aucun secret en dur dans le code source.
- Moyenne pondérée des bulletins, normalisation des notes sur des barèmes différents, exclusion des absents, calcul du rang (gestion des ex-aequo) : tous corrects.
- `saveAttendance` utilise un `upsert` cohérent avec la contrainte unique `(studentId, date)` — pas de plantage en re-saisissant l'appel du même jour.
- La transaction de réinscription (changement de classe + frais + paiement) est atomique : tout échoue ensemble si une étape échoue.
- `fillTemplate()` (messages WhatsApp) ne laisse jamais de `{placeholder}` littéral affiché si une donnée est manquante.
- ESLint : aucune erreur ni avertissement sur l'ensemble du projet ; aucun `console.log` de debug oublié, aucun `TODO`/`FIXME`, aucun `any` explicite.
- Tous les tableaux principaux sont enveloppés dans un conteneur `overflow-x-auto` (pas de casse de mise en page mobile).
- Toutes les images (photos d'élèves, logo d'école) ont un attribut `alt`.

---

## Limitations connues, assumées sans correctif

- **`ClassSubject.coefficientOverride`** (coefficient spécifique à une classe, distinct du coefficient par défaut de la matière) existe dans le schéma de base de données et est correctement pris en compte par le calcul des moyennes, mais **aucun écran ne permet de le renseigner** — il reste donc toujours vide en pratique. Fonctionnalité prévue par la base mais jamais câblée côté interface ; à construire si le besoin se présente (un champ optionnel dans le formulaire d'assignation matière/classe).
- **Pas de limitation de tentatives de connexion** (throttling) sur le formulaire de connexion. Risque modéré (il faut déjà connaître un email valide), mais à ajouter avant un usage à grande échelle — nécessite un service externe (ex. Upstash Redis) car les fonctions serverless de Vercel ne conservent pas d'état entre les appels ; une solution « maison » en mémoire serait inefficace en production et n'a donc pas été ajoutée pour ne pas donner une fausse impression de protection.
- **Test réel sur téléphone / 3G / lecteur d'écran** : non réalisé (pas d'accès navigateur). Le code respecte les bonnes pratiques standard (responsive Tailwind, ARIA, Radix UI pour les composants interactifs), mais un passage humain reste recommandé avant un lancement à grande échelle.
- **Découpage des trimestres** : en l'absence de dates de trimestre configurables dans le modèle `AcademicYear` (seuls le début et la fin de l'année scolaire sont stockés), le trimestre est approximé en divisant l'année en trois tiers égaux. Correct dans la plupart des cas mais peut légèrement décaler les présences comptées si les trimestres réels d'une école ne sont pas de durée égale.

---

## Vérification finale

- `npx tsc --noEmit` : aucune erreur.
- `npx eslint src` : aucune erreur, aucun avertissement.
- `npm run build` : build de production réussi (31 pages générées).
- Connexion et navigation testées de bout en bout pour les 3 rôles (directeur, enseignant, parent) contre le build de production, y compris la vérification explicite qu'aucun rôle ne peut atteindre le contenu réservé à un autre rôle.
