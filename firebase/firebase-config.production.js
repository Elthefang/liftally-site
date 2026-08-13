// Production web Firebase configuration.
// Fill the marked values from:
// firebase apps:sdkconfig WEB --project myappproject-f71fd
// Never copy values from the staging configuration into this file.
(function () {
  const firebaseConfig = {
    apiKey: 'AIzaSyC7zQr1nOIijhWd5Ib1RcDF4J8HJavlD5Q',
    authDomain: 'myappproject-f71fd.firebaseapp.com',
    projectId: 'myappproject-f71fd',
    storageBucket: 'myappproject-f71fd.firebasestorage.app',
    messagingSenderId: '249334657422',
    appId: '1:249334657422:web:0bb4e5c9b973fa525874df'
  };

  const placeholderPrefix = '__' + 'PRODUCTION_';
  if (Object.values(firebaseConfig).some((value) => String(value).startsWith(placeholderPrefix))) {
    throw new Error(
      'Production Firebase web config is incomplete. Generate it with firebase apps:sdkconfig WEB --project myappproject-f71fd.'
    );
  }

  window.LIFTALLY_FIREBASE_ENV = {
    environment: 'production',
    firebaseConfig
  };
})();
