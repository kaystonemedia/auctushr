; Custom NSIS steps for the Auctushr Monitor installer (electron-builder "nsis.include").

; Replaces electron-builder's default "app is running" check. The app hides to the
; tray when asked to close, so the default polite close never finishes and users get
; "Auctushr Monitor cannot be closed". Instead, force-close every running copy (all
; its Electron processes) before installing, with no prompt. The installer then
; starts the new version (runAfterFinish).
!macro customCheckAppRunning
  DetailPrint "Closing Auctushr Monitor..."
  nsExec::Exec '"$SYSDIR\taskkill.exe" /f /t /im "${APP_EXECUTABLE_FILENAME}"'
  Pop $0
  ; Give Windows a moment to release the app's files, then make sure nothing restarted
  Sleep 1500
  nsExec::Exec '"$SYSDIR\taskkill.exe" /f /t /im "${APP_EXECUTABLE_FILENAME}"'
  Pop $0
  Sleep 500
!macroend
