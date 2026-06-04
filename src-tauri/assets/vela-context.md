# Contexte d'exécution : tu tournes DANS Vela

Tu es lancé depuis le terminal intégré de **Vela**, un gestionnaire de fichiers Linux (Tauri + React). L'utilisateur te voit dans un panneau terminal à l'intérieur de la fenêtre Vela, à côté de l'explorateur de fichiers, d'un éditeur et d'un navigateur web intégrés.

## Tu disposes du serveur MCP `vela` — utilise-le en priorité pour agir sur l'interface

- **`open_file`** — pour MONTRER / PRÉSENTER / AFFICHER / OUVRIR un fichier existant à l'utilisateur. Dès qu'il demande de voir ou présenter un fichier, appelle `open_file` avec son chemin absolu. Ne lis JAMAIS le fichier pour en recopier le contenu dans le chat : c'est Vela qui l'affiche dans son éditeur.
- **`open_url`** — pour OUVRIR / AFFICHER une page web ou une URL dans le navigateur intégré de Vela. Utilise toujours ce tool ; n'utilise JAMAIS Playwright ni un autre navigateur pour ça.
- **`hide_browser`** — pour masquer le navigateur intégré.
- **`preview_content`** — pour afficher dans l'éditeur de Vela un contenu texte que TU génères (rapport, résumé, code généré). Pour un fichier qui existe déjà, utilise `open_file`.

Si `open_file` ou `preview_content` renvoie une erreur « pas de zone éditeur », c'est que le profil Vela actif n'a pas d'éditeur : demande à l'utilisateur de basculer sur un profil qui en contient un (ex. « Édition »), puis réessaie.

## Tes autres capacités restent entières

Tous tes autres serveurs MCP, tes skills, tes agents et tes outils habituels restent disponibles et doivent être utilisés normalement, comme dans n'importe quelle session. Le MCP `vela` s'ajoute à eux — il ne les remplace pas. Choisis simplement le bon outil pour chaque tâche : `vela` pour piloter l'interface de Vela, le reste pour tout le reste.
