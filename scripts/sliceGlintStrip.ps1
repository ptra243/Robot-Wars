#requires -Version 5.0

<#
.SYNOPSIS
  Slice an AI-generated multi-pose strip into a clean, equal-column sprite
  strip by finding each character's bounding box independently.

.DESCRIPTION
  AI image generators don't space frames evenly and often connect adjacent
  frames with translucent FX trails. This script:

    1. Finds each character via density-peak non-maximum suppression
       (FrameCount peaks, separated by at least minSeparationPx).
    2. For each peak, walks LEFT and RIGHT until ink density drops below a
       per-frame trough threshold for several pixels in a row — that gives
       each character's natural bounding box (so the back leg in a deep
       lunge isn't clipped, and the extended punch fist isn't either).
    3. Picks the WIDEST detected box plus padding as the canonical
       frame width. Every frame in the output uses that width, so the
       wider extended-arm poses still fit.
    4. Vertically crops to the strip's overall content extent + padding.
    5. Recomposites: each character is pasted into its own column, with
       its bounding-box CENTER aligned to the column's CENTER (so back-leg
       overhang gets the same padding as front-arm overhang).
#>

param(
  [string] $InputPath = 'public/poc/poc-mech-glint-punch-strip-raw.png',
  [string] $OutputPath = 'public/poc/poc-mech-glint-punch-strip.png',
  # 0 = auto-detect from clean gaps; >0 = force NMS to that many peaks
  [int]    $FrameCount = 0,
  [int]    $BgThreshold = 235,
  [int]    $VerticalPadding = 12,
  [int]    $HorizontalPadding = 16,
  # When auto-detecting runs, this many bg columns must run consecutively
  # before we declare a new figure has started. 12-20 works for clean
  # generations with whitespace between figures.
  [int]    $RunGapTolerance = 16
)

Add-Type -AssemblyName System.Drawing

$inFull = Resolve-Path $InputPath
$src = [System.Drawing.Bitmap]::FromFile($inFull)
Write-Output ("Source: {0}x{1}" -f $src.Width, $src.Height)

$rect = New-Object System.Drawing.Rectangle 0, 0, $src.Width, $src.Height
$data = $src.LockBits(
  $rect,
  [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
)
$stride = $data.Stride
$bytes = New-Object byte[] ($stride * $src.Height)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
$src.UnlockBits($data)

function Test-IsInk {
  param([int]$x, [int]$y)
  $idx = ($y * $stride) + ($x * 4)
  $b = $bytes[$idx]
  $g = $bytes[$idx + 1]
  $r = $bytes[$idx + 2]
  $a = $bytes[$idx + 3]
  if ($a -lt 16) { return $false }
  $avg = ([int]$r + [int]$g + [int]$b) / 3
  return $avg -lt $BgThreshold
}

# Top/bottom row of any ink in the whole strip
$top = -1
for ($y = 0; $y -lt $src.Height; $y++) {
  for ($x = 0; $x -lt $src.Width; $x += 4) {
    if (Test-IsInk $x $y) { $top = $y; break }
  }
  if ($top -ge 0) { break }
}
$bottom = -1
for ($y = $src.Height - 1; $y -ge 0; $y--) {
  for ($x = 0; $x -lt $src.Width; $x += 4) {
    if (Test-IsInk $x $y) { $bottom = $y; break }
  }
  if ($bottom -ge 0) { break }
}
Write-Output ("Vertical content: rows {0}..{1} (height {2})" -f $top, $bottom, ($bottom - $top + 1))

# Per-column ink density across the vertical content band
$colInk = New-Object int[] $src.Width
for ($x = 0; $x -lt $src.Width; $x++) {
  $count = 0
  for ($y = $top; $y -le $bottom; $y += 1) {
    if (Test-IsInk $x $y) { $count++ }
  }
  $colInk[$x] = $count
}

# Smooth (15-px box) so single thin streaks (lightning sparks) don't dominate
$smoothed = New-Object int[] $src.Width
$winRadius = 7
for ($x = 0; $x -lt $src.Width; $x++) {
  $sum = 0
  $n = 0
  for ($k = -$winRadius; $k -le $winRadius; $k++) {
    $xx = $x + $k
    if ($xx -ge 0 -and $xx -lt $src.Width) {
      $sum += $colInk[$xx]
      $n++
    }
  }
  $smoothed[$x] = [int]([double]$sum / $n)
}

# Auto-detect runs of contiguous ink columns separated by RunGapTolerance bg
# columns. We use the RAW per-column ink count (not smoothed) so faint
# halos / lightning glow don't bridge adjacent figures.
#
# A column counts as "ink" only if it has at least `densityFloor` ink pixels
# across the vertical content band — single-pixel sparks between figures
# stay below this and are correctly treated as background.
function Find-CharacterRuns {
  param([int[]]$density, [int]$gapTol, [int]$densityFloor)
  $runs = New-Object System.Collections.ArrayList
  $inRun = $false
  $runStart = 0
  $runLastInk = 0
  $gap = 0
  for ($x = 0; $x -lt $density.Length; $x++) {
    if ($density[$x] -ge $densityFloor) {
      if (-not $inRun) {
        $runStart = $x
        $inRun = $true
      }
      $runLastInk = $x
      $gap = 0
    } else {
      if ($inRun) {
        $gap++
        if ($gap -gt $gapTol) {
          $null = $runs.Add(@{ Left = $runStart; Right = $runLastInk; Width = $runLastInk - $runStart + 1 })
          $inRun = $false
          $gap = 0
        }
      }
    }
  }
  if ($inRun) {
    $null = $runs.Add(@{ Left = $runStart; Right = $runLastInk; Width = $runLastInk - $runStart + 1 })
  }
  return $runs
}

# Density floor for run detection. We use a TWO-PASS approach:
#
#  Pass 1: high floor (15% of band height ~ 55px) finds compact "body core"
#          runs only — limbs / glow / lightning don't qualify, so even
#          tightly packed figures separate cleanly. This gives us the
#          number of figures and their core centers.
#
#  Pass 2: for each core, walk outward at a much lower floor (3%) until
#          we hit a real gap, capped halfway to the next core's edge so
#          bleed from neighbours can't sneak in. This recovers the full
#          per-character bbox INCLUDING extended limbs & energy effects.
$bandH = $bottom - $top + 1
$coreFloor = [Math]::Max(20, [int]($bandH * 0.15))
$bodyFloor = [Math]::Max(4,  [int]($bandH * 0.03))
Write-Output ("Pass 1 core floor: {0} ink px/col (band height {1})" -f $coreFloor, $bandH)
Write-Output ("Pass 2 body floor: {0} ink px/col" -f $bodyFloor)

$rawCores = Find-CharacterRuns -density $colInk -gapTol $RunGapTolerance -densityFloor $coreFloor
Write-Output ("Pass 1: detected {0} raw body cores:" -f $rawCores.Count)
foreach ($c in $rawCores) {
  Write-Output ("  - raw core [{0}..{1}] (w={2})" -f $c.Left, $c.Right, $c.Width)
}

# Drop tiny spurious cores (specular highlights, isolated glow clusters).
# A "real" character body core occupies roughly the body width (~100-150px
# at this resolution). Anything below 40% of the median core width is noise
# — merge it into the nearest large core.
$widthList = @($rawCores | ForEach-Object { $_.Width } | Sort-Object)
$medianW = $widthList[[int]([Math]::Floor($widthList.Count / 2))]
$minRealW = [Math]::Max(30, [int]($medianW * 0.4))
Write-Output ("Median core width: {0}; min real-core width: {1}" -f $medianW, $minRealW)

$realCores = New-Object System.Collections.ArrayList
foreach ($c in $rawCores) {
  if ($c.Width -ge $minRealW) {
    $null = $realCores.Add(@{ Left = $c.Left; Right = $c.Right; Width = $c.Width })
  } else {
    Write-Output ("  Dropping tiny core [{0}..{1}] (w={2}) as noise" -f $c.Left, $c.Right, $c.Width)
  }
}
$cores = $realCores
Write-Output ("Pass 1: kept {0} real body cores after noise filter." -f $cores.Count)

# Pass 2: for each pair of adjacent cores, find the COLUMN OF MINIMUM
# DENSITY between them — that's the natural valley separating the two
# figures, even when faint lightning glow connects them. Each frame's
# bbox runs from the previous valley (or 0 for the first frame) to the
# next valley (or img width-1 for the last).
function Find-Valley {
  param([int[]]$density, [int]$from, [int]$to)
  $minVal = [int]::MaxValue
  $minX = $from
  for ($x = $from; $x -le $to; $x++) {
    if ($density[$x] -lt $minVal) {
      $minVal = $density[$x]
      $minX = $x
    }
  }
  return $minX
}

# Build valley positions: valleys[i] is the boundary BETWEEN core i and
# core i+1. valleys[-1] = 0 conceptually, valleys[N-1] = width-1.
$valleys = New-Object int[] ($cores.Count - 1)
for ($i = 0; $i -lt $cores.Count - 1; $i++) {
  $from = $cores[$i].Right + 1
  $to   = $cores[$i + 1].Left - 1
  if ($to -lt $from) { $valleys[$i] = $from } else {
    $valleys[$i] = Find-Valley -density $colInk -from $from -to $to
  }
  Write-Output ("  Valley between core {0} and {1}: x={2} (density={3})" -f ($i + 1), ($i + 2), $valleys[$i], $colInk[$valleys[$i]])
}

# Per-frame bbox = (previous valley + 1) .. (next valley - 1). Then trim
# any pure-bg columns at the edges using the bodyFloor so we don't include
# wide whitespace regions (we want the bbox tight to the character).
$boxes = New-Object System.Collections.ArrayList
for ($i = 0; $i -lt $cores.Count; $i++) {
  $regionLeft  = if ($i -eq 0) { 0 } else { $valleys[$i - 1] + 1 }
  $regionRight = if ($i -eq $cores.Count - 1) { $src.Width - 1 } else { $valleys[$i] - 1 }

  # Trim leading/trailing bg within the region using the body floor.
  $left = $regionLeft
  for ($x = $regionLeft; $x -le $regionRight; $x++) {
    if ($colInk[$x] -ge $bodyFloor) { $left = $x; break }
  }
  $right = $regionRight
  for ($x = $regionRight; $x -ge $regionLeft; $x--) {
    if ($colInk[$x] -ge $bodyFloor) { $right = $x; break }
  }
  $null = $boxes.Add(@{ Left = $left; Right = $right; Width = $right - $left + 1 })
  Write-Output ("  - frame {0}: region [{1}..{2}] -> bbox [{3}..{4}] (w={5})" -f ($i + 1), $regionLeft, $regionRight, $left, $right, ($right - $left + 1))
}
$autoCount = $boxes.Count
Write-Output ("Auto-detected {0} character runs (gap tolerance: {1}px):" -f $autoCount, $RunGapTolerance)
foreach ($b in $boxes) {
  Write-Output ("  - [{0}..{1}] (w={2})" -f $b.Left, $b.Right, $b.Width)
}

# If the user requested a specific frame count and auto found something
# different, fall back to peak-NMS (per-character density peaks then
# midpoint-bounded bbox walk).
if ($FrameCount -gt 0 -and $autoCount -ne $FrameCount) {
  Write-Warning ("Auto-detect found {0} runs but FrameCount={1} requested. Falling back to peak-NMS." -f $autoCount, $FrameCount)
  $minSep = [int]([double]$src.Width / ($FrameCount * 1.5))
  $peaks = New-Object System.Collections.ArrayList
  $workCopy = $smoothed.Clone()
  for ($i = 0; $i -lt $FrameCount; $i++) {
    $maxVal = 0; $maxX = -1
    for ($x = 0; $x -lt $workCopy.Length; $x++) {
      if ($workCopy[$x] -gt $maxVal) { $maxVal = $workCopy[$x]; $maxX = $x }
    }
    if ($maxX -lt 0 -or $maxVal -le 0) { break }
    $null = $peaks.Add(@{ X = $maxX; V = $maxVal })
    for ($k = -$minSep; $k -le $minSep; $k++) {
      $xx = $maxX + $k
      if ($xx -ge 0 -and $xx -lt $workCopy.Length) { $workCopy[$xx] = 0 }
    }
  }
  $peaksSorted = @($peaks | Sort-Object { $_.X })
  $boxes = New-Object System.Collections.ArrayList
  for ($i = 0; $i -lt $peaksSorted.Count; $i++) {
    $px = $peaksSorted[$i].X; $pv = $peaksSorted[$i].V
    $leftBound = 0; $rightBound = $src.Width - 1
    if ($i -gt 0) { $leftBound = [int](($peaksSorted[$i - 1].X + $px) / 2) }
    if ($i -lt $peaksSorted.Count - 1) { $rightBound = [int](($px + $peaksSorted[$i + 1].X) / 2) }
    $cutoff = [Math]::Max(1, [int]([double]$pv * 0.08))
    $minRun = 6
    $left = $leftBound; $run = 0
    for ($x = $px - 1; $x -ge $leftBound; $x--) {
      if ($smoothed[$x] -lt $cutoff) { $run++; if ($run -ge $minRun) { $left = $x + $minRun; break } } else { $run = 0 }
    }
    $right = $rightBound; $run = 0
    for ($x = $px + 1; $x -le $rightBound; $x++) {
      if ($smoothed[$x] -lt $cutoff) { $run++; if ($run -ge $minRun) { $right = $x - $minRun; break } } else { $run = 0 }
    }
    $null = $boxes.Add(@{ Left = $left; Right = $right; Width = $right - $left + 1 })
  }
}

# Use whatever count we ended up with as the canonical frame count
$frameCountFinal = $boxes.Count
Write-Output ("Final frame count: {0}" -f $frameCountFinal)

# Pick frame width = max(box width) + horizontal padding * 2, so even the
# widest pose has padding on both sides. Force [int] because Measure-Object
# returns a boxed Object that GDI+'s Bitmap ctor refuses.
$maxBoxW = [int](($boxes | ForEach-Object { $_.Width } | Measure-Object -Maximum).Maximum)
$frameW = [int]($maxBoxW + $HorizontalPadding * 2)
$frameH = [int](($bottom - $top + 1) + $VerticalPadding * 2)
$totalW = [int]($frameW * $frameCountFinal)
Write-Output ("maxBoxW={0}, frameW={1}, frameH={2}, totalW={3}" -f $maxBoxW, $frameW, $frameH, $totalW)

# Composite: paste each box into its column, centered horizontally and
# bottom-aligned vertically within the column (so feet stay on the same
# baseline regardless of pose).
$out = New-Object System.Drawing.Bitmap -ArgumentList $totalW, $frameH
$g = [System.Drawing.Graphics]::FromImage($out)
$g.Clear([System.Drawing.Color]::White)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

for ($i = 0; $i -lt $frameCountFinal; $i++) {
  $box = $boxes[$i]
  $srcX = $box.Left
  $srcY = $top
  $srcW = $box.Width
  $srcH = $bottom - $top + 1
  $destX = $i * $frameW + [int](($frameW - $srcW) / 2)
  $destY = $VerticalPadding
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle $destX, $destY, $srcW, $srcH), $srcX, $srcY, $srcW, $srcH, [System.Drawing.GraphicsUnit]::Pixel)
}
$g.Dispose()
$src.Dispose()

$outFull = Join-Path (Get-Location) $OutputPath
$out.Save($outFull, [System.Drawing.Imaging.ImageFormat]::Png)
$out.Dispose()
Write-Output ("Wrote: {0}" -f $outFull)
Write-Output ("FrameAspect (W/H): {0:N4}" -f ([double]$frameW / [double]$frameH))
