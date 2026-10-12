# Sauvegardes de la base Madrasati

Trois filets, du plus récent au plus ancien :

| Quoi | Où | Combien de temps |
|---|---|---|
| Historique continu de Neon | Neon, branche `production` | 6 heures (offre gratuite) |
| Copie chiffrée de chaque nuit (2 h UTC) | GitHub → Actions → « Sauvegarde de la base » | 35 jours |
| Sauvegarde manuelle `sauvegarde-manuelle-2026-10-12` | Neon → Backup & Restore | sans limite |

La copie de nuit est faite avec un accès **en lecture seule** (`madrasati_sauvegarde`) et chiffrée avec `scripts/backup/cle-publique.pem`. Seule la **clé privée** l'ouvre. Elle est gardée hors de GitHub par le responsable : `Documents/Madrasati - sauvegardes/cle-privee-sauvegardes.pem`, avec deux copies, l'une sur une clé USB et l'autre dans un second endroit sûr. Sans cette clé, les sauvegardes sont illisibles.

## Restaurer

On ne restaure **jamais** directement sur la production. On restaure d'abord dans une nouvelle branche Neon, on vérifie, puis on bascule.

1. **Récupérer la copie.** GitHub → dépôt Madrasati → **Actions** → « Sauvegarde de la base ». Choisissez la nuit voulue, puis téléchargez l'artefact `sauvegarde-AAAA-MM-JJ-…` et dézippez-le.
2. **La déchiffrer** (dans le dossier du projet) :
   ```bash
   node scripts/backup/decrypt.mjs madrasati-AAAA-MM-JJ.sauvegarde "<chemin>/cle-privee-sauvegardes.pem" base.dump
   ```
3. **Créer une branche vide** dans Neon (Branches → Create branch → « schema only » ou vide), puis copier son adresse de connexion (« Direct »).
4. **Recharger la copie** dans cette branche, avec `pg_restore` en version 18 :
   ```bash
   pg_restore --no-owner --no-privileges --clean --if-exists --dbname="<adresse de la nouvelle branche>" base.dump
   ```
5. **Vérifier** sur cette branche : nombre d'écoles, d'élèves et de paiements, et derniers reçus.
6. **Basculer.** Dans Neon, faites de cette branche la branche par défaut, ou mettez son adresse dans `DATABASE_URL` / `DIRECT_URL` sur Vercel, puis redéployez.

Pour une erreur de moins de 6 heures, l'historique de Neon suffit : Neon → Restore → choisir l'heure.

## Essai de restauration (une fois par mois)

Déroulez les étapes 1 à 5 sur la dernière copie, puis supprimez la branche d'essai. Notez la date et les nombres vérifiés. Une sauvegarde qu'on n'a jamais réussi à recharger n'est pas une sauvegarde.

## En cas de problème

- **Une nuit échoue** : GitHub envoie un e-mail. Relancez à la main (Actions → « Sauvegarde de la base » → *Run workflow*).
- **Changer l'accès de lecture** (par exemple après une fuite) : recréer le mot de passe du rôle `madrasati_sauvegarde`, puis mettre à jour le secret GitHub `BACKUP_DATABASE_URL`.
- **Clé privée perdue** : générer une nouvelle paire (`generateBackupKeys` dans `scripts/backup/crypto.mjs`) et remplacer `cle-publique.pem`. Les anciennes copies restent illisibles.
