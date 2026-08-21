# Probes which Google endpoint the key in .env can actually reach.
#
# There are two, they are not interchangeable, and the SDK only talks to the
# first one out of the box:
#
#   generativelanguage.googleapis.com  — AI Studio. What @ai-sdk/google calls.
#   aiplatform.googleapis.com          — Vertex / Gemini Enterprise Agent
#                                        Platform, in express mode.
#
# Usage:  pwsh scripts/llm-probe.ps1 [-Model gemini-3.7-flash] [-Location global]

param(
  [string]$Model = "",
  [string]$Location = "global"
)

$ErrorActionPreference = "Continue"

# Read .env without exporting anything: this script must not depend on the
# shell already having the variables.
$envVars = @{}
Get-Content .env | Where-Object { $_ -match '^\s*[A-Z_]+=' } | ForEach-Object {
  $name, $value = $_ -split '=', 2
  $envVars[$name.Trim()] = $value.Trim()
}

$key = $envVars["GOOGLE_AI_API_KEY"]
if ([string]::IsNullOrWhiteSpace($key)) {
  Write-Host "GOOGLE_AI_API_KEY is not set in .env" -ForegroundColor Red
  exit 1
}
if ([string]::IsNullOrWhiteSpace($Model)) {
  # First of GEMINI_MODELS, which is the one a function falls back to.
  $listed = $envVars["GEMINI_MODELS"]
  $Model = if ($listed) { ($listed -split ",")[0].Trim() } else { "gemini-3.7-flash" }
}

Write-Host "Key: $($key.Substring(0,6))…$($key.Substring($key.Length-4))  Model: $Model`n"

function Probe($label, $url, $body) {
  Write-Host "── $label" -ForegroundColor Cyan
  Write-Host "   $($url -replace [regex]::Escape($key), 'KEY')"
  try {
    $params = @{ Uri = $url; Method = if ($body) { "Post" } else { "Get" }; ErrorAction = "Stop" }
    if ($body) {
      $params.ContentType = "application/json"
      $params.Body = $body
    }
    $response = Invoke-RestMethod @params
    Write-Host "   OK" -ForegroundColor Green
    ($response | ConvertTo-Json -Depth 8 -Compress).Substring(0, [Math]::Min(400, ($response | ConvertTo-Json -Depth 8 -Compress).Length)) | Write-Host
  } catch {
    $status = $_.Exception.Response.StatusCode.value__
    Write-Host "   FAILED ($status)" -ForegroundColor Red
    $detail = $_.ErrorDetails.Message
    if ($detail) {
      Write-Host "   $($detail.Substring(0, [Math]::Min(400, $detail.Length)))"
    } else {
      Write-Host "   $($_.Exception.Message)"
    }
  }
  Write-Host ""
}

$prompt = '{"contents":[{"role":"user","parts":[{"text":"Rispondi solo: ciao"}]}]}'

# 1. AI Studio — what the application currently uses.
Probe "AI Studio · list models" `
  "https://generativelanguage.googleapis.com/v1beta/models?key=$key" $null

Probe "AI Studio · generate" `
  "https://generativelanguage.googleapis.com/v1beta/models/${Model}:generateContent?key=$key" $prompt

# 2. Vertex / Agent Platform in express mode. Same key format, different host,
#    and the path carries the publisher rather than a bare model name.
Probe "Agent Platform (express, global) · generate" `
  "https://aiplatform.googleapis.com/v1/publishers/google/models/${Model}:generateContent?key=$key" $prompt

Probe "Agent Platform (express, $Location) · generate" `
  "https://${Location}-aiplatform.googleapis.com/v1/publishers/google/models/${Model}:generateContent?key=$key" $prompt

Write-Host "Whichever line says OK is the endpoint the application has to use." -ForegroundColor Yellow
Write-Host "If only the Agent Platform one works, @ai-sdk/google needs its baseURL"
Write-Host "pointed there, or the provider has to change — see the design doc §3."
