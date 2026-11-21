param(
    [Parameter(Mandatory = $true)][string]$WorkDir,
    [Parameter(Mandatory = $true)][string]$Line
)

# Starts `cmd /c "<Line>"` in a HIDDEN window with the working directory set to
# $WorkDir, then prints the process id so run.bat can kill the whole tree later.
#
# $Line is used verbatim - it must not contain double quotes. Any redirection
# (e.g. `> logs\backend.log 2>&1`) is performed by that hidden cmd, relative to
# $WorkDir.
$cmdLine = '/c "' + $Line + '"'

$proc = Start-Process -FilePath "cmd.exe" -ArgumentList $cmdLine `
    -WorkingDirectory $WorkDir -WindowStyle Hidden -PassThru

$proc.Id
