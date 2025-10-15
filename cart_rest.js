// cart_rest.js (module)
const FIREBASE_PROJECT_ID = "onlineshopping-ba6fb";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
const FIRESTORE_COMMIT = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:commit`;

function getAuthHeader() {
  const token = sessionStorage.getItem("firebase_id_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}



async function getDocumentByPath(path) {
  const url = `${FIRESTORE_BASE}/${path}`;
  const res = await fetch(url, { headers: { ...getAuthHeader() } });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`GET doc ${path} failed: ${res.status}`);
  }
  const d = await res.json();
  return { id: d.name.split("/").pop(), ...firestoreToObj(d.fields), __name: d.name, __updateTime: d.updateTime };
}

async function listSubcollection(parentPath, subcollection) {
  // parentPath e.g. "carts/{uid}"
  const url = `${FIRESTORE_BASE}/${parentPath}/${subcollection}`;
  const res = await fetch(url, { headers: { ...getAuthHeader() } });
  if (!res.ok) {
    if (res.status === 404) return [];
    throw new Error(`List subcollection failed: ${res.status}`);
  }
  const data = await res.json();
  if (!data.documents) return [];
  return data.documents.map(d => ({ id: d.name.split("/").pop(), ...firestoreToObj(d.fields), __name: d.name }));
}

async function getProduct(productId) {
  return getDocumentByPath(`Products/${productId}`);
}

async function loadcarts() {
  const role = sessionStorage.getItem("user_role") || "user";
  if (role !== "user") {
    document.getElementById("cart-items").innerHTML = "<p>Admins do not have a cart.</p>";
    return;
  }

  const uid = sessionStorage.getItem("firebase_uid") || sessionStorage.getItem("user_email");
  if (!uid) {
    document.getElementById("cart-items").innerHTML = "<p>Please log in to see your cart.</p>";
    return;
  }

  document.getElementById("cart-user").innerHTML = `<h3>${sessionStorage.getItem("user_name") || uid}</h3>`;

  const items = await listSubcollection(`carts/${uid}`, "items");
  const container = document.getElementById("cart-items");
  container.innerHTML = "";

  if (!items.length) {
    container.innerHTML = "<p>Your cart is empty.</p>";
    return;
  }

  let totalPrice = 0;

  for (const item of items) {
    const product = await getProduct(item.productId);
    if (!product) continue;
const name = product.name || product.Name || "Unnamed";
const price = Number(product.price || product.Price || 0);
const image = product.image || product.Image || "";
const subtotal = price * (item.qty || 0);
totalPrice += subtotal;

 const div = document.createElement("div");
div.className = "cart-item";

div.innerHTML = `
  <img src="${image}" style="width:80px; height:80px; object-fit:cover; border-radius:5px;">
  <div>
    <h4>${name}</h4>
    <p>Price: ₹${price}</p>
    <p>Qty: ${item.qty}</p>
    <p>Subtotal: ₹${subtotal}</p>
  </div>
  <button data-path="carts/${uid}/items/${item.id}" class="remove-btn" style="background-color:red;color:white;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;">Remove</button>
`;

    container.appendChild(div);
  }

  const totalDiv = document.createElement("div");
  totalDiv.style.margin = "10px";
  totalDiv.innerHTML = `<h3>Total: ₹${totalPrice}</h3>`;
  container.appendChild(totalDiv);

  // remove buttons
  document.querySelectorAll(".remove-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const path = btn.getAttribute("data-path"); // "carts/{uid}/items/{docId}"
      if (!confirm("Remove this item from cart?")) return;
      // get cart item doc to read qty and productId, so we can increment product stock back
      const cartDoc = await getDocumentByPath(path);
      if (!cartDoc) { alert("Not found"); loadcarts(); return; }
      const { productId, qty } = cartDoc;
      // We'll do a commit: 1) delete cart doc 2) update product quantity adding back qty
      // But we must read product to know its updateTime and current quantity
      const productDoc = await getProduct(productId);
      if (!productDoc) {
        // just delete cart doc
        await fetch(`${FIRESTORE_BASE}/${path}`, { method: "DELETE", headers: { ...getAuthHeader() } });
        alert("Removed");
        loadcarts();
        return;
      }

      const newProdQty = (parseInt(productDoc.quantity || 0, 10)) + (parseInt(qty || 0, 10));
      // build commit
      const writes = [
        { delete: productDoc.__name ? productDoc.__name : `${FIRESTORE_BASE}/products/${productId}` },
      ];
      // Wait — we shouldn't delete product — wrong. Fix: update product and delete cart item.
      // Build proper writes:
      const productUpdate = {
        update: {
          name: productDoc.__name,
          fields: (() => {
            const f = {};
            const obj = { ...productDoc, quantity: newProdQty };
            // remove helper keys
            delete obj.__name; delete obj.__updateTime; delete obj.id;
            for (const k of Object.keys(obj)) {
              const v = obj[k];
              if (typeof v === "string") f[k] = { stringValue: v };
              else if (Number.isInteger(v)) f[k] = { integerValue: `${v}` };
              else if (typeof v === "number") f[k] = { doubleValue: v };
            }
            return f;
          })()
        },
        currentDocument: productDoc.__updateTime ? { updateTime: productDoc.__updateTime } : { exists: true }
      };
      const deleteCart = { delete: `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}` };


      const commitBody = { writes: [productUpdate, deleteCart] };
      // send commit
      const resp = await fetch(FIRESTORE_COMMIT, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(commitBody)
      });
if (!resp.ok) {
  const txt = await resp.text();
  console.error("❌ Remove commit failed:", resp.status, txt);
  alert(`Failed to remove item.\n\nError ${resp.status}:\n${txt}`);
} else {
  console.log("✅ Commit success");
  alert("Item removed and stock updated.");
  loadcarts();
}

    });
  });
}

// checkout: simply delete all cart items (in real app create order docs etc.)
document.getElementById("checkout-btn").addEventListener("click", async () => {
  const uid = sessionStorage.getItem("firebase_uid") || sessionStorage.getItem("user_email");
  if (!uid) return alert("Please sign in first.");
  if (!confirm("Place order and clear cart?")) return;

  const items = await listSubcollection(`carts/${uid}`, "items");
  if (!items.length) { alert("carts empty"); return; }

 // ✅ Correct Firestore commit paths (NO full URL)
const writes = items.map(i => ({
  delete: `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/carts/${uid}/items/${i.id}`
}));

const resp = await fetch(FIRESTORE_COMMIT, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...getAuthHeader() },
  body: JSON.stringify({ writes })
});

  if (!resp.ok) {
    const txt = await resp.text();
    console.error("Checkout failed:", txt);
    alert("Checkout failed");
  } else {
    alert("✅ Order placed! carts cleared.");
    loadcarts();
  }
});



function firestoreToObj(fields) {
  const obj = {};
  if (!fields) return obj;
  for (const [k, v] of Object.entries(fields)) {
    if (v.stringValue !== undefined) obj[k] = v.stringValue;
    else if (v.integerValue !== undefined) obj[k] = parseInt(v.integerValue, 10);
    else if (v.doubleValue !== undefined) obj[k] = Number(v.doubleValue);
    else if (v.timestampValue !== undefined) obj[k] = v.timestampValue;
    else if (v.booleanValue !== undefined) obj[k] = v.booleanValue;
  }
  return obj;
}

// /* init */
 loadcarts();