; CueLingo installer for Windows (Inno Setup 6). Built by scripts/windows-installer.mjs, which passes:
;   /DAppVersion=0.1.2  /DAppExe=<path to the built app exe>  /DSidecarExe=<path to cuelingo-audio.exe>
;   /DOutputDir=<folder for CueLingo-Windows-x64-setup.exe>
; Per-user install, no admin rights (ADR 0021). Vietnamese wizard from Vietnamese.isl (Inno Setup 6.7.1).

#ifndef AppVersion
  #error AppVersion is required
#endif
#ifndef AppExe
  #error AppExe is required
#endif
#ifndef SidecarExe
  #error SidecarExe is required
#endif
#ifndef OutputDir
  #define OutputDir "."
#endif

#define AppName "CueLingo"
#define Identifier "vn.cmcai.cuelingo"

[Setup]
; Never change AppId: Windows uses it to find the installed app for updates and uninstall.
AppId={{6F2C5E4A-8B1D-4C7E-9A3F-2D5B7C1E8F40}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher=CMC AI
AppPublisherURL=https://github.com/nguyendinhphongdx/CueLingo
AppSupportURL=https://github.com/nguyendinhphongdx/CueLingo/issues
VersionInfoVersion={#AppVersion}
DefaultDirName={localappdata}\Programs\{#AppName}
DisableProgramGroupPage=yes
DisableDirPage=auto
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
; Windows 10 22H2 and later.
MinVersion=10.0.19045
WizardStyle=modern
SetupIconFile=..\..\src-tauri\icons\icon.ico
UninstallDisplayIcon={app}\{#AppName}.exe
UninstallDisplayName={#AppName}
CloseApplications=yes
RestartApplications=no
Compression=lzma2/max
SolidCompression=yes
OutputDir={#OutputDir}
OutputBaseFilename=CueLingo-Windows-x64-setup

[Languages]
Name: "vi"; MessagesFile: "Vietnamese.isl"

[CustomMessages]
vi.DesktopIcon=Tạo lối tắt trên màn hình
vi.OpenApp=Mở CueLingo
vi.WebView2Missing=Máy chưa có Microsoft Edge WebView2, CueLingo cần nó để hiển thị. Bộ cài sẽ tải và cài WebView2 (cần mạng).
vi.WebView2Failed=Không cài được Microsoft Edge WebView2. Hãy cài thủ công từ trang của Microsoft rồi chạy lại bộ cài.

[Tasks]
Name: "desktopicon"; Description: "{cm:DesktopIcon}"; Flags: unchecked

[Files]
Source: "{#AppExe}"; DestDir: "{app}"; DestName: "{#AppName}.exe"; Flags: ignoreversion
Source: "{#SidecarExe}"; DestDir: "{app}"; DestName: "cuelingo-audio.exe"; Flags: ignoreversion

[Icons]
Name: "{userprograms}\{#AppName}"; Filename: "{app}\{#AppName}.exe"
Name: "{userdesktop}\{#AppName}"; Filename: "{app}\{#AppName}.exe"; Tasks: desktopicon

[Registry]
; Sign-in links (cuelingo://auth?...) open the app. The single-instance plugin hands them to a running app.
Root: HKCU; Subkey: "Software\Classes\cuelingo"; ValueType: string; ValueName: ""; ValueData: "URL:CueLingo"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\cuelingo"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\cuelingo\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: """{app}\{#AppName}.exe"",0"
Root: HKCU; Subkey: "Software\Classes\cuelingo\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#AppName}.exe"" ""%1"""

[Run]
Filename: "{app}\{#AppName}.exe"; Description: "{cm:OpenApp}"; Flags: nowait postinstall skipifsilent
; A silent update started from inside the app passes /CUELINGORELAUNCH so the new version opens again.
Filename: "{app}\{#AppName}.exe"; Flags: nowait; Check: IsRelaunch

[UninstallRun]
; The sign-in token lives in Credential Manager (keyring target name "<account>.<service>").
Filename: "{sys}\cmdkey.exe"; Parameters: "/delete:device-token.{#Identifier}"; Flags: runhidden; RunOnceId: "DeleteToken"

[UninstallDelete]
; App data on this machine (WebView2 profile, downloaded speech models). Nothing on the server is touched.
Type: filesandordirs; Name: "{localappdata}\{#Identifier}"

[Code]
const
  WebView2Client = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  WebView2Bootstrapper = 'https://go.microsoft.com/fwlink/p/?LinkId=2124703';

function IsRelaunch(): Boolean;
begin
  Result := Pos('/CUELINGORELAUNCH', Uppercase(GetCmdTail())) > 0;
end;

function HasWebView2Version(RootKey: Integer; const SubKey: String): Boolean;
var
  Version: String;
begin
  Result := RegQueryStringValue(RootKey, SubKey, 'pv', Version) and (Version <> '') and (Version <> '0.0.0.0');
end;

function WebView2Installed(): Boolean;
begin
  Result :=
    HasWebView2Version(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\' + WebView2Client) or
    HasWebView2Version(HKLM, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\' + WebView2Client) or
    HasWebView2Version(HKCU, 'Software\Microsoft\EdgeUpdate\Clients\' + WebView2Client);
end;

// Windows 11 and up-to-date Windows 10 already have WebView2; older machines get Microsoft's bootstrapper.
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Code: Integer;
begin
  Result := '';
  if WebView2Installed() then
    Exit;
  if not WizardSilent() then
    MsgBox(CustomMessage('WebView2Missing'), mbInformation, MB_OK);
  try
    DownloadTemporaryFile(WebView2Bootstrapper, 'MicrosoftEdgeWebview2Setup.exe', '', nil);
    if not Exec(ExpandConstant('{tmp}\MicrosoftEdgeWebview2Setup.exe'), '/silent /install', '',
      SW_HIDE, ewWaitUntilTerminated, Code) or not WebView2Installed() then
      Result := CustomMessage('WebView2Failed');
  except
    Result := CustomMessage('WebView2Failed');
  end;
end;
