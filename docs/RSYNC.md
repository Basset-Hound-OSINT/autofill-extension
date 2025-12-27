# Rsync Deployment Guide

## Remote Testing Server

| Property | Value |
|----------|-------|
| Host | `192.168.0.7` |
| User | `devel` |
| Path | `~/Desktop/autofill-extension/` |
| Environment | Ubuntu with Chrome and Xvfb |
| Node.js | 20.x |

---

## Basic Sync Commands

### Standard Sync
```bash
rsync -avz --exclude='.git' --exclude='node_modules' \
  /home/devel/autofill-extension/ \
  devel@192.168.0.7:~/Desktop/autofill-extension/
```

### Mirror Sync (with delete)
```bash
rsync -avz --delete --exclude='.git' --exclude='node_modules' \
  /home/devel/autofill-extension/ \
  devel@192.168.0.7:~/Desktop/autofill-extension/
```

### Dry Run (preview changes)
```bash
rsync -avzn --delete --exclude='.git' --exclude='node_modules' \
  /home/devel/autofill-extension/ \
  devel@192.168.0.7:~/Desktop/autofill-extension/
```

---

## Options Reference

| Option | Description |
|--------|-------------|
| `-a` | Archive mode (preserves permissions, timestamps, symlinks) |
| `-v` | Verbose output |
| `-z` | Compress data during transfer |
| `-n` | Dry run (show what would be transferred) |
| `--delete` | Delete files on remote that don't exist locally |
| `--exclude` | Skip specified files/directories |
| `--progress` | Show transfer progress |

---

## Recommended Excludes

```bash
--exclude='.git'
--exclude='node_modules'
--exclude='.DS_Store'
--exclude='*.log'
--exclude='.env'
--exclude='coverage/'
```

---

## Post-Sync Commands

After syncing, run on remote server:

```bash
# SSH to remote
ssh devel@192.168.0.7

# Navigate to project
cd ~/Desktop/autofill-extension

# Install dependencies
npm install

# Run tests with Xvfb
xvfb-run --auto-servernum npm test

# Or with real display
DISPLAY=:1 npm test
```

---

## One-Liner Sync + Test

```bash
rsync -avz --delete --exclude='.git' --exclude='node_modules' \
  /home/devel/autofill-extension/ \
  devel@192.168.0.7:~/Desktop/autofill-extension/ && \
ssh devel@192.168.0.7 "cd ~/Desktop/autofill-extension && npm install && xvfb-run --auto-servernum npm test"
```

---

*Last Updated: December 27, 2024*
