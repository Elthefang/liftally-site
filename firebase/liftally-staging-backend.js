const backend = {
  ready: false,
  environment: null,
  error: null,
  ensureAnonymousUser: ensureAnonymousUser,
  saveBenchmarkSnapshot: saveBenchmarkSnapshot,
  listBenchmarkSnapshots: listBenchmarkSnapshots,
  createSupportRequest: createSupportRequest,
  createAccountWithEmail: createAccountWithEmail,
  signInWithEmail: signInWithEmail,
  signOut: signOut,
  getCurrentUser: getCurrentUser
};

let clientPromise = null;
let currentUser = null;

window.liftallyBackend = backend;

function announceReady() {
  backend.ready = true;
  window.dispatchEvent(new CustomEvent('liftally-backend-ready', { detail: backend }));
}

function announceError(error) {
  backend.error = error;
  window.dispatchEvent(new CustomEvent('liftally-backend-error', { detail: error }));
}

async function getClient() {
  if (!clientPromise) {
    clientPromise = import('./firebase-client.js')
      .then((module) => {
        module.getLiftallyFirebaseEnvironment();
        return module.getLiftallyFirebaseClient();
      });
  }
  return clientPromise;
}

function assertStaging(client) {
  if (client.environment !== 'staging') {
    throw new Error('Firebase staging backend is not configured.');
  }
}

function getCurrentUser() {
  return currentUser;
}

async function upsertProfile(client, user) {
  const { firestore: firestoreSdk } = client.sdk;
  const profileRef = firestoreSdk.doc(client.db, 'users', user.uid);
  const profileSnap = await firestoreSdk.getDoc(profileRef);
  const displayName = user.isAnonymous ? 'Liftally Web Guest' : 'Liftally Web User';

  if (profileSnap.exists()) {
    await firestoreSdk.updateDoc(profileRef, {
      email: user.email || '',
      displayName,
      updatedAt: firestoreSdk.serverTimestamp()
    });
  } else {
    await firestoreSdk.setDoc(profileRef, {
      schemaVersion: 1,
      uid: user.uid,
      email: user.email || '',
      displayName,
      createdAt: firestoreSdk.serverTimestamp(),
      updatedAt: firestoreSdk.serverTimestamp()
    });
  }
}

async function ensureAnonymousUser() {
  const client = await getClient();
  assertStaging(client);
  const { auth: authSdk } = client.sdk;

  const user = client.auth.currentUser || (await authSdk.signInAnonymously(client.auth)).user;
  currentUser = user;
  await upsertProfile(client, user);

  return user;
}

async function createAccountWithEmail(email, password) {
  const client = await getClient();
  assertStaging(client);
  const { auth: authSdk } = client.sdk;
  const credential = authSdk.EmailAuthProvider.credential(email, password);
  const existingUser = client.auth.currentUser;
  let userCredential;

  if (existingUser && existingUser.isAnonymous) {
    userCredential = await authSdk.linkWithCredential(existingUser, credential);
  } else {
    userCredential = await authSdk.createUserWithEmailAndPassword(client.auth, email, password);
  }

  currentUser = userCredential.user;
  await upsertProfile(client, currentUser);
  return currentUser;
}

async function signInWithEmail(email, password) {
  const client = await getClient();
  assertStaging(client);
  const { auth: authSdk } = client.sdk;
  const credential = await authSdk.signInWithEmailAndPassword(client.auth, email, password);
  currentUser = credential.user;
  await upsertProfile(client, currentUser);
  return currentUser;
}

async function signOut() {
  const client = await getClient();
  assertStaging(client);
  await client.sdk.auth.signOut(client.auth);
  currentUser = null;
}

async function saveBenchmarkSnapshot(snapshot) {
  const client = await getClient();
  assertStaging(client);
  const { firestore: firestoreSdk } = client.sdk;
  const user = await ensureAnonymousUser();
  const snapshotRef = firestoreSdk.doc(firestoreSdk.collection(client.db, 'users', user.uid, 'benchmarkSnapshots'));

  await firestoreSdk.setDoc(snapshotRef, {
    ...snapshot,
    schemaVersion: 1,
    ownerUid: user.uid,
    source: 'web_weight_class_explorer',
    createdAt: firestoreSdk.serverTimestamp(),
    updatedAt: firestoreSdk.serverTimestamp()
  });

  return { id: snapshotRef.id, uid: user.uid };
}

async function listBenchmarkSnapshots(limitCount = 5) {
  const client = await getClient();
  assertStaging(client);
  const { firestore: firestoreSdk } = client.sdk;
  const user = await ensureAnonymousUser();
  const snapshotsRef = firestoreSdk.collection(client.db, 'users', user.uid, 'benchmarkSnapshots');
  const query = firestoreSdk.query(
    snapshotsRef,
    firestoreSdk.orderBy('createdAt', 'desc'),
    firestoreSdk.limit(limitCount)
  );
  const querySnap = await firestoreSdk.getDocs(query);
  return querySnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

async function createSupportRequest({ type, message, email = '', source = 'website' }) {
  const client = await getClient();
  assertStaging(client);
  const { firestore: firestoreSdk } = client.sdk;
  const user = await ensureAnonymousUser();
  const requestRef = firestoreSdk.doc(firestoreSdk.collection(client.db, 'supportRequests'));

  await firestoreSdk.setDoc(requestRef, {
    schemaVersion: 1,
    requesterUid: user.uid,
    source,
    type,
    message,
    email,
    createdAt: firestoreSdk.serverTimestamp(),
    status: 'open'
  });

  return { id: requestRef.id, uid: user.uid };
}

getClient()
  .then((client) => {
    backend.environment = client.environment;
    client.sdk.auth.onAuthStateChanged(client.auth, (user) => {
      currentUser = user;
      window.dispatchEvent(new CustomEvent('liftally-auth-change', { detail: { user } }));
    });
    announceReady();
  })
  .catch((error) => {
    announceError(error);
  });
