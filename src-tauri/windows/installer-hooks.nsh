!macro NSIS_HOOK_POSTINSTALL
  ; Add install directory to user PATH (if not already present)
  nsExec::ExecToLog 'powershell -ExecutionPolicy Bypass -Command "\
    $instDir = ''$INSTDIR''; \
    $current = [Environment]::GetEnvironmentVariable(''Path'', ''User''); \
    if ($current -split '';'' -notcontains $instDir) { \
      [Environment]::SetEnvironmentVariable(''Path'', ($current.TrimEnd('';'') + '';'' + $instDir), ''User''); \
      Add-Type -Namespace Win32 -Name NativeMethods -MemberDefinition ''[DllImport(\"user32.dll\", SetLastError = true, CharSet = CharSet.Auto)] public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);''; \
      $result = [UIntPtr]::Zero; \
      [Win32.NativeMethods]::SendMessageTimeout([IntPtr]0xFFFF, 0x1A, [UIntPtr]::Zero, ''Environment'', 2, 5000, [ref]$result) | Out-Null; \
    }"'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; Remove install directory from user PATH
  nsExec::ExecToLog 'powershell -ExecutionPolicy Bypass -Command "\
    $instDir = ''$INSTDIR''; \
    $current = [Environment]::GetEnvironmentVariable(''Path'', ''User''); \
    $parts = ($current -split '';'') | Where-Object { $_ -ne $instDir -and $_ -ne '''' }; \
    [Environment]::SetEnvironmentVariable(''Path'', ($parts -join '';''), ''User''); \
    Add-Type -Namespace Win32 -Name NativeMethods -MemberDefinition ''[DllImport(\"user32.dll\", SetLastError = true, CharSet = CharSet.Auto)] public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);''; \
    $result = [UIntPtr]::Zero; \
    [Win32.NativeMethods]::SendMessageTimeout([IntPtr]0xFFFF, 0x1A, [UIntPtr]::Zero, ''Environment'', 2, 5000, [ref]$result) | Out-Null; \
  "'
!macroend
