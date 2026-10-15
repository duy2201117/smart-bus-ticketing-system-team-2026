$ErrorActionPreference = 'Stop'

$repo = 'https://github.com/duy2201117/smart-bus-ticketing-system-team-2026.git'
$branch = 'feature/luan-khanh-duy-integration'

Write-Host '=== SmartBus GitHub push ==='

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Git is not installed or is not available in PATH.'
}

if (-not (Test-Path '.git')) {
    git init
    if ($LASTEXITCODE -ne 0) { throw 'git init failed.' }
}

git config user.name 'Luan Khanh Duy'
git config user.email '146414007+duy2201117@users.noreply.github.com'

$originExists = git remote 2>$null | Where-Object { $_ -eq 'origin' }
if ($originExists) {
    git remote set-url origin $repo
} else {
    git remote add origin $repo
}
if ($LASTEXITCODE -ne 0) { throw 'Could not configure origin.' }

Write-Host 'Fetching origin...'
git fetch origin
if ($LASTEXITCODE -ne 0) { throw 'git fetch origin failed.' }

# Point the local feature branch at the current shared develop commit
# without overwriting the source files already in this folder.
git symbolic-ref HEAD "refs/heads/$branch"
git reset --mixed origin/develop
if ($LASTEXITCODE -ne 0) { throw 'Could not base the branch on origin/develop.' }

Write-Host 'Staging source files...'
git add -A
if ($LASTEXITCODE -ne 0) { throw 'git add failed.' }

git diff --cached --quiet
$hasChanges = ($LASTEXITCODE -ne 0)

if ($hasChanges) {
    git commit -m 'feat: integrate complete Smart Bus source'
    if ($LASTEXITCODE -ne 0) { throw 'git commit failed.' }
} else {
    Write-Host 'No new changes to commit.'
}

Write-Host 'Pushing branch...'
git push -u origin $branch
if ($LASTEXITCODE -ne 0) { throw 'git push failed.' }

Write-Host ''
Write-Host 'PUSH COMPLETE.'
Write-Host "Branch: $branch"
Write-Host 'Return to ChatGPT and send: DA PUSH SOURCE'
