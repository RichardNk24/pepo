# Validation du patch Swahili du Katanga

- `npm run check` : TypeScript de tous les workspaces, frontières des modules, ESLint et **236 tests réussis** sur 29 fichiers.
- 10 nouveaux tests de corpus : activation explicite, authentification, consentement, limites audio, chiffrement, isolation des propriétaires, réécoute de l’audio réel, référence masquée au fournisseur, quota partagé, concurrence, révisions et export CLI sans écrasement.
- Construction API et exports iOS/Hermes de Rider et Driver réussis. Export web Rider réussi ; la collecte/réécoute reste réservée au mobile.
- Contrôle de l’installateur : préflight, installation, idempotence, fichiers Windows BOM/CRLF, protection .env/assets/données, refus de conflit, restauration des octets originaux et protection de modifications ultérieures.

Tests du fournisseur simulés : aucun coût OpenAI généré pour cette validation. Aucun enregistrement réel sur un iPhone n’a été effectué dans cet environnement. La validation acoustique, le microphone et les permissions iOS doivent être testés sur le téléphone du contributeur. Aucun taux de qualité pour la population du Katanga n’est revendiqué.
