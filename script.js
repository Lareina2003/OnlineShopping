async function handleCredentialResponse(response) {
  const googleIdToken = response.credential; // JWT from Google
  console.log("Google ID Token:", googleIdToken);

  // Exchange Google ID token for Firebase ID token via REST API
  const firebaseRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=AIzaSyBCizgHYob15la9o-Aj86rEA7c1iKZi9LA`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postBody: `id_token=${googleIdToken}&providerId=google.com`,
        requestUri: window.location.origin,
        returnSecureToken: true,
      }),
    }
  );

  const firebaseData = await firebaseRes.json();
  console.log("Firebase Auth Data:", firebaseData);

  if (firebaseData.idToken) {
    // Show user info (optional on login page)
    document.getElementById("user-info").style.display = "block";
    document.getElementById("user-name").innerText = firebaseData.displayName;
    document.getElementById("user-email").innerText = firebaseData.email;
    document.getElementById("user-pic").src = firebaseData.photoUrl;

    // Save Firebase ID token for later use in dashboard
    localStorage.setItem("firebase_id_token", firebaseData.idToken);
    localStorage.setItem("user_name", firebaseData.displayName);

    // Redirect to dashboard page
    window.location.href = "dashboard.html";
  } else {
    alert("Login failed! Check console for details.");
    console.error(firebaseData);
  }
}
