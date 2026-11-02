$ErrorActionPreference = 'Stop'
$containerName = 'smart_budget_access_test_20261101'
$repoRoot = Split-Path -Parent $PSScriptRoot
$inspection = & docker inspect $containerName
if ($LASTEXITCODE -ne 0) { throw 'Dedicated local test container not found.' }
$containerInfo = @($inspection | ConvertFrom-Json)[0]
if ($containerInfo.Config.Labels.'codex.task' -ne 'smart-budget-access') { throw 'Container label does not match this task.' }
if (-not $containerInfo.State.Running) {
  & docker start $containerName | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not start this task''s dedicated container.' }
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    & docker exec $containerName pg_isready -U postgres 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Milliseconds 250
  }
  if ($LASTEXITCODE -ne 0) { throw 'Local PostgreSQL did not become ready.' }
}
$dbName = 'sb_access_test_' + (Get-Date -Format 'yyyyMMdd_HHmmss')
& docker exec $containerName createdb -U postgres $dbName
if ($LASTEXITCODE -ne 0) { throw 'Could not create isolated test database.' }
$testFiles = @('tests/access-baseline.sql', 'supabase/001_prepare_access.sql', 'supabase/002_enforce_access.sql', 'tests/access-database.sql')
foreach ($relativePath in $testFiles) {
  $absolutePath = Join-Path $repoRoot $relativePath
  $targetFile = '/tmp/' + [IO.Path]::GetFileName($absolutePath)
  & docker cp $absolutePath "${containerName}:$targetFile"
  if ($LASTEXITCODE -ne 0) { throw "Could not copy $relativePath" }
  $result = & docker exec $containerName psql -X -q -v ON_ERROR_STOP=1 -U postgres -d $dbName -f $targetFile 2>&1
  if ($LASTEXITCODE -ne 0) { $result | Write-Output; throw "Failed: $relativePath" }
  Write-Output "PASS: $relativePath"
}
& node (Join-Path $PSScriptRoot 'access-concurrency.cjs') $containerName $dbName
if ($LASTEXITCODE -ne 0) { throw 'Concurrency tests failed.' }
Write-Output "Database checks completed in local database $dbName (no production connection)."
