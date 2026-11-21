# Hello Game

The reference Polynux integration: `server.ts` (Bun, uses `jose`) and `index.html`, no framework.

```sh
# once: a developer token from /settings/developer, then register the app
curl -s -X POST $HUB/api/v1/developer/apps -H "Authorization: Bearer $PNX_DEV_TOKEN" \
  -H 'Content-Type: application/json' -d '{"id":"hello-yourname","name":"Hello Game","baseUrl":"http://localhost:3300"}'

PNX_HUB_URL=$HUB PNX_APP_ID=hello-yourname PNX_APP_KEY=pnx_… bun examples/hello-game/server.ts
```

Then open `$HUB/play/hello-yourname` (it is a draft: only you and admins see it), or test without a browser
with `POST /api/v1/developer/apps/hello-yourname/test-launch` and `POST http://localhost:3300/api/session`.
In your own repo, `bun add jose` first. Set `PNX_REPO_URL=https://github.com/me/my-game` to show players
where the code lives.
