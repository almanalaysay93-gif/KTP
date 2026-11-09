; Never force-kill the local database during an update or uninstall.
!macro customCheckAppRunning
  ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
  ${If} $R0 == 0
    IfSilent ktpRunningSilent ktpRunningInteractive
    ktpRunningInteractive:
      MessageBox MB_OK|MB_ICONEXCLAMATION "Please close KTP before updating or uninstalling. Wait for the local workspace to finish shutting down, then run this installer again."
    ktpRunningSilent:
      SetErrorLevel 2
      Quit
  ${EndIf}
!macroend
