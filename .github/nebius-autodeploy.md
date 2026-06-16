# Nebius Autodeploy

This repository deploys the fork `tesla-prep/Cap` to the Nebius server from GitHub Actions.

## Required Repository Secrets

Set these in `tesla-prep/Cap` under Settings -> Secrets and variables -> Actions:

- `NEBIUS_HOST`: public IP or hostname of the Nebius VM
- `NEBIUS_USER`: SSH user on the VM
- `NEBIUS_SSH_KEY`: private SSH key allowed to connect to that user
- `NEBIUS_DEPLOY_PATH`: absolute path to the Cap checkout on the VM

Optional secrets:

- `NEBIUS_PORT`: SSH port, defaults to `22`
- `NEBIUS_DEPLOY_COMMAND`: custom command to run after the checkout is reset

If `NEBIUS_DEPLOY_COMMAND` is not set, the workflow runs:

```sh
docker compose up -d --build --remove-orphans
```

## Server Preparation

The Nebius VM should already have Docker Compose and a checkout of this fork:

```sh
git clone https://github.com/tesla-prep/Cap.git /opt/cap
cd /opt/cap
```

Keep the production `.env` on the server. The deploy workflow does not overwrite untracked files such as `.env`.

The SSH public key that matches `NEBIUS_SSH_KEY` must be present in the deploy user's `~/.ssh/authorized_keys`.

## Trigger

Deployment runs automatically on every push to `main` in `tesla-prep/Cap`. It can also be started manually from the `Deploy to Nebius` workflow in GitHub Actions.

The workflow resets the server checkout to the exact commit that triggered the run, then starts the services. It is pinned to this fork and will not run in `CapSoftware/Cap`.
