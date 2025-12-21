# Install dependencies and start dev server
Set-Location $PSScriptRoot
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "Dependencies installed successfully!" -ForegroundColor Green
    Write-Host "Starting development server..." -ForegroundColor Yellow
    npm run dev
} else {
    Write-Host "Failed to install dependencies. Exit code: $LASTEXITCODE" -ForegroundColor Red
    exit 1
}





