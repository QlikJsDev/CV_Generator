# Deploy CV Generator to Azure Web App
# Usage: .\deploy.ps1

$resourceGroup = "Agilos-AI-Portfolio"
$webAppName    = "CVGenerator-Agilos"
$projectRoot   = $PSScriptRoot
$zipPath       = "$env:TEMP\cvgenerator-deploy.zip"

Write-Host "Packaging..." -ForegroundColor Cyan

python -c "
import zipfile, os

src = r'$projectRoot'
dst = r'$zipPath'
exclude_dirs = {'temp', 'test', '.git', '.github'}
exclude_ext  = {'.docx', '.pdf'}

with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(src):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        rel_root = os.path.relpath(root, src)
        for file in files:
            fp = os.path.join(root, file)
            if os.path.splitext(file)[1].lower() in exclude_ext: continue
            arcname = os.path.relpath(fp, src)
            # docs/ -> public/ (docs/ is the latest frontend)
            if rel_root == 'docs' or rel_root.startswith('docs' + os.sep):
                rest = os.path.relpath(fp, os.path.join(src, 'docs'))
                arcname = os.path.join('public', rest)
            elif rel_root == 'public':
                docs_equiv = os.path.join(src, 'docs', file)
                if os.path.exists(docs_equiv): continue
            zf.write(fp, arcname)
print('OK')
"

Write-Host "Deploying to $webAppName..." -ForegroundColor Cyan
az webapp deploy --resource-group $resourceGroup --name $webAppName --src-path $zipPath --type zip

Write-Host "Done. https://$webAppName.azurewebsites.net" -ForegroundColor Green
