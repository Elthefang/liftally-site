# Liftally Website Staging Backend Plan

This is the staging-only plan for website authentication, benchmark snapshots, and support requests.

## Environment

- Firebase project: `liftally-staging`
- Web app: `Liftally Website Staging`
- Production project `myappproject-f71fd` is intentionally not configured in this repo yet.
- Do not deploy these rules to production until the app paths and production rules have been compared.

## Enabled Products

For staging, enable:

- Firebase Authentication
- Cloud Firestore

Recommended staging auth providers:

- Email/password
- Anonymous

Do not enable billing, Functions, or Hosting for this phase unless explicitly approved.

## Collections

### `users/{userId}`

Owner-only profile stub for website-created accounts.

Required fields:

```json
{
  "schemaVersion": 1,
  "uid": "firebase-auth-uid",
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

Optional fields:

```json
{
  "email": "user@example.com",
  "displayName": "User"
}
```

### `users/{userId}/benchmarkSnapshots/{snapshotId}`

Owner-only saved Weight Class Explorer snapshot.

V1 web saves should be full-SBD snapshots only.

Required fields:

```json
{
  "schemaVersion": 1,
  "ownerUid": "firebase-auth-uid",
  "source": "web_weight_class_explorer",
  "standardKey": "usapl",
  "standardLabel": "USAPL",
  "sex": "men",
  "unit": "kg",
  "bodyweight": 82.5,
  "bodyweightKg": 82.5,
  "squat": 220,
  "bench": 140,
  "deadlift": 260,
  "totalKg": 620,
  "dots": 400.22,
  "ipfGl": 78.11,
  "weightClassKg": "90",
  "classRange": "over 82.5kg to 90kg",
  "testedStatus": "tested",
  "benchmarkStandard": "USAPL",
  "totalPercentileBand": "P75",
  "dotsPercentileBand": "P75",
  "benchmarkSampleSize": 4456,
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

Optional fields:

```json
{
  "sourceDataAsOf": "2026-05-10",
  "methodologyVersion": "2.0"
}
```

### `supportRequests/{requestId}`

Authenticated support/feedback request. Anonymous Auth may be used for users who are not ready to create a full account.

Required fields:

```json
{
  "schemaVersion": 1,
  "requesterUid": "firebase-auth-uid",
  "source": "weight_class_explorer",
  "type": "competition_planner_access",
  "message": "I want to compare class snapshots over time.",
  "email": "user@example.com",
  "createdAt": "serverTimestamp",
  "status": "open"
}
```

## Rules Intent

- Users can read and write only their own profile and benchmark snapshots.
- Support requests are create-only from signed-in users.
- Public clients cannot read the support request inbox.
- Public clients can read published benchmark version metadata later.
- All unknown paths are denied.

## Safety Notes

- Keep website staging separate from production until emulator/staging tests pass.
- Do not write to production app collections from the website in this phase.
- Keep Jotform live until Firestore support request storage and notification handling are tested.
