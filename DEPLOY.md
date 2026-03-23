# Deploy CV Generator — Step by Step

**Résultat final :** une URL publique gratuite type `https://cv-generator-xxxx.onrender.com`

---

## Étape 1 — Créer le repo GitHub

1. Va sur **https://github.com/new**
2. Nom du repo : `cv-generator` (ou ce que tu veux)
3. Visibilité : **Private** (recommandé — contient le template Select Advisory)
4. **Ne coche rien** (pas de README, pas de .gitignore)
5. Clique **Create repository**
6. Copie l'URL du repo (ex: `https://github.com/tonnom/cv-generator`)

## Étape 2 — Pousser le code

Double-clique sur **`deploy.bat`** dans ce dossier,
colle l'URL GitHub quand demandé.

## Étape 3 — Déployer sur Render (gratuit)

1. Va sur **https://render.com** → **Sign Up** (avec ton compte GitHub)
2. Clique **New +** → **Web Service**
3. Connecte ton repo `cv-generator`
4. Render détecte automatiquement les paramètres via `render.yaml` :
   - **Build Command** : `pip install -r requirements.txt`
   - **Start Command** : `gunicorn app:app`
5. Clique **Create Web Service**
6. Attends 2-3 minutes → ton URL apparaît en haut (ex: `https://cv-generator-xxxx.onrender.com`)

## Notes

- **Gratuit** : le tier "Free" de Render suffit largement
- **Mise en veille** : après 15 min sans trafic, le premier chargement prend ~30s (normal sur le tier gratuit)
- **Mises à jour** : un simple `git push` redéploie automatiquement
- **Template .docx** : le fichier `word_templates/select_advisory.docx` est inclus dans le repo

## Mettre à jour l'app après déploiement

```bash
git add -A
git commit -m "update"
git push
```
Render redéploie automatiquement en ~2 min.
