# Production Firebase Preparation

Production project:

```text
myappproject-f71fd
```

The existing `firebase.json`, `.firebaserc`, staging config, and staging backend remain unchanged. They continue to target `liftally-staging`.

## Generate the production Web App config

After Firebase CLI authentication is restored, run:

```bash
firebase login --reauth
firebase apps:list --project myappproject-f71fd
firebase apps:sdkconfig WEB --project myappproject-f71fd
```

Copy only the production Web App values into:

```text
firebase/firebase-config.production.js
```

Do not copy values from `firebase/firebase-config.staging.js`.

## Production page wiring

Production pages must load, in this order:

```html
<script src="firebase/firebase-config.production.js"></script>
<script type="module" src="firebase/liftally-production-backend.js"></script>
```

The production adapter rejects any Firebase app whose project ID is not `myappproject-f71fd`.

Production HTML is generated into `dist/production` by `scripts/build-production.mjs`. The source HTML files remain staging-compatible and are not modified by the production build.

## Local verification

After the production config placeholders have been filled, build and serve the isolated production output:

```bash
node scripts/build-production.mjs
python3 -m http.server 8088 --directory dist/production
```

Verify in the browser console:

```js
window.LIFTALLY_FIREBASE_ENV.environment
window.LIFTALLY_FIREBASE_ENV.firebaseConfig.projectId
window.liftallyBackend.environment
```

Expected values:

```text
production
myappproject-f71fd
production
```

Then verify anonymous authentication, account sign-in, snapshot save/history, and support-request submission against the production project. Use a dedicated test account and test records only.

## Explicit deployment commands

Staging remains:

```bash
firebase deploy --config firebase.json --project liftally-staging --only hosting
```

Production, only after review and approval:

```bash
node scripts/build-production.mjs
firebase deploy --config firebase.production.json --project myappproject-f71fd --only hosting
```

Do not use an unqualified `firebase deploy` from this repository.
