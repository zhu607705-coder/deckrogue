# GitHub SSH Over 443 Setup

DeckRogue has seen repeated HTTPS Git transport failures on this Windows checkout, while `ssh.github.com:443` stayed reachable. Use a persistent GitHub SSH key plus a host override so normal GitHub remotes use the SSH-over-443 path without temporary deploy keys.

## 1. Create A Dedicated Key

Run this in PowerShell:

```powershell
ssh-keygen -t ed25519 -C "zhu607705-coder@deckrogue" -f "$env:USERPROFILE\.ssh\id_ed25519_github"
```

Keep the private key file on this machine. Only upload the `.pub` file.

## 2. Register The Public Key

If GitHub CLI is logged in as `zhu607705-coder`, register the public key:

```powershell
gh ssh-key add "$env:USERPROFILE\.ssh\id_ed25519_github.pub" --title "Windows DeckRogue SSH key"
```

If GitHub CLI reports that the token needs `admin:public_key`, register the same public key as a repo-scoped writable deploy key instead:

```powershell
$pub = Get-Content -LiteralPath "$env:USERPROFILE\.ssh\id_ed25519_github.pub" -Raw
gh api repos/zhu607705-coder/deckrogue/keys -X POST -f title='Windows DeckRogue SSH-over-443 key' -f key="$pub" -F read_only=false
```

This narrower fallback is sufficient for this checkout and avoids requiring account-wide SSH key administration.

## 3. Route GitHub SSH Through Port 443

Add this stanza to `$env:USERPROFILE\.ssh\config`:

```text
Host github.com
  HostName ssh.github.com
  User git
  Port 443
  IdentityFile ~/.ssh/id_ed25519_github
  IdentitiesOnly yes
```

## 4. Use The Canonical SSH Remote

From `E:\deckrogue\deckrogue`:

```powershell
git remote set-url origin git@github.com:zhu607705-coder/deckrogue.git
```

The `github.com` host remains in the remote URL; the SSH config maps it to `ssh.github.com` on port `443`.

## 5. Verify The Local Checkout

Run:

```powershell
npm run check:github-transport
ssh -T git@github.com
git ls-remote origin HEAD
```

Expected shape:

- `npm run check:github-transport` reports `OK`.
- `ssh -T git@github.com` authenticates as the GitHub account and may say shell access is unavailable.
- `git ls-remote origin HEAD` prints a remote commit hash.

## 6. If It Fails

- If `origin` is still `https://github.com/...`, rerun `git remote set-url origin git@github.com:zhu607705-coder/deckrogue.git`.
- If `github.com` resolves to port `22`, recheck `$env:USERPROFILE\.ssh\config`.
- If no identity file is found, check that `id_ed25519_github` exists and that `IdentityFile` points to it.
- If authentication is denied, confirm the `.pub` key is registered in GitHub for `zhu607705-coder`.
