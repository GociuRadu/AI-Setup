# One-time machine setup: WSL2 + Docker Engine (no Docker Desktop)

Template: replace `<...>` values. Everything runs in a WSL2 **Debian** distro; Windows only calls `wsl -d Debian -u root -- docker ...`. Docker Desktop is not needed (if it is installed, quit it so its CLI and WSL integration do not compete with the Debian engine).

## 1. Install or repair WSL (admin PowerShell)

```powershell
wsl --version                 # needs WSL 2.x from the Store/MSI, not the old inbox one
wsl --update
wsl --install -d Debian       # creates the distro; set a Linux user when asked
wsl -l -v                     # Debian must show VERSION 2
```

`Wsl/CallMsi/Install/REGDB_E_CLASSNOTREG` or `wsl` not working: run `wsl --update` (or install the latest `.msi` from https://github.com/microsoft/WSL/releases), then

```powershell
dism /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
```

and restart Windows. Virtualization must be on in BIOS/UEFI (Task Manager > Performance > CPU > Virtualization: Enabled).

## 2. Enable systemd in Debian

```bash
# inside Debian (wsl -d Debian)
printf '[boot]\nsystemd=true\n' | sudo tee /etc/wsl.conf
```

```powershell
wsl --shutdown
```

## 3. Install Docker Engine in Debian

```bash
sudo apt-get update && sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

Check from PowerShell:

```powershell
wsl -d Debian -u root -- docker run --rm hello-world
wsl -d Debian -u root -- docker compose version
```

## 4. RAM, CPU and swap (`.wslconfig`)

All containers share the WSL2 VM, so its limits are the Docker limits. Copy [wslconfig.example](wslconfig.example) to `%UserProfile%\.wslconfig`, adjust, then `wsl --shutdown`.

| Host RAM | `memory` | `processors` | `swap` |
|---|---|---|---|
| 16 GB | 10GB | 8 (or half the threads) | 4GB |
| 32 GB | 20GB | 12 | 8GB |
| 64 GB | 40GB | 16 | 8GB |

Leave about 6 GB for Windows, VS Code and the browser. Verify inside Debian: `free -h` and `nproc`.

Per-container budget (set in [docker-compose.yml](docker-compose.yml)):

| Service | Limit | Where |
|---|---|---|
| SQL Server | `mem_limit: 4g`, engine cap `MSSQL_MEMORY_LIMIT_MB=3072` (minimum 2 GB) | `sqlserver` |
| Spark runner | `mem_limit: 5g`, `SPARK_DRIVER_MEMORY=3g` | `runner` |

The sum must stay below `memory` in `.wslconfig`.

## 5. Storage

Images, containers and volumes live in `/var/lib/docker` inside the Debian virtual disk (`ext4.vhdx`, default under `%LocalAppData%\Packages\...` or `%LocalAppData%\wsl\`). Nothing is pre-allocated: the disk grows up to its maximum (default 1 TB).

| Task | Command (PowerShell unless noted) |
|---|---|
| Disk usage | `wsl -d Debian -u root -- docker system df` and `wsl -d Debian -- df -h /` |
| Free space | `wsl -d Debian -u root -- docker system prune` (add `-a` for unused images; `docker builder prune` for build cache) |
| Give freed space back to Windows automatically | `wsl --shutdown; wsl --manage Debian --set-sparse true` (or `sparseVhd=true` in `.wslconfig` for new distros) |
| Compact manually | `wsl --shutdown`, then `diskpart`: `select vdisk file="<path>\ext4.vhdx"`, `compact vdisk` |
| Raise the maximum size | `wsl --shutdown; wsl --manage Debian --resize <512GB>` |
| Move to another drive | `wsl --shutdown; wsl --manage Debian --move <D:\WSL\Debian>` |

`--manage` options need a recent WSL (`wsl --update`). The SQL container has no data volume, so test data never accumulates.

## 6. Optional: corporate TLS inspection

If `pip` or the Spark/Maven download in the runner build fails with a certificate error, export the company root CA as `.crt` into [runner/hostca/](runner/hostca/). The build trusts it for apt, pip and Java. Never disable TLS checks.

## 7. Done when

- `wsl -l -v` shows Debian, VERSION 2.
- `hello-world` runs through `wsl -d Debian -u root -- docker`.
- `free -h` in Debian shows the `.wslconfig` memory.
- `& '.\local\test.ps1' -Tier All` passes from `{{PROJECT}}/code`.
