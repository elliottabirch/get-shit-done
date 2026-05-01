# Leaky Workflow (shell)

## Step 1
Backup: `cp -r .planning/ /tmp/backup/`

## Step 2
Archive: `mv .planning/phases/old-phase /tmp/`

## Step 3
Reset: `rm -rf .planning/tmp/`

## Step 4
Append: `echo "fixture" >> .planning/SCRATCH.md`
