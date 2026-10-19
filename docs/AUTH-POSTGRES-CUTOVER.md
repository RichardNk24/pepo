# Auth NestJS + PostgreSQL : basculement progressif

Cette tranche porte les routes `POST /api/auth/request` et `POST /api/auth/verify`
sur des contrôleurs NestJS. Les codes OTP et les nouvelles sessions sont écrits
dans PostgreSQL. Au retour d’une connexion, le profil et la session sont aussi
copiés dans SQLite pour que les routes Express historiques continuent de
fonctionner. Les requêtes authentifiées vérifient PostgreSQL d’abord, puis
SQLite pour les sessions non encore importées.

Le changement reste désactivé tant que `AUTH_POSTGRES_ENABLED=false`.

## Préparer le basculement sur Windows

1. Arrêter l’API et conserver une copie de `apps\api\data\pepo.sqlite` (ou le
   fichier indiqué par `DATA_DIR`). Garder cette sauvegarde jusqu’à validation.
2. Vérifier que PostgreSQL est accessible et que le schéma est à jour :

   ```powershell
   npm run db:migrate -w @pepo/api
   ```

3. Vérifier l’import sans écrire dans PostgreSQL :

   ```powershell
   npm run db:migrate:auth-legacy -w @pepo/api -- --dry-run
   ```

4. Importer les profils, sessions et OTP existants. La commande est
   transactionnelle et conserve SQLite :

   ```powershell
   npm run db:migrate:auth-legacy -w @pepo/api
   ```

5. Dans `apps\api\.env`, conserver les URLs `DATABASE_URL` et `REDIS_URL`, puis
   ajouter :

   ```dotenv
   AUTH_POSTGRES_ENABLED=true
   ```

6. Redémarrer l’API et tester une demande de code, une connexion et une route
   authentifiée rider puis driver. Pour le développement, `DEV_AUTH=true` renvoie
   le code dans la réponse; désactiver cette option en production.

Si la reprise échoue sur des identifiants différents, l’import s’annule en
entier. Ne supprimez pas la base SQLite : elle reste la source des données des
routes qui n’ont pas encore été migrées.

## Contrat et protections

- Les routes et les réponses gardent le contrat actuel des applications :
  `expiresIn`/`devCode`, puis `{ token, profile }`.
- Les OTP expirent après cinq minutes, sont limités à une demande par minute et
  à cinq essais. Le hash OTP est comparé en temps constant.
- La session opaque de 32 octets expire après 30 jours; seul son SHA-256 est
  conservé dans PostgreSQL et SQLite.
- Une erreur de PostgreSQL annule l’écriture de session autant que possible et
  retire la session miroir SQLite non retournée au client.
- Cette tranche ne migre pas encore les profils, courses ou autres domaines
  métier hors SQLite. Le pont Express reste actif pour ces routes.
