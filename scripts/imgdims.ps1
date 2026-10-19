Add-Type -AssemblyName System.Drawing
$paths = @(
  'public/poc/poc-mech-glint-sprite.png',
  'public/poc/poc-mech-glint-punch-strip.png',
  'public/poc/poc-mech-baron-sprite.png'
)
foreach ($p in $paths) {
  if (Test-Path $p) {
    $img = [System.Drawing.Image]::FromFile((Resolve-Path $p))
    Write-Output ("{0}: {1}x{2} (aspect W/H = {3:N3})" -f $p, $img.Width, $img.Height, ($img.Width / $img.Height))
    $img.Dispose()
  } else {
    Write-Output ("{0}: missing" -f $p)
  }
}
