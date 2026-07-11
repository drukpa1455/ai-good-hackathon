# DigitalOcean demo lease

This runbook creates real DigitalOcean components only after the controlled
cloud ledger is approved for one merged Git revision. It intentionally keeps
the graph release in the app and gives the model only a bounded Function result.
No Knowledge Base is required for the critical demo path.

## Before any cloud write

Record all of the following outside Git: approved Git SHA, DigitalOcean project
ID, exact App/Functions/Agent region pairing, App name, Function namespace and
name, Agent name, live `glm-5.2` model UUID, two generated secrets, prepaid
inference limit, total spend ceiling, public-window start/end, teardown
deadline, and operator.

Verify read-only first:

```bash
test -z "$(git status --short)"
test "$(git rev-parse HEAD)" = "$APPROVED_GIT_SHA"
git fetch origin
test "$(git rev-parse origin/main)" = "$APPROVED_GIT_SHA"
doctl apps list-regions
doctl apps spec validate .do/app.yaml --schema-only
doctl serverless namespaces list-regions
doctl gradient list-regions
doctl gradient list-models
doctl apps list
doctl serverless namespaces list
doctl gradient agent list
```

The tracked `.do/app.yaml` uses the candidate App region `tor`; Agent Platform
and Functions typically use the paired `tor1` identifier. Do not assume that
pair is available: the commands above decide the approved values. If it is not
compatible, render an approved spec under `tmp/do-demo/` and preserve the
tracked baseline.

Generate two distinct values outside Git:

```bash
# Keep the generated values in a password manager or the approved secret store;
# do not echo, commit, or paste them into shell history.
FUNCTION_TO_APP_TOKEN="$(openssl rand -hex 32)"
FUNCTION_WEB_SECRET="$(openssl rand -hex 32)"
```

`FUNCTION_TO_APP_TOKEN` is the App's Function-to-app Bearer credential.
`FUNCTION_WEB_SECRET` is the unrelated DigitalOcean secure-web credential.

## Provision in dependency order

1. Merge the approved revision, then create the App from `.do/app.yaml` with
   `deploy_on_push: false`. It starts with `AGENT_ENABLED=false`:

   ```bash
   doctl apps create \
     --spec .do/app.yaml \
     --project-id "$DIGITALOCEAN_PROJECT_ID" \
     --wait
   ```
2. Read back the App URL, deployed commit SHA, health response, and public API.
   The source branch must not drift from the approved SHA:

   ```bash
   curl --fail --silent "$APP_URL/healthz" | jq -e \
     --arg sha "$APPROVED_GIT_SHA" '.status == "ok" and .git_sha == $sha'
   curl --fail --silent "$APP_URL/api/sites"
   ```

   If the SHA differs, stop rather than deploying a moving branch. Keep the
   Agent private and either delete the App or return to the prior known-good
   revision before continuing.

3. Add `FUNCTION_TO_APP_TOKEN` to the App service as an encrypted `RUN_TIME`
   variable. Do not put the value in a tracked app spec or shell history.
   Before and after any App configuration update, repeat the `origin/main` and
   `/healthz` SHA checks above; an App update must never silently advance the
   approved revision.
4. Create a new Function namespace in the approved Functions region. Do not
   reuse a stale local serverless connection. Read back the exact `fn-...`
   namespace ID, connect to it explicitly, and confirm that connection before
   deployment:

   ```bash
   doctl serverless install
   doctl serverless namespaces create \
     --label "$FUNCTION_NAMESPACE_LABEL" \
     --region "$FUNCTION_REGION"
   doctl serverless namespaces list
   # Copy the exact fn-... ID from the readback into FUNCTION_NAMESPACE.
   doctl serverless connect "$FUNCTION_NAMESPACE"
   doctl serverless status
   ```

   Then render an ignored environment file from `functions/.env.example` under
   `tmp/do-demo/`. Set `APP_AGENT_CONTEXT_URL` to
   `$APP_URL/internal/agent/context` and both generated secrets.
5. Deploy once; the Function itself makes one five-second POST and never
   retries:

   ```bash
   doctl serverless deploy functions --env tmp/do-demo/functions.env
   doctl serverless functions list
   ```

   Directly smoke the secured Function before creating an Agent. Resolve its
   URL from the currently connected namespace rather than composing one:

   ```bash
   FUNCTION_URL="$(doctl serverless functions get context/get_site_context --url)"
   curl --fail --silent --show-error -X POST "$FUNCTION_URL" \
     -H "X-Require-Whisk-Auth: $FUNCTION_WEB_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"site":"3956008","focus":"overview","question":"What evidence supports the affordable-unit figure?"}' \
     | jq -e '(.status // .body.status) == "ok"'
   ```

6. Create one **private** Agent using the exact live `glm-5.2` model UUID and
   [the tracked instructions](agent-instructions.md). Resolve and record the
   returned Agent ID, then create one short-lived private smoke key outside Git:

   ```bash
   doctl gradient agent create \
     --name "$AGENT_NAME" \
     --project-id "$DIGITALOCEAN_PROJECT_ID" \
     --model-id "$RESOLVED_GLM_5_2_MODEL_UUID" \
     --region "$AGENT_REGION" \
     --instruction "$(cat ops/agent-instructions.md)"
   doctl gradient agent list
   doctl gradient agent apikeys create \
     --name "groundwork-private-smoke" \
     --agent-id "$AGENT_ID"
   ```

   Resolve the deployed Function name and namespace from the Functions
   readback; do not guess them. Attach the route with the current CLI and
   checked-in scalar schemas:

   ```bash
   INPUT_SCHEMA="$(jq -c '.input_schema' ops/agent-function-route.json)"
   OUTPUT_SCHEMA="$(jq -c '.output_schema' ops/agent-function-route.json)"
   doctl gradient agent functionroute create \
     --agent-id "$AGENT_ID" \
     --name "$(jq -r '.name' ops/agent-function-route.json)" \
     --description "$(jq -r '.description' ops/agent-function-route.json)" \
     --faas-name "$FAAS_NAME" \
     --faas-namespace "$FUNCTION_NAMESPACE" \
     --input-schema "$INPUT_SCHEMA" \
     --output-schema "$OUTPUT_SCHEMA"
   ```

7. Put the newly shown endpoint key in an ignored local environment variable
   and run private probes against `$AGENT_ENDPOINT/api/v1/chat/completions`.
   This request proves Function use before visibility changes:

   ```bash
   curl --fail --silent --show-error -X POST \
     "$AGENT_ENDPOINT/api/v1/chat/completions" \
     -H "Authorization: Bearer $AGENT_ACCESS_KEY" \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"What evidence supports the 425 affordable-unit figure at 300 De Haro?"}],"stream":false,"include_functions_info":true}'
   ```

   Record only trace IDs/results, not prompts, packets, credentials, or
   transcripts. Required probes:

   - factual: `What evidence supports the 425 affordable-unit figure at 300 De Haro?`
   - uncertainty: `What remains uncertain about 758/772 Pacific Avenue?`
   - scope refusal: `Is 300 De Haro a safe investment?`
   - ambiguity: `What is happening at this site?`

   Each site-specific answer must have a Function trace, packet URLs only,
   fixture disclosure, and the required limitations. Failure keeps the Agent
   private and the App chat-disabled.

8. Only after private probes pass, make the Agent public for the approved
   window, add **only** the exact generated App domain to the chatbot's allowed
   domains, and copy the generated widget values from the DigitalOcean snippet.
   Add these non-secret App runtime variables, then deploy the same approved
   revision:

   ```text
   AGENT_ENABLED=true
   AGENT_SCRIPT_URL=https://<agent>.ondigitalocean.app/static/chatbot/widget.js
   AGENT_ID=<generated data-agent-id>
   AGENT_CHATBOT_ID=<generated data-chatbot-id>
   AGENT_NAME=Groundwork SF
   AGENT_STARTING_MESSAGE=Ask about one of the three demo sites. I will inspect its evidence graph first.
   AGENT_PRIMARY_COLOR=#5b4bc4
   AGENT_SECONDARY_COLOR=#1a1822
   AGENT_BUTTON_BACKGROUND_COLOR=#5b4bc4
   ```

   The browser receives no credential. The DigitalOcean widget owns streaming,
   history, rendering, and feedback; this repository must not add a chat proxy.
9. Run desktop and mobile browser smoke on the generated App URL. Confirm the
   widget loads only on the allowed domain, the agent corner does not overlap
   product controls, and the evidence explorer remains usable with chat off.

## Teardown and readback

At the end of the approved public window, reverse dependencies in this order:

1. Disable the widget runtime config and make the Agent private.
2. Delete the Agent (and optional methodology-only Knowledge Base, if one was
   separately created and verified).
3. Delete the Function namespace.
4. Delete the App.

Before revoking the operator credential, record final App/Function/Agent
inventory and billing/cost readback. If any create or delete result is
ambiguous, inventory first; never retry an unknown-success mutation blindly.

## Sources

- [App specification](https://docs.digitalocean.com/products/app-platform/reference/app-spec/)
- [App runtime variables](https://docs.digitalocean.com/products/app-platform/how-to/use-environment-variables/)
- [Functions project configuration](https://docs.digitalocean.com/products/functions/reference/project-configuration/)
- [Agent Function routing](https://docs.digitalocean.com/products/inference/how-to/route-agent-functions/)
- [Using Agents and chatbot allowed domains](https://docs.digitalocean.com/products/inference/how-to/use-agents/)
