# Validation du patch Sécurité Nuit

Version basée sur le monorepo envoyé dans `pepo - Copy(1).zip`, validée le 7 octobre 2026.

- `npm run check` : TypeScript des workspaces, frontières Rider/Driver/packages, assets et lint ; 25 suites, 198 tests réussis.
- `tests/night-safety.test.ts` : 18 tests consacrés aux fuseaux/limites horaires, dossier nocturne, GPS récent/précis, proximity/PIN, offres et attribution, arrêt/écart durable, GPS interrompu, idempotence, confidentialité des réponses, mauvais rôle/session expirée, prise en charge administrative, reprise après redémarrage, expiration, purge et révocation de partage.
- `npm run build:api` : compilation du serveur et copie des ressources admin réussies.
- Exports Expo iOS de Rider et Driver et exports web : compilation des interfaces, sans signature Apple ni test matériel. La compilation ne valide pas les permissions du téléphone, la qualité du GPS ou les interruptions réelles du réseau.
- Installation testée séparément : préflight sans mutation, installation, idempotence, fichier conflictuel, fichier de base manquant, fins de lignes CRLF, préservation des `.env`/images/données et restauration des sources.

Deux tests hérités ne correspondaient déjà plus au catalogue et au comportement de VehicleOptions de l’archive : réservation 4x4 retirée et ancien tri en mode compact. Ils ont été alignés sur les types actifs et le maintien de l’ordre existant. Un type de callback encore lié aux véhicules retirés et un ancien fichier MapVehicle pointant vers des assets inexistants ont également été corrigés, sans changement du rendu de la carte Google.

Les tests métier précédents isolent le mode nuit ; les tests dédiés exécutent réellement les nouvelles règles avec une horloge injectée. Aucun secret, numéro de vrai utilisateur ou base du projet n’est utilisé par les nouveaux tests.

La page d’administration doit encore être vérifiée visuellement dans votre navigateur. Un script optionnel `scripts/smoke-safety.cjs` parcourt la revue, la file d’aide, la prise en charge, la clôture et la déconnexion sur données temporaires. Il nécessite un Chromium Playwright installé ; cette vérification navigateur n’a pas été exécutée avec succès dans l’environnement de préparation, qui ne disposait pas de ce navigateur. `PEPO_BROWSER_PATH` peut désigner un exécutable Chrome/Chromium déjà installé.

```powershell
node --import tsx scripts/smoke-safety.cjs
```

À valider avant diffusion : tests sur iPhone/Android réels avec deux comptes, texte agrandi, langues relues localement, seuils ajustés à la circulation, reprise réseau, procédures d’astreinte et responsabilité de la file. Les tests n’attestent ni d’une permanence d’assistance, ni d’une résistance à la falsification GPS, ni d’une capacité de forte charge. Aucun test de secours réel n’a été lancé.
