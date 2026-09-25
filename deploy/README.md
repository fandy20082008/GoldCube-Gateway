# Gateway installation and rollback template

These files document the Gateway service and reverse-proxy inputs. They are
templates, not the live configuration. Replace every `{{...}}` placeholder for
the target host, validate the rendered files there, and keep values, TLS keys,
credentials and customer data outside the source archive.

## Inputs

- A compatible Node.js runtime, a dedicated unprivileged service account and a
  versioned release directory. The selected release must contain `serve.js`,
  `app.js`, `redesign.css`, the HTML pages, `logo.svg`, `icon.svg` and the three
  referenced `gallery-assets/*-original.svg` files. Include `LICENSE`,
  `NOTICE` and `THIRD_PARTY_NOTICES` in the runtime package and preserve their
  exact bytes in the release record.
- A private environment file readable by the service account, with
  `NODE_ENV`, `PORT`, `GOLDCUBE_BACKEND_HOST` and `GOLDCUBE_BACKEND_PORT`.
  Optional runtime settings in `serve.js` include
  `GOLDCUBE_VOICEPRO_SESSION` and `GOLDCUBE_LOGICAL_MODELS_TTL_MS`; store any
  secret only in the private environment file. This repository does not
  provide environment values. Match the backend to the paired application
  release and restrict network access according to the host topology.
- Render `goldcube-gateway.service.example` with the service account,
  absolute current-release directory, private environment-file path and Node
  binary path. Render `nginx-upgrade-map.conf.example` into the Nginx `http`
  context and `nginx-gateway.conf.example` as a site. Set domain, TLS paths and
  loopback Gateway origin for that host. The site keeps streaming responses
  unbuffered and forwards upgrade and client-origin headers.

## Install or update

1. Verify the approved two-repository release manifest: exact application and
   Gateway source commits, canonical archive hashes, actual artifact hashes,
   licensing/material reviews and deployment approval. Extract a release into
   a new directory without modifying the existing release. Check the member
   list against the approved Gateway runtime artifact.
2. Supply the private environment file and rendered unit/site files on the
   host. Check permissions and validate the rendered Nginx configuration with
   `nginx -t`; confirm the systemd unit with `systemd-analyze verify`. Do not
   put credentials in command arguments, public files or the release archive.
3. Switch the `current` symlink to the verified versioned directory, reload
   systemd and restart only the Gateway service. Reload Nginx only after its
   config test succeeds. Check the Gateway process, proxy and public source
   entry against the immutable manifest; record the effective artifact
   digest and the previous symlink target.

## Roll back

Restore the recorded previous `current` symlink target and its compatible
private environment file and rendered configuration, then restart the Gateway
service. If the site configuration changed, validate it before an Nginx
reload. Recheck the paired application/backend compatibility and the public
source entry for the restored version. Do not alter customer data or the
application database as part of a Gateway-only rollback.

The examples intentionally do not encode a real server address, domain,
certificate, environment value or credential. The installation record and
private deployment inventory must bind the exact rendered files to the
approved source/archive/artifact pair before publication or deployment.
