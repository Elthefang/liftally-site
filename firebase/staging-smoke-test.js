import { getLiftallyFirebaseClient, getLiftallyFirebaseEnvironment } from './firebase-client.js';

const loadedEnvironment = document.getElementById('loadedEnvironment');
const currentUser = document.getElementById('currentUser');
const runButton = document.getElementById('runSmokeTest');
const signOutButton = document.getElementById('signOutButton');
const log = document.getElementById('log');

function addLog(message, status = 'warn') {
  const row = document.createElement('div');
  row.className = `log-row ${status}`;
  row.textContent = message;
  log.prepend(row);
}

function setBusy(isBusy) {
  runButton.disabled = isBusy;
  signOutButton.disabled = isBusy;
}

function userLabel(user) {
  if (!user) return 'Signed out';
  const type = user.isAnonymous ? 'anonymous' : 'email';
  return `${user.uid} (${type})`;
}

async function expectAllowed(label, action) {
  try {
    const result = await action();
    addLog(`PASS allowed: ${label}`, 'pass');
    return result;
  } catch (error) {
    addLog(`FAIL expected allowed: ${label} - ${error.code || error.message}`, 'fail');
    throw error;
  }
}

async function expectDenied(label, action) {
  try {
    await action();
    addLog(`FAIL expected denied: ${label}`, 'fail');
  } catch (error) {
    if (error.code === 'permission-denied') {
      addLog(`PASS denied: ${label}`, 'pass');
      return;
    }
    addLog(`WARN unexpected error for denied check: ${label} - ${error.code || error.message}`, 'warn');
    throw error;
  }
}

function sampleSnapshot(uid, firestoreSdk) {
  return {
    schemaVersion: 1,
    ownerUid: uid,
    source: 'web_weight_class_explorer',
    standardKey: 'usapl',
    standardLabel: 'USAPL',
    sex: 'men',
    unit: 'kg',
    bodyweight: 82.5,
    bodyweightKg: 82.5,
    squat: 220,
    bench: 140,
    deadlift: 260,
    totalKg: 620,
    dots: 400.22,
    ipfGl: 78.11,
    weightClassKg: '90',
    classRange: 'over 82.5kg to 90kg',
    testedStatus: 'tested',
    benchmarkStandard: 'USAPL',
    totalPercentileBand: 'P75',
    dotsPercentileBand: 'P75',
    benchmarkSampleSize: 4456,
    sourceDataAsOf: '2026-05-10',
    methodologyVersion: '2.0',
    createdAt: firestoreSdk.serverTimestamp(),
    updatedAt: firestoreSdk.serverTimestamp()
  };
}

async function runSmokeTest() {
  setBusy(true);
  log.innerHTML = '';

  try {
    const env = getLiftallyFirebaseEnvironment();
    loadedEnvironment.textContent = `${env.environment} / ${env.firebaseConfig.projectId}`;
    if (env.environment !== 'staging' || env.firebaseConfig.projectId !== 'liftally-staging') {
      throw new Error('This smoke test must only run against liftally-staging.');
    }

    const client = await getLiftallyFirebaseClient();
    const { auth: authSdk, firestore: firestoreSdk } = client.sdk;
    const { auth, db } = client;

    if (auth.currentUser) {
      await authSdk.signOut(auth);
      currentUser.textContent = 'Signed out';
    }

    await expectDenied('signed-out support request create', async () => {
      const supportRef = firestoreSdk.doc(firestoreSdk.collection(db, 'supportRequests'));
      await firestoreSdk.setDoc(supportRef, {
        schemaVersion: 1,
        requesterUid: 'signed-out',
        source: 'website',
        type: 'feedback',
        message: 'Signed out writes should be blocked.',
        email: '',
        createdAt: firestoreSdk.serverTimestamp(),
        status: 'open'
      });
    });

    const credential = await expectAllowed('anonymous sign-in', () => authSdk.signInAnonymously(auth));
    const user = credential.user;
    currentUser.textContent = userLabel(user);

    const profileRef = firestoreSdk.doc(db, 'users', user.uid);
    await expectAllowed('own profile create', () => firestoreSdk.setDoc(profileRef, {
      schemaVersion: 1,
      uid: user.uid,
      displayName: 'Staging Tester',
      email: '',
      createdAt: firestoreSdk.serverTimestamp(),
      updatedAt: firestoreSdk.serverTimestamp()
    }));

    await expectAllowed('own profile update', () => firestoreSdk.updateDoc(profileRef, {
      displayName: 'Staging Tester Updated',
      updatedAt: firestoreSdk.serverTimestamp()
    }));

    const snapshotRef = firestoreSdk.doc(firestoreSdk.collection(db, 'users', user.uid, 'benchmarkSnapshots'));
    await expectAllowed('own benchmark snapshot create', () => firestoreSdk.setDoc(snapshotRef, sampleSnapshot(user.uid, firestoreSdk)));

    await expectAllowed('own benchmark snapshot read', async () => {
      const snap = await firestoreSdk.getDoc(snapshotRef);
      if (!snap.exists()) throw new Error('snapshot missing after create');
      return snap;
    });

    await expectDenied('other user snapshot create', () => {
      const otherUserId = `not-${user.uid}`;
      const otherRef = firestoreSdk.doc(firestoreSdk.collection(db, 'users', otherUserId, 'benchmarkSnapshots'));
      return firestoreSdk.setDoc(otherRef, sampleSnapshot(otherUserId, firestoreSdk));
    });

    const supportRef = firestoreSdk.doc(firestoreSdk.collection(db, 'supportRequests'));
    await expectAllowed('signed-in support request create', () => firestoreSdk.setDoc(supportRef, {
      schemaVersion: 1,
      requesterUid: user.uid,
      source: 'weight_class_explorer',
      type: 'competition_planner_access',
      message: 'I want to test Competition Planner access from staging.',
      email: '',
      createdAt: firestoreSdk.serverTimestamp(),
      status: 'open'
    }));

    await expectDenied('support request read blocked', () => firestoreSdk.getDoc(supportRef));
    addLog('Smoke test complete against liftally-staging.', 'pass');
  } catch (error) {
    addLog(`Smoke test stopped: ${error.code || error.message}`, 'fail');
  } finally {
    setBusy(false);
  }
}

async function signOut() {
  setBusy(true);
  try {
    const client = await getLiftallyFirebaseClient();
    await client.sdk.auth.signOut(client.auth);
    currentUser.textContent = 'Signed out';
    addLog('Signed out.', 'pass');
  } catch (error) {
    addLog(`Sign out failed: ${error.code || error.message}`, 'fail');
  } finally {
    setBusy(false);
  }
}

async function init() {
  try {
    const env = getLiftallyFirebaseEnvironment();
    loadedEnvironment.textContent = `${env.environment} / ${env.firebaseConfig.projectId}`;
    const client = await getLiftallyFirebaseClient();
    client.sdk.auth.onAuthStateChanged(client.auth, (user) => {
      currentUser.textContent = userLabel(user);
    });
    addLog('Firebase staging client initialized.', 'pass');
  } catch (error) {
    addLog(`Initialization failed: ${error.message}`, 'fail');
  }
}

runButton.addEventListener('click', runSmokeTest);
signOutButton.addEventListener('click', signOut);
init();
