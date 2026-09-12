# Madrasati

Plateforme de gestion scolaire pour les écoles privées en Mauritanie — élèves, enseignants, parents, classes, emploi du temps, présences, examens/notes, bulletins bilingues (français/arabe), finance, communication WhatsApp et statistiques, réunis dans une seule application.

## Stack technique

- **Next.js 15** (App Router, Server Components) / **TypeScript**
- **Prisma** + **PostgreSQL** (hébergé sur [Neon](https://neon.tech))
- **next-auth** (session JWT), connexion par email et mot de passe
- **Tailwind CSS v4**, composants accessibles via **Radix UI**
- **Google AI Studio (Gemini)** pour la génération assistée des appréciations de bulletin
- i18n maison (français / anglais / arabe, RTL complet pour l'arabe)

## Démarrage local

1. Copier `.env.example` en `.env` et renseigner les valeurs (voir ci-dessous).
2. Installer les dépendances :
   ```bash
   npm install
   ```
3. Appliquer les migrations Prisma sur la base :
   ```bash
   npx prisma migrate deploy
   ```
4. (Optionnel) Charger des données de démonstration :
   ```bash
   npm run db:seed
   ```
5. Lancer le serveur de développement :
   ```bash
   npm run dev
   ```
   L'application est disponible sur [http://localhost:3000](http://localhost:3000).

### Comptes de démonstration (après `npm run db:seed`)

| Rôle | Email | Mot de passe |
|---|---|---|
| Directeur | `directeur@ecole-demo.mr` | `Madrasati2026!` |
| Enseignant | `enseignant@ecole-demo.mr` | `Madrasati2026!` |
| Parent | `parent@ecole-demo.mr` | `Madrasati2026!` |

### Variables d'environnement

| Variable | Description |
|---|---|
| `DATABASE_URL` | Connexion Postgres via le pooler Neon (hôte en `-pooler`, avec `?sslmode=require&pgbouncer=true`) — utilisée par l'application |
| `DIRECT_URL` | Connexion Postgres directe (même base, hôte sans `-pooler`) — utilisée uniquement par les migrations Prisma |
| `NEXTAUTH_SECRET` | Clé secrète de signature des sessions next-auth |
| `NEXTAUTH_URL` | URL publique de l'application (`http://localhost:3000` en local, l'URL Vercel en production) |
| `GEMINI_API_KEY` | Clé Google AI Studio pour la génération d'appréciations de bulletin |

Les deux adresses se copient depuis le tableau de bord Neon (**Connect** → *Connection string*), en cochant *Connection pooling* pour la première et en la décochant pour la seconde.

### Scripts disponibles

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run start` | Démarre le build de production (nécessite `npm run build` au préalable) |
| `npm run lint` | ESLint |
| `npm run db:seed` | Charge une école de démonstration avec données d'exemple |
| `npm run db:studio` | Ouvre Prisma Studio (explorateur de base de données) |

## Architecture

```
src/
  app/
    (marketing)/        page de présentation publique
    login/               connexion (identifiants + Google)
    inscription/          création d'une nouvelle école (self-service)
    directeur/            portail Directeur — un dossier par module
      eleves/              schema.ts (zod) + actions.ts (server actions)
      finance/             + page.tsx (Server Component, fetch Prisma)
      ...                  + xxx-view.tsx (Client Component, UI)
                           + xxx-dialog.tsx (formulaires modaux)
    enseignant/          portail Enseignant (périmètre limité à ses classes)
    parent/              portail Parent (périmètre limité à ses enfants)
  components/
    ui/                  primitives réutilisables (Button, Dialog, Select, Card...)
    layout/              structure de page (AppShell, menu latéral par catégories)
    charts/              graphiques (courbe, anneau) en SVG pur, sans librairie lourde
  lib/                   logique partagée : Prisma, auth, i18n, calculs de bulletin,
                          formatage (devise/dates), WhatsApp, téléphone, comptes
prisma/
  schema.prisma          modèle de données (multi-écoles : chaque table métier
                          porte un schoolId)
  migrations/             historique des migrations
  seed.ts                 données de démonstration
```

**Multi-tenant** : chaque école (`School`) est isolée par un `schoolId` porté par toutes les tables métier. Chaque requête serveur passe par `requireRole()`/`requireUser()` (`src/lib/session.ts`) puis filtre explicitement par `schoolId`. Un enseignant est en plus limité à ses propres classes (`src/lib/teacher-scope.ts`), un parent à ses propres enfants.

**Bulletins bilingues** : le nom des matières et le champ « Appréciation » s'impriment toujours en français ET en arabe côte à côte sur le bulletin, indépendamment de la langue choisie dans l'interface — c'est un choix de design fixe, pas un réglage utilisateur.

## Fonctionnalités implémentées

- [x] Inscription d'une nouvelle école (formulaire email + mot de passe)
- [x] Authentification par rôle (Directeur / Enseignant / Parent), changement de mot de passe forcé à la première connexion
- [x] Élèves : création, modification, recherche, filtres, import Excel, désactivation/réactivation, frais d'inscription optionnel avec reçu
- [x] Enseignants : création, modification, salaire, matières et classes assignées
- [x] Parents : création, modification, liaison à un ou plusieurs enfants, WhatsApp/appel en un clic
- [x] Classes & matières : capacité, professeur principal, assignation matière/enseignant, coefficients
- [x] Emploi du temps : vue hebdomadaire par classe, impression ; l'enseignant peut gérer ses propres créneaux
- [x] Présences : appel quotidien, "tous présents", alerte WhatsApp bilingue aux parents d'élèves absents
- [x] Examens & notes : création d'examen, saisie des notes, rang en direct, alerte WhatsApp des notes
- [x] Bulletins : moyenne pondérée par coefficient, mention, rang, appréciation générée par IA (Gemini) et modifiable, impression
- [x] Réinscription : transfert en masse d'une classe vers l'année suivante, avec frais optionnel
- [x] Discipline : suivi des incidents par élève (type, sanction)
- [x] Finance : frais, paiements, statut automatique, reçu numéroté, rappel WhatsApp
- [x] Communication : modèles de message WhatsApp réutilisables
- [x] Statistiques : présence, résultats, répartition des élèves
- [x] Paramètres : profil de l'école, logo, années scolaires
- [x] Multi-langue (français / anglais / arabe RTL) sur les écrans les plus utilisés (Tableau de bord, Élèves, Finance, Bulletins) ; reste de l'application en français
- [x] Menu latéral regroupé par catégories (Scolarité, Pédagogie, Finance, Administration)

Voir [`audit-report.md`](./audit-report.md) pour le détail de l'audit de production (sécurité, calculs, accessibilité) et les limitations connues.

## Déploiement

Hébergement sur **Vercel** (build Next.js) + **Neon** (base Postgres). Renseigner les variables d'environnement ci-dessus dans le tableau de bord Vercel, avec `NEXTAUTH_URL` pointant vers l'URL de production.

Après tout changement d'hébergeur de base, appliquer les migrations avec
`npx prisma migrate deploy` — jamais `prisma migrate reset`, qui efface les
données.
