param(
  [string]$Owner = "grabovskiysergey2004-afk",
  [string]$Repo = "smeta-stroyka-ai-calculator"
)

$ErrorActionPreference = "Stop"
$RepoFullName = "$Owner/$Repo"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$GhExe = (Get-Command gh -ErrorAction SilentlyContinue).Source
if (-not $GhExe) {
  $GhExe = Join-Path $env:ProgramFiles "GitHub CLI\gh.exe"
}
if (-not (Test-Path $GhExe)) {
  throw "GitHub CLI not found. Install it first: winget install --id GitHub.cli -e"
}

function Run-Gh {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
  & $GhExe @Args
}

Write-Host "Checking GitHub CLI auth..."
Run-Gh auth status

Write-Host "Ensuring private repository exists: $RepoFullName"
$repoExists = $true
try {
  Run-Gh repo view $RepoFullName --json nameWithOwner,visibility | Out-Null
} catch {
  $repoExists = $false
}

if (-not $repoExists) {
  Run-Gh repo create $RepoFullName --private --source . --remote origin --push --description "Smeta-Stroyka AI Calculator: local AI tool for construction estimates, plans, proposals and price lists"
} else {
  $remote = git remote get-url origin 2>$null
  if (-not $remote) {
    git remote add origin "https://github.com/$RepoFullName.git"
  }
  git push -u origin main
}

Write-Host "Creating labels..."
$labels = @(
  @{ name = "status:done"; color = "0E8A16"; description = "Completed and recorded" },
  @{ name = "status:planned"; color = "1D76DB"; description = "Planned for development" },
  @{ name = "area:setup"; color = "C5DEF5"; description = "Project setup, launch, GitHub" },
  @{ name = "area:docs"; color = "BFDADC"; description = "Documentation, PRD, plans, AGENTS" },
  @{ name = "area:frontend"; color = "FBCA04"; description = "Interface and React/Vite" },
  @{ name = "area:architecture"; color = "5319E7"; description = "Stack, structure, migration" },
  @{ name = "area:product"; color = "D93F0B"; description = "Product logic and scenarios" },
  @{ name = "area:pricing"; color = "006B75"; description = "Price lists and estimates" },
  @{ name = "area:pdf"; color = "7057FF"; description = "PDF, drawings, recognition" },
  @{ name = "area:cad"; color = "B60205"; description = "Canvas, CAD-light, object levels" }
)

foreach ($label in $labels) {
  try {
    Run-Gh label create $label.name --color $label.color --description $label.description --force --repo $RepoFullName | Out-Null
  } catch {
    Write-Warning "Label skipped: $($label.name)"
  }
}

$issuesPath = Join-Path $PSScriptRoot "github-issues.json"
$issues = Get-Content -Path $issuesPath -Raw -Encoding UTF8 | ConvertFrom-Json

function New-Issue {
  param(
    [string]$Title,
    [string]$Body,
    [string[]]$Labels,
    [bool]$Close
  )

  $labelArg = ($Labels -join ",")
  $issueUrl = Run-Gh issue create --repo $RepoFullName --title $Title --body $Body --label $labelArg
  $number = [int]([regex]::Match(($issueUrl | Select-Object -Last 1), "/issues/(\d+)$").Groups[1].Value)
  if ($Close) {
    Run-Gh issue close $number --repo $RepoFullName --comment "Зафиксировано в стартовых коммитах проекта." | Out-Null
  }
  Write-Host "Issue #$number: $Title"
}

Write-Host "Creating issues..."
foreach ($issue in $issues) {
  New-Issue `
    -Title $issue.title `
    -Body $issue.body `
    -Labels ([string[]]$issue.labels) `
    -Close ([bool]$issue.close)
}

Write-Host "GitHub bootstrap completed: https://github.com/$RepoFullName"
