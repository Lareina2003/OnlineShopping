
const FIREBASE_API_KEY = "AIzaSyBCizgHYob15la9o-Aj86rEA7c1iKZi9LA";
const FIREBASE_PROJECT_ID = "onlineshopping-ba6fb"; // used for Firestore REST base

const FIREBASE_AUTH_REST = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_API_KEY}`;
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

/**
 * parseJwt - decode google ID token payload (client side)
 */
function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(jsonPayload);
}


async function handleCredentialResponse(response) {
  try {
    if (!response || !response.credential) throw new Error("No credential from Google");
    const googleIdToken = response.credential;
    console.log("Google ID Token:", googleIdToken);

    // decode google payload for immediate UI
    const googlePayload = parseJwt(googleIdToken);
    const email = googlePayload.email || "";
    const name = googlePayload.name || "";
    const picture = googlePayload.picture || "";

    // show quick preview
    document.getElementById("user-info").style.display = "block";
    document.getElementById("user-name").innerText = name;
    document.getElementById("user-email").innerText = email;
    document.getElementById("user-pic").src = picture;

    // Exchange Google ID token for Firebase ID token via Identity REST
    const body = {
      postBody: `id_token=${googleIdToken}&providerId=google.com`,
      requestUri: window.location.origin,
      returnSecureToken: true
    };

    const res = await fetch(FIREBASE_AUTH_REST, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const authData = await res.json();
    if (!res.ok) {
      console.error("Firebase signInWithIdp error:", authData);
      alert("Login failed (Auth). See console.");
      return;
    }
    console.log("Firebase Auth Data:", authData);

    // firebase idToken (used as bearer for Firestore REST), firebase uid (localId)
    const firebaseIdToken = authData.idToken;
    const firebaseUid = authData.localId;

    // store tokens & basic profile locally
    sessionStorage.setItem("firebase_id_token", firebaseIdToken);
    sessionStorage.setItem("firebase_uid", firebaseUid);
    sessionStorage.setItem("user_email", email);
    sessionStorage.setItem("user_name", name);
    sessionStorage.setItem("user_picture", picture);

    // Ensure users/{uid} exists in Firestore. If not, create with role:user
    // GET users/{uid}
    const userDocUrl = `${FIRESTORE_BASE}/users/${firebaseUid}`;
    let role = "user"; // default
    let getResp = await fetch(userDocUrl, {
      headers: { "Authorization": `Bearer ${firebaseIdToken}` }
    });

    if (getResp.ok) {
      const docData = await getResp.json();
      // Firestore returns fields in typed format; read role if present
      if (docData.fields && docData.fields.role && docData.fields.role.stringValue) {
        role = docData.fields.role.stringValue;
      }
    } else if (getResp.status === 404) {
      // create the user doc
      const createBody = {
        fields: {
          email: { stringValue: email },
          name: { stringValue: name },
          picture: { stringValue: picture },
          role: { stringValue: "user" },
          createdAt: { timestampValue: new Date().toISOString() }
        }
      };

      const createResp = await fetch(userDocUrl, {
        method: "PATCH", // PATCH to create at specified doc id
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${firebaseIdToken}`
        },
        body: JSON.stringify(createBody)
      });

      if (!createResp.ok) {
        const err = await createResp.text();
        console.error("Failed to create user doc:", err);
        // Not fatal: continue with default role 'user'
      } else {
        console.log("Created users/{uid} in Firestore");
        role = "user";
      }
    } else {
      // other error when fetching user doc
      const errText = await getResp.text();
      console.error("Error fetching user doc:", getResp.status, errText);
      // continue with default role 'user'
    }

    // store role
    sessionStorage.setItem("user_role", role);

    // redirect to dashboard
    window.location.href = "dashboard.html";

  } catch (err) {
    console.error("handleCredentialResponse error:", err);
    alert("Login failed. Check console for details.");
  }
}

// expose function globally for Google callback
window.handleCredentialResponse = handleCredentialResponse;