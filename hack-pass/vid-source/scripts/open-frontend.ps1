param(
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][int]$Port,
    [int]$Delay = 10
)

# Waits for the frontend dev server, then opens it in the default browser -
# but only while the port is still accepting connections, so shutting the
# servers down quickly never opens a dead page.
Start-Sleep -Seconds $Delay

$client = New-Object Net.Sockets.TcpClient
try {
    $client.Connect('127.0.0.1', $Port)
    Start-Process $Url
} catch {
    # Port never came up (or the servers were already stopped) - stay quiet.
} finally {
    $client.Dispose()
}
