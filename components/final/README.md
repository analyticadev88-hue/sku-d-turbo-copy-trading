# SkuD Turbo MT5 Bridge

This folder contains the Windows VPS bridge for SkuD Turbo. It accepts demo MT5
credentials from the website server API, starts one portable MT5 terminal per
student account, and has the SkuD student EA execute mentor trade events. MT5
passwords are currently stored unencrypted in the bridge SQLite database and
terminal startup files. Use demo accounts on a controlled VPS only.

## VPS layout

- Bridge files and scripts: `C:\skud\final`
- Master MT5 template: `C:\skud\mt5-master`
- Student portable terminals: `C:\skud\terminals\SlotNNN`
- Bridge database: `C:\skud\final\data\skud.sqlite3`
- Persistent DPAPI bridge key: `C:\ProgramData\SkuD\bridge-key.dpapi`
- Public bridge URL: `https://skud.toporapula.dev`
- Website: `https://skudturbo.vercel.app`

`start-bridge.ps1` and `start-all.ps1` use these paths by default. Optional
`SKUD_TERMINAL_MASTER`, `SKUD_TERMINALS_DIR`, `SKUD_EA_SOURCE`, and
`SKUD_CHART_TEMPLATE` environment variables override them.

## 1. Prepare the master MT5 terminal

Copy the installed MT5 terminal into the SkuD master directory once:

```powershell
New-Item -ItemType Directory -Force C:\skud\mt5-master | Out-Null
robocopy "C:\Program Files\MetaTrader 5" "C:\skud\mt5-master" /E
```

Open it in portable mode:

```powershell
& C:\skud\mt5-master\terminal64.exe /portable
```

Log in to a Deriv demo account to cache the server, then log out. Keep this
master terminal separate from student terminals. Do not place it under the
student slots directory.

## 2. Compile and save the SkuD EA template

1. Copy `SkuDTurboBridgeEA.mq5` to
   `C:\skud\mt5-master\MQL5\Experts\SkuDTurboBridgeEA.mq5`. Compile it in
   MetaEditor with **F7**, leaving the EA input `EaToken` blank in the master
   template. Confirm
   `C:\skud\mt5-master\MQL5\Experts\SkuDTurboBridgeEA.ex5` exists.
2. Attach `SkuDTurboBridgeEA` to a chart in the master terminal. Set
   `BridgeUrl` to `http://127.0.0.1:8765`, enable Algo Trading, and allow
   WebRequest to `http://127.0.0.1:8765`.
3. Save the chart profile as `SkuD`, then close the master terminal. Confirm
   `C:\skud\mt5-master\MQL5\Profiles\Charts\SkuD\chart01.chr` exists.
4. Start `C:\skud\final\start-bridge.ps1`. It generates or reads the persistent
   bridge key and prints it once. Set that value as `SKUD_BRIDGE_KEY` in the
   Vercel server environment. Never put this key in a `NEXT_PUBLIC_` variable or
   source control. On provisioning, the launcher injects it into each copied
   student chart profile. Restart the bridge after setting its server-side key.

The bridge copies this EA and chart file into each newly provisioned student
terminal. Each slot receives its own `startup.ini` with that student's login,
password, and broker server. Do not add student credentials to the master
profile.

## 3. DNS, Caddy, and firewall

The Caddyfile serves `skud.toporapula.dev` and proxies to
`127.0.0.1:8765`. Its A record must point to `46.224.112.35`. Keep the existing
JoeMoney hostname `bridge.toporapula.dev` unchanged. Allow inbound TCP 80 and
443 in Windows Firewall and the VPS provider firewall; do not expose port 8765.

The DNS zone must authorize Caddy's certificate issuer. Add
`CAA 0 issue "letsencrypt.org"` alongside existing CAA records if it is not
already allowed. Place `caddy.exe` in `C:\skud\final`, `C:\Caddy`, or on PATH.

Check the bridge after startup:

```powershell
Invoke-RestMethod https://skud.toporapula.dev/health
```

The unauthenticated account endpoint should return `Unauthorized` in a browser;
that is expected. The health endpoint should return `status: ok`.

## 4. Vercel server environment

Set these **server-only** variables on the `skudturbo.vercel.app` Vercel project,
then redeploy. Use separate random values for the bridge key, demo enrollment
code, and mentor setup code.

```text
SKUD_BRIDGE_URL=https://skud.toporapula.dev
SKUD_BRIDGE_KEY=<same key used by bridge and EA>
SKUD_DEFAULT_MENTOR_ID=mentor-skud-01
SKUD_STUDENT_ENROLLMENT_CODE=<separate long random demo invite code>
SKUD_ALLOW_DEMO_STUDENT_ENROLLMENT=true
SKUD_ALLOW_LIVE_STUDENT_ACCOUNTS=false
SKUD_MENTOR_SETUP_CODE=<separate long random operator code>
```

Never enable live student accounts for this pilot. The bridge key is server-only;
students only receive the separate enrollment code.

## 5. Start the SkuD services

Allow inbound HTTP and HTTPS in Windows Firewall if the VPS firewall does not
already allow them:

```powershell
New-NetFirewallRule -DisplayName "SkuD Caddy HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "SkuD Caddy HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

Then start both services from the uploaded folder:

```powershell
Set-Location C:\skud\final
.\start-all.ps1
```

Keep the Caddy and bridge windows open. The master terminal is a template only;
leave it closed while student slots are operating. Do not run `start-all.ps1` a
second time while services are already running.

Run the read-only audit at any time:

```powershell
Set-Location C:\skud\final
.\audit-vps.ps1
```

## 6. Register the mentor and test a demo student

After the bridge health check succeeds, register the mentor through the
protected `POST /api/admin/mentors` route using `SKUD_MENTOR_SETUP_CODE`. The
response returns a one-time `mentorToken`; enter that value in
`SkuDTurboMentorEA.mq5` on the mentor's demo account. Compile the mentor EA and
allow WebRequest to `https://skud.toporapula.dev` in MT5.

Enable demo enrollment only after mentor registration and the student EA/chart
template are ready. Submit a Deriv demo login, trading password, server, and
student enrollment code from the website. The dashboard should show the actual
login/server and wait for a matching EA heartbeat before reporting connected.
Verify the test account and copied trades in MT5 before inviting anyone else.

Run bridge regression tests from this folder:

```powershell
python -m unittest discover -s . -p test_bridge.py -v
```

## Security and limitations

- MT5 passwords are stored in plaintext in `data\skud.sqlite3` and slot
  `startup.ini` files. This is demo-only until encryption at rest, user
  authentication, rate limiting, and access controls are implemented.
- The bridge response means a command was accepted, not that a broker executed
  it. Confirm fills and account state in MT5.
- Copy support currently covers market opens and full closes. Symbol mapping,
  lot scaling, pending order changes, partial closes, and SL/TP modifications
  are not implemented.
- Do not share bridge keys, mentor tokens, or MT5 passwords.
