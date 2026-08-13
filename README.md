# Liftally Site

## Purpose

This folder contains the Liftally website and the web viewing surface for `HeroBoard`.

The next version of this site is intended to validate whether Liftally users want a lightweight community feature where they can:

- browse `Squat`, `Bench Press`, and `Deadlift` lifts from people in a similar bodyweight range
- upload their own lift records with a video
- replay videos
- cast a white or red light after watching a lift video

The main product remains the Liftally app. Lift records and videos should be published from the app so users do not need to re-enter their records on the website.

## MVP Goal

Validate these behaviors with the lowest implementation cost:

- Will users browse lifts by exercise and bodyweight bucket?
- Will users publish a video-backed post from the app?
- Will users replay other users' videos?
- Will users cast white or red lights on lifts after watching the video?

This MVP does not optimize for perfect app/web integration, perfect UX, or a complete social system.

## Scope

### In Scope

- HeroBoard page on web
- public browsing of HeroBoard posts
- Firebase Auth with `Sign in with Apple` as the primary identity provider
- iOS upload flow with:
  - exercise type
  - lift weight
  - bodyweight
  - unit
  - video
  - optional caption
- public web feed for browsing HeroBoard posts
- video playback
- filter by:
  - exercise type
  - bodyweight bucket
- one white/red light vote per user per post
- newest-first feed
- minimal moderation
- app entry point later that opens the web HeroBoard

### Out of Scope

- web upload form
- Google Sign In on web
- seamless app-to-web session handoff
- comments
- ranking algorithm
- DOTS / Wilks sorting
- AI posture analysis
- video compression
- thumbnail generation
- Cloud Functions unless strictly required
- advanced moderation tools

## Blocking Decisions

These decisions are fixed for the MVP unless product scope changes.

### Auth

- Use Firebase Auth with `Sign in with Apple` as the primary MVP identity path.
- Browsing does not require login.
- Uploading from iOS requires an authenticated Apple-backed Firebase user.
- Voting requires authentication. For web voting, either add Sign in with Apple on web or route voting through an authenticated app surface.
- Data ownership must remain keyed by Firebase `uid`.
- Anonymous Auth can be kept only as a temporary fallback if Apple setup blocks testing, not as the main HeroBoard identity model.

### Bodyweight Buckets

Use predefined buckets, not exact bodyweight.

Current MVP buckets:

- `<60 kg`
- `60-70 kg`
- `70-80 kg`
- `80+ kg`

Store the normalized bodyweight in `kg`, then derive and store the bucket string.

### Feed Ordering

- Use `newest first`
- No ranking logic in MVP

### Community Light Voting

- Support `white` and `red` votes.
- `white` means the viewer thinks the lift is valid or clean.
- `red` means the viewer thinks the lift is invalid or not clean.
- Max one active vote per user per post.
- Users may change their vote by updating their existing vote doc.
- Do not model HeroBoard as exactly 3 fixed judges. Community voting is scalable, and any 3-light display should be derived from accumulated white/red vote totals.

## Architecture

### Frontend

Location:

- `/Users/yishanfang/liftally-site`

Responsibilities:

- HeroBoard feed UI
- filtering
- video playback
- white/red light voting
- auth gating for upload and voting

### Backend

Use Firebase for shared web/app backend:

- `Firebase Auth`
- `Cloud Firestore`
- `Firebase Storage`

GitHub Pages hosts the static frontend only. It is not the backend.

## Firestore Schema

### Collection: `heroboard_posts`

Suggested fields:

```json
{
  "ownerUid": "uid",
  "displayName": "Lifter Name",
  "exerciseType": "squat",
  "liftWeight": 180,
  "bodyweightKg": 82.5,
  "bodyweightBucket": "80+ kg",
  "unit": "kg",
  "caption": "Top set from today",
  "storagePath": "heroboardVideos/uid/postId.mp4",
  "whiteLightCount": 0,
  "redLightCount": 0,
  "derivedLightResult": "pending",
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp",
  "recordSource": "manual",
  "sessionRecordId": null,
  "status": "active",
  "visibility": "public",
  "seeded": false
}
```

Implementation notes:

- Treat `storagePath` as canonical.
- Do not use `videoURL` as the canonical stored identifier.
- Use `ownerUid` as the canonical post ownership field so web, iOS, and Firestore rules stay aligned.
- Do not use `userId` as the post ownership field.
- Include `displayName` in the post document so shared feed rendering does not depend on a separate profile lookup.
- `status` should support at least:
  - `active`
  - `hidden`
  - `deleted`

### Collection: `heroboard_votes`

Use deterministic vote doc IDs:

- `{postId}_{userId}`

Suggested fields:

```json
{
  "postId": "postId",
  "userId": "uid",
  "voteType": "white",
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

Allowed `voteType` values:

- `white`
- `red`

This prevents duplicate votes for the same post/user pair while allowing the user to change between white and red by updating the existing vote doc.

### Derived Light Result

Do not store fixed 3-judge results as the source of truth for community voting.

Use accumulated counts as the source of truth:

- `whiteLightCount`
- `redLightCount`

The UI can derive a compact result from the counts:

- `valid` when white lights are meaningfully ahead
- `invalid` when red lights are meaningfully ahead
- `pending` when there are not enough votes or the result is tied

If a competition-style 3-light visual is shown, it should be a display summary derived from the current vote ratio, not three stored judge decisions.

## Storage Paths

Use:

```txt
heroboardVideos/{userId}/{postId}.mp4
```

Optional future path:

```txt
heroboardThumbnails/{userId}/{postId}.jpg
```

## Security Rules

### Firestore Rules

Must enforce:

- anyone can read only public active posts
- only authenticated users can create posts
- users can edit or delete only their own posts
- only authenticated users can create votes
- users can create, update, or delete only their own vote doc
- vote docs must use `voteType` of `white` or `red`
- post ownership must be enforced via `ownerUid == request.auth.uid`
- vote ownership remains keyed by `userId == request.auth.uid`

### Storage Rules

Must enforce:

- only authenticated users can upload
- users can upload only to their own path
- only video MIME types are accepted
- file size limit is enforced

MVP file constraints:

- max `50 MB`
- allowed types:
  - `video/mp4`
  - `video/quicktime`

## Upload Flow

This sequence is required:

1. Create or reserve `postId`
2. Upload video to Storage:
   - `heroboardVideos/{userId}/{postId}.mp4`
3. After upload succeeds, create the Firestore post document
4. Refresh the feed or rely on a realtime listener

Do not reverse this order.

## MVP UX Rules

### Keep Simple

Required:

- basic loading state
- success message
- error message

Not required:

- progress bar
- retry queue
- advanced upload recovery
- compression

### Moderation

Minimum moderation for MVP:

- user can delete their own post
- admin can hide or delete posts manually in Firebase Console
- no report system in v1

### Cold Start

Seed about `5-10` posts before launch so the feed is not empty.

Recommended:

- mark seeded posts with `seeded: true`

## App Integration

The app remains the primary product.

App work for this version should include:

- add a HeroBoard or Community Lifts entry point
- open the HeroBoard web page from the app home quick action or dashboard
- add `Sign in with Apple` through Firebase Auth
- add a native `Share to HeroBoard` flow from a saved lift/set record
- let the user attach or record a video before publishing
- upload the video to Firebase Storage
- create the `heroboard_posts` Firestore document after video upload succeeds
- use `/heroboard.html` as the stable web handoff path
- preserve attribution query params:
  - `source=app`
  - `entry=home_quick_action`
  - `platform=ios`

Do not build yet:

- shared session handoff
- native playback feed
- automatic publishing of private workout records

## Implementation Steps

### Phase 1: Firebase Setup

1. Create Firebase project resources for HeroBoard.
2. Enable Firebase Auth with `Sign in with Apple`.
3. Create Firestore collections:
   - `heroboard_posts`
   - `heroboard_votes`
4. Create Storage path convention for videos.
5. Configure app entitlement, Apple provider settings, bundle ID, services ID if web Apple sign-in is needed, and redirect/callback settings.
6. Write Firestore and Storage security rules.
7. Manually verify read, create, upload, vote, delete flows.

### Phase 2: iOS Publish Flow

1. Add Sign in with Apple to the Liftally app through Firebase Auth.
2. Add `Share to HeroBoard` from the relevant saved lift/set record screen.
3. Build publish confirmation UI:
   - display name
   - exercise type
   - lift weight
   - unit
   - bodyweight bucket
   - video
   - optional caption
4. Validate required fields and video type/size.
5. Implement upload flow:
   - auth check
   - generate `postId`
   - upload video
   - create Firestore doc
6. Add success/error states and prevent duplicate publish taps.

### Phase 3: Web Feed and Voting

1. Add a HeroBoard page or section in this site.
2. Build feed query:
   - public
   - active only
   - newest first
3. Build filter UI:
   - exercise type
   - bodyweight bucket
4. Implement video playback.
5. Implement white/red light voting.
6. Implement delete-own-post behavior for authenticated owners if web auth is enabled.

### Phase 4: Seed and QA

1. Seed `5-10` initial posts.
2. Test on mobile web.
3. Test signed-out browsing.
4. Test signed-in iOS upload and web/app vote.
5. Test duplicate vote prevention.
6. Test invalid file rejection.
7. Test hidden/deleted post behavior.

### Phase 5: App Entry Point

1. Add HeroBoard CTA in app home quick action or dashboard.
2. Open web HeroBoard from the app.
3. Test app-to-web navigation flow.

## Current Implementation Status

Updated: `2026-04-10`

Done:

- App-side Apple sign-in code exists in Liftally.
- App target has the Sign in with Apple entitlement.
- Firebase Auth and Firestore are linked in the app target.
- `GoogleService-Info.plist` exists for bundle ID `PlayGround.Liftally`.
- HeroBoard app entry opens `/heroboard.html` with attribution params.
- `/heroboard.html` exists and is styled to match the Liftally site direction.
- App-side HeroBoard Firestore model/repository scaffolding exists:
  - `HeroBoardPost`
  - `HeroBoardVote`
  - `HeroBoardLightVote` as `white` / `red`
  - Firestore repository methods for fetching posts, creating/updating post metadata, and setting/deleting votes
- Firestore rules have a local draft for:
  - `heroboard_posts`
  - `heroboard_votes`

Not done:

- Firebase Console Apple provider verification.
- Firestore rules deployment.
- Firebase Storage setup.
- Firebase Storage rules.
- `FirebaseStorage` linked in the iOS app target.
- Native `Share to HeroBoard` UI.
- Native video picker/recording attachment flow.
- Native video upload to Storage.
- Real HeroBoard web feed query.
- Real web/app white-red vote UI.
- Vote count aggregation.
- Seed data and QA.

## Next Implementation Order

Use this order when continuing work.

### 1. Firebase Console Setup

Manual tasks:

- Enable Firebase Auth `Apple` provider.
- Confirm Firebase iOS app bundle ID is `PlayGround.Liftally`.
- Confirm Apple Developer App ID for `PlayGround.Liftally` has Sign in with Apple enabled.
- Regenerate/download provisioning profiles if Apple capability changes.
- Deploy the local Firestore rules from the app repo.
- Confirm Firestore collections:
  - `heroboard_posts`
  - `heroboard_votes`

Goal:

- Apple-backed Firebase Auth works for iOS users.
- Firestore accepts HeroBoard post/vote metadata according to rules.

### 2. Firebase Storage Setup

Manual tasks:

- Enable Firebase Storage.
- Add Storage rules for:
  - `heroboardVideos/{userId}/{postId}.mp4`
- Allow only authenticated owners to upload to their own path.
- Restrict accepted MIME types and file size.

App tasks:

- Add `FirebaseStorage` to the iOS app target.
- Verify a minimal test upload can write to the expected path.

Goal:

- The app can upload a video file before creating the Firestore post document.

### 3. iOS Share to HeroBoard Flow

App tasks:

- Add `Share to HeroBoard` from the saved lift/set record surface.
- Require Apple-backed Firebase sign-in before publishing.
- Build a publish confirmation screen with:
  - display name
  - exercise type
  - lift weight
  - unit
  - bodyweight bucket
  - video
  - optional caption
- Let the user attach or record a video.
- Generate `postId`.
- Upload the video to Storage.
- Create the `heroboard_posts` Firestore document only after video upload succeeds.
- Add loading, success, error, and duplicate-tap protection states.

Goal:

- A signed-in iOS user can publish a lift record and video to HeroBoard without re-entering the record on the website.

### 4. Web Feed Display

Site tasks:

- Replace the placeholder board in `/heroboard.html` with Firestore feed data.
- Query only:
  - `visibility == public`
  - `status == active`
  - newest first
- Support filters:
  - exercise type
  - bodyweight bucket
- Display:
  - user display name
  - exercise
  - lift weight
  - bodyweight bucket
  - video
  - white/red light counts

Goal:

- Published iOS posts appear on the public HeroBoard site.

### 5. White/Red Light Voting

Decision:

- Fastest product fit: add voting inside the iOS app first.
- Broader web access: add Apple sign-in on the site and implement web voting.

Implementation:

- Store each vote at:
  - `heroboard_votes/{postId}_{userId}`
- Use:
  - `voteType: white`
  - `voteType: red`
- Updating a vote changes the existing vote document instead of creating a duplicate.
- Add vote count aggregation with one of:
  - client transaction when voting is implemented
  - Cloud Function later for stronger consistency
  - derived counts from `heroboard_votes` for early testing

Goal:

- Users can watch a lift and cast one scalable community white/red light vote.

### 6. Seed and QA

Tasks:

- Seed `5-10` initial posts.
- Test signed-out browsing.
- Test Apple sign-in.
- Test iOS publish.
- Test site feed display.
- Test white/red vote create/update.
- Test duplicate vote prevention.
- Test owner hide/delete behavior.
- Test invalid file rejection.
- Test mobile web layout.

Goal:

- HeroBoard has enough content and verification to test with real users.

## Suggested Query Behavior

Default feed query:

- `visibility == public`
- `status == active`
- optional filter: `exerciseType`
- optional filter: `bodyweightBucket`
- order by `createdAt desc`

Keep query logic simple in MVP.

## Success Metrics

Track these metrics to validate the concept:

- number of HeroBoard visitors
- number of uploads
- upload completion rate
- number of video replays
- number of votes
- votes per viewer
- use of bodyweight bucket filters
- return visits

## Guiding Principle

This MVP is for behavior validation.

Optimize for:

- speed
- clarity
- low implementation cost
- low rework in backend structure

Do not optimize for:

- perfect architecture
- perfect UX
- complete app/web identity continuity
- a full community system

## Timeline

Expected timeline:

- `8-12 engineering days` if Apple/Firebase Auth setup stays simple
- `12-16 days` if app upload, entitlements, or rules need extra iteration

## Next Version Notes

If MVP shows traction, the next version can add:

- Apple or Google Sign-In on web
- native playback feed
- moderation UI
- thumbnails
- compression
- better app integration
