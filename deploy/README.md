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
  unbuffered and forwards upgrade and client-origin headers. It buffers large
  request bodies in `/var/lib/nginx/gcai-body`; install
  `nginx-body-tmpfiles.conf.example` as
  `/etc/tmpfiles.d/gcai-nginx-body.conf` to recreate that directory with
  `www-data:www-data` ownership and `0700` permissions. If the target Nginx
  worker uses another account or path, change the site and tmpfiles rule
  together.

## Install or update

1. Verify the approved two-repository release manifest: exact application and
   Gateway source commits, canonical archive hashes, actual artifact hashes,
   licensing/material reviews and deployment approval. Extract a release into
   a new directory without modifying the existing release. Check the member
   list against the approved Gateway runtime artifact.
2. Supply the private environment file and rendered unit/site files on the
   host. Back up the existing Nginx site file. Check the effective Nginx
   `user` directive, install the matching tmpfiles rule and create the request
   body directory before reloading Nginx:

   ```sh
   install -d -o www-data -g www-data -m 0700 /var/lib/nginx/gcai-body
   systemd-tmpfiles --create /etc/tmpfiles.d/gcai-nginx-body.conf
   stat -c '%U:%G %a %n' /var/lib/nginx/gcai-body
   nginx -t
   ```

   Confirm the systemd unit with `systemd-analyze verify`. Do not put
   credentials in command arguments, public files or the release archive.
3. Switch the `current` symlink to the verified versioned directory, reload
   systemd and restart only the Gateway service. Reload Nginx only after its
   config test succeeds. Check the Gateway process, proxy and public source
   entry against the immutable manifest; record the effective artifact
   digest and the previous symlink target. For an upload-path change, send a
   synthetic unauthenticated multipart body larger than Nginx's in-memory
   request buffer through the local HTTPS listener. The application may
   respond with JSON 401, but the proxy must not return an HTML 500 or log
   `Permission denied` for its request-body temp path. Do not use customer
   media for this check.

## Roll back

Restore the recorded previous `current` symlink target and its compatible
private environment file and rendered configuration, then restart the Gateway
service. If the site configuration changed, validate it before an Nginx
reload. Recheck the paired application/backend compatibility and the public
source entry for the restored version. Do not alter customer data or the
application database as part of a Gateway-only rollback. If rolling back the
request-body path, restore the previous site file, run `nginx -t`, then reload
Nginx; leave the dedicated directory and tmpfiles rule in place until no
in-flight upload uses them. Remove the rule and directory only during a
separate cleanup after confirming they contain no active request bodies.

The examples intentionally do not encode a real server address, domain,
certificate, environment value or credential. The installation record and
private deployment inventory must bind the exact rendered files to the
approved source/archive/artifact pair before publication or deployment.
