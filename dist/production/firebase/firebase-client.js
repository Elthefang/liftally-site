const FIREBASE_SDK_VERSION = '10.12.5';
const appUrl = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`;
const authUrl = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`;
const firestoreUrl = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`;

let clientPromise = null;

function readEnvironment() {
  const env = window.LIFTALLY_FIREBASE_ENV;
  if (!env || !env.firebaseConfig) {
    throw new Error('Liftally Firebase environment config is missing.');
  }
  return env;
}

export async function getLiftallyFirebaseClient() {
  if (clientPromise) return clientPromise;

  clientPromise = Promise.all([
    import(appUrl),
    import(authUrl),
    import(firestoreUrl)
  ]).then(([appSdk, authSdk, firestoreSdk]) => {
    const env = readEnvironment();
    const app = appSdk.initializeApp(env.firebaseConfig);
    const auth = authSdk.getAuth(app);
    const db = firestoreSdk.getFirestore(app);

    return {
      environment: env.environment,
      app,
      auth,
      db,
      sdk: {
        app: appSdk,
        auth: authSdk,
        firestore: firestoreSdk
      }
    };
  });

  return clientPromise;
}

export function getLiftallyFirebaseEnvironment() {
  return readEnvironment();
}
