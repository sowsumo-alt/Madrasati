# Checklist de mise en production — Madrasati

Ce document liste tout ce qu'il reste à faire, côté configuration et décisions, pour ouvrir Madrasati à de vraies écoles. Le code applicatif est prêt (voir [`audit-report.md`](./audit-report.md) pour le détail de l'audit) ; ce qui suit dépend de choix et d'accès que seul le propriétaire du produit peut fournir.

---

## 1. Variables d'environnement requises

À renseigner dans le tableau de bord Vercel (Project Settings → Environment Variables), pour l'environnement **Production** :

| Variable | Où la trouver | Obligatoire |
|---|---|---|
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string (pooler, mode transaction, port 6543) | Oui |
| `DIRECT_URL` | Supabase → Project Settings → Database → Connection string (connexion directe, port 5432) | Oui |
| `NEXTAUTH_SECRET` | À générer une fois : `openssl rand -base64 32` | Oui |
| `NEXTAUTH_URL` | L'URL publique finale de l'application (ex: `https://madrasati.mr` ou l'URL `.vercel.app`) | Oui |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | Oui |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → clé "anon public" (publique par design, sûre à exposer) | Oui |
| `GEMINI_API_KEY` | Google AI Studio → Get API key | Oui (sinon la génération d'appréciation par IA échoue silencieusement, le reste fonctionne) |

Voir `.env.example` à la racine du projet pour le modèle exact.

## 2. Ce qu'Abou doit fournir avant l'ouverture

- [ ] **Compte Supabase** en plan payant si le volume d'écoles/élèves dépasse le plan gratuit (limites : taille de base, bande passante, mise en veille après inactivité sur le plan gratuit — à surveiller, une base "endormie" ralentit la première requête de la journée).
- [ ] **Compte Google Cloud Console** avec un Client OAuth configuré, Client ID/Secret renseignés dans Supabase (Authentication → Providers → Google) — déjà fait pour le développement, à vérifier que l'URI de redirection Supabase (`https://<projet>.supabase.co/auth/v1/callback`) est bien enregistrée côté Google (à faire une seule fois, indépendant de l'environnement).
- [ ] **Clé Google AI Studio (Gemini)** dédiée à la production (recommandé : une clé distincte de celle utilisée en développement, avec quota/facturation suivis séparément).
- [ ] **Nom de domaine** si `madrasati.mr` ou équivalent est souhaité (voir section 3).
- [ ] **Décision sur le numéro WhatsApp affiché** sur la page publique et dans les modèles de message (actuellement `+222 31 72 84 17`, à confirmer que c'est bien le numéro définitif de contact/support).
- [ ] **Logo et informations de chaque école** (chaque directeur peut les renseigner lui-même dans Paramètres après inscription — rien à préparer à l'avance).

## 3. Domaine et DNS (`.mr` ou domaine standard)

1. Réserver le domaine (`.mr` s'enregistre auprès du registre mauritanien NIC-MR ; les extensions génériques comme `.com` passent par n'importe quel registrar : Namecheap, OVH, Google Domains...).
2. Dans Vercel : Project Settings → Domains → ajouter le domaine.
3. Vercel indique les enregistrements DNS à créer chez le registrar :
   - Un enregistrement **A** pointant vers l'IP de Vercel pour le domaine racine (`madrasati.mr`), ou
   - Un enregistrement **CNAME** vers `cname.vercel-dns.com` pour un sous-domaine (`app.madrasati.mr`).
4. Attendre la propagation DNS (quelques minutes à 48h selon le registrar).
5. Une fois le domaine actif et le certificat HTTPS émis automatiquement par Vercel, **mettre à jour `NEXTAUTH_URL`** avec la nouvelle URL et redéployer.

## 4. Hébergement (déjà en place)

- **Frontend** : Vercel (build Next.js). Recommandé : plan Pro dès que plusieurs écoles réelles sont actives (le plan gratuit limite l'usage des fonctions serverless).
- **Base de données** : Supabase (PostgreSQL managé). Les migrations Prisma (`prisma/migrations/`) doivent être appliquées avec `npx prisma migrate deploy` avant chaque mise en production d'un changement de schéma — jamais `prisma migrate reset` sur une base contenant de vraies données.

## 5. Sécurité — vérifications finales

- **Isolation entre écoles** : entièrement assurée au niveau applicatif — chaque requête Prisma est filtrée par `schoolId`, et chaque action serveur vérifie le rôle de l'utilisateur (`requireRole`/`requireUser`, voir `src/lib/session.ts`). Un audit complet ligne par ligne de cette isolation a été fait (voir `audit-report.md`), plusieurs failles réelles trouvées et corrigées.
  **Point important à comprendre** : ce projet **n'utilise pas** les policies Row Level Security (RLS) de Supabase. Prisma se connecte directement à la base Postgres avec les identifiants de connexion (`DATABASE_URL`), en contournant la couche API de Supabase (PostgREST) — RLS ne s'applique donc pas ici et n'a pas de sens à activer dans cette architecture. L'isolation entre écoles repose entièrement et uniquement sur le code applicatif audité. Pour une deuxième couche de protection indépendante du code (défense en profondeur), il faudrait un changement d'architecture plus important : activer RLS sur chaque table ET faire transiter les requêtes de données par le client Supabase plutôt que par Prisma — non fait ici, à évaluer séparément si ce niveau de garantie supplémentaire est jugé nécessaire.
- **Liens WhatsApp** : les numéros de téléphone sont normalisés avant envoi (`src/lib/phone.ts`, ajout automatique de l'indicatif mauritanien si absent) et le contenu du message est encodé dans l'URL par `buildWhatsAppUrl` (`src/lib/whatsapp.ts`) — pas d'injection possible dans le lien `wa.me`. Ces liens ouvrent WhatsApp côté client uniquement ; aucune donnée n'est envoyée à un serveur tiers par Madrasati lui-même.
- **Mots de passe temporaires** générés avec un générateur cryptographique (`crypto.randomInt`), jamais affichés à nouveau après création — communiqués une seule fois au directeur, changement obligatoire à la première connexion.
- **Limitation de tentatives de connexion (throttling)** : non implémentée (voir limitations connues d'`audit-report.md`). À ajouter avant une ouverture à grande échelle, avec un service externe adapté au serverless (ex. Upstash Redis + Vercel).
- **Secrets** : confirmer qu'aucune variable d'environnement de production n'est réutilisée depuis l'environnement de développement (générer un `NEXTAUTH_SECRET` distinct, une clé Gemini distincte si possible).

## 6. Aspects juridiques à faire valider (hors périmètre technique)

Je ne suis pas juriste et ces points nécessitent une vraie validation légale avant une ouverture commerciale, en particulier parce que l'application stocke des données d'enfants mineurs :

- [ ] **Politique de confidentialité** : à rédiger et publier, expliquant quelles données sont collectées (élèves, parents, notes, présences, paiements), pourquoi, combien de temps elles sont conservées, et qui y a accès.
- [ ] **Conditions d'utilisation** pour les écoles clientes.
- [ ] **Protection des données de mineurs** : vérifier les obligations légales applicables en Mauritanie (et dans les pays des écoles utilisatrices le cas échéant) concernant les données d'enfants — consentement parental, droit à l'effacement, durée de conservation.
- [ ] **Localisation des données** : Supabase héberge par défaut hors Mauritanie (région choisie à la création du projet — actuellement `eu-central-1`, en Europe) ; vérifier si une réglementation impose un hébergement local ou dans une zone géographique précise.
- [ ] **Contrat/accord avec chaque école** clarifiant qui est responsable des données saisies (l'école reste responsable du contenu qu'elle saisit ; Madrasati est l'hébergeur technique).

## 7. Build et livraison

```bash
npm install
npx prisma migrate deploy   # applique les migrations sur la base de production
npm run build                # build de production, doit se terminer sans erreur
npm run start                 # démarre le build (ou déploiement automatique via Vercel)
```

Sur Vercel, le build/déploiement est automatique à chaque push sur la branche connectée (`master`) — les commandes ci-dessus servent à vérifier en local avant de pousser.

## 8. Fichiers et dossiers à inclure dans le déploiement

Tout le dépôt Git tel quel — Vercel construit directement depuis le dépôt GitHub connecté, aucun fichier à sélectionner manuellement. Pour rappel, ce qui ne doit **jamais** être commité (déjà exclu par `.gitignore`) :
- `.env` (secrets réels — seul `.env.example`, avec des valeurs vides, est versionné)
- `node_modules/`
- `.next/` (généré à chaque build)

Le dossier `public/` (icônes PWA, `manifest.webmanifest` généré depuis `src/app/manifest.ts`, `sw.js`, `offline.html`, `favicon.ico`) doit rester versionné : ce sont des fichiers statiques nécessaires au fonctionnement de l'application installée.

## 9. Application installable (PWA)

- Icônes et manifest en place pour l'installation sur écran d'accueil Android et iPhone (voir `src/app/manifest.ts`, `public/icons/`, `public/apple-touch-icon.png`).
- Un service worker (`public/sw.js`) met en cache les fichiers statiques (JS/CSS/icônes) pour un chargement quasi instantané dès la deuxième visite — utile sur une connexion 3G. Il affiche une page de secours (`public/offline.html`) si le réseau est injoignable pendant la navigation.
- **Volontairement non fait** : mise en cache des données (présences, notes, paiements) pour un usage hors-ligne complet. Une école qui ouvre l'application sans réseau verra la page de secours plutôt que des données périmées — choix délibéré pour ne jamais risquer d'afficher, ou pire de laisser modifier, une information obsolète qui créerait un conflit avec une autre école ou une perte/duplication de saisie une fois la connexion revenue. Construire un vrai mode hors-ligne avec synchronisation fiable (file d'attente des actions, résolution de conflits) est un chantier à part entière, non couvert ici.

## 10. Ce qui n'a pas pu être vérifié

- Rendu visuel réel sur téléphone/tablette physiques, contraste des couleurs, comportement sous 3G réelle : pas d'accès navigateur pendant cet audit. Le code suit les bonnes pratiques standard (Tailwind responsive, Radix UI accessible) mais un passage humain reste recommandé avant une ouverture à grande échelle.
- Facturation réelle Supabase/Vercel/Google AI Studio à grande échelle : les plans gratuits suffisent pour une poignée d'écoles pilotes, mais les coûts doivent être anticipés avant une croissance importante du nombre d'écoles.
