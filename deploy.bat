@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM  CV Generator — GitHub push + Render deployment helper
REM  Run this ONCE after creating your GitHub repo (see instructions below).
REM ─────────────────────────────────────────────────────────────────────────────

echo.
echo  CV Generator — Deploy to GitHub
echo  ─────────────────────────────────

set /p REPO_URL="Paste your GitHub repo URL (e.g. https://github.com/yourname/cv-generator): "

cd /d "%~dp0"
git remote remove origin 2>nul
git remote add origin %REPO_URL%
git branch -M main
git push -u origin main

echo.
echo  Done! Your code is on GitHub.
echo.
echo  Next step: go to https://render.com and connect this repo.
echo  (See DEPLOY.md for step-by-step instructions)
pause
