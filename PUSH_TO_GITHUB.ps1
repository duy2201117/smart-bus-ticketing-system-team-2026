$ErrorActionPreference = 'Stop'
$repo = 'https://github.com/duy2201117/smart-bus-ticketing-system-team-2026.git'
$branch = 'feature/luan-khanh-duy-integration'

if (-not (Test-Path '.git')) {
  git init
}

git config user.name 'Luân Khánh Duy'
git config user.email '146414007+duy2201117@users.noreply.github.com'

$origin = git remote 2>$null | Select-String '^origin$'
if ($origin) {
  git remote set-url origin $repo
} else {
  git remote add origin $repo
}

git fetch origin
# Build the source commit from the current shared develop branch.
git checkout -B $branch origin/develop

git add -A
if (-not (git diff --cached --quiet)) {
  git commit -m 'feat: integrate complete Smart Bus source'
} else {
  Write-Host 'Không có thay đổi mới để commit.'
}

git push -u origin $branch
Write-Host ''
Write-Host 'Đã push source lên:' $branch
Write-Host 'Quay lại ChatGPT và nhắn: ĐÃ PUSH SOURCE để tạo PR -> develop, review và merge.'
