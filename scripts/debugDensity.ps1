param(
  [string] $InputPath = 'public/poc/poc-mech-glint-punch-strip-raw.png',
  [int]    $From = 1196,
  [int]    $To   = 1320,
  [int]    $BgThreshold = 235
)

Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $InputPath))
$rect = New-Object System.Drawing.Rectangle 0, 0, $src.Width, $src.Height
$data = $src.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride = $data.Stride
$bytes = New-Object byte[] ($stride * $src.Height)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
$src.UnlockBits($data)

# Find vertical band first
function IsInk { param($x,$y)
  $i = ($y * $stride) + ($x * 4)
  if ($bytes[$i + 3] -lt 16) { return $false }
  return ((([int]$bytes[$i]) + ([int]$bytes[$i+1]) + ([int]$bytes[$i+2])) / 3) -lt $BgThreshold
}

$top = -1
for ($y = 0; $y -lt $src.Height; $y++) { for ($x = 0; $x -lt $src.Width; $x += 4) { if (IsInk $x $y) { $top = $y; break } }; if ($top -ge 0) { break } }
$bottom = -1
for ($y = $src.Height - 1; $y -ge 0; $y--) { for ($x = 0; $x -lt $src.Width; $x += 4) { if (IsInk $x $y) { $bottom = $y; break } }; if ($bottom -ge 0) { break } }

Write-Output ("Band rows {0}..{1}" -f $top, $bottom)
Write-Output ("Density (per col, x={0}..{1}):" -f $From, $To)
for ($x = $From; $x -le $To; $x++) {
  $c = 0
  for ($y = $top; $y -le $bottom; $y++) { if (IsInk $x $y) { $c++ } }
  $bar = '#' * [Math]::Min($c, 80)
  Write-Output ("{0,5} : {1,4} {2}" -f $x, $c, $bar)
}
