// dashboard_rest.js (module)
const FIREBASE_API_KEY = "AIzaSyBCizgHYob15la9o-Aj86rEA7c1iKZi9LA";
const FIREBASE_PROJECT_ID = "onlineshopping-ba6fb";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
const FIRESTORE_COMMIT = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents:commit`;

/* ===== helpers ===== */
function getAuthHeader() {
  const token = sessionStorage.getItem("firebase_id_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function docName(collection, id) {
  return `${FIRESTORE_BASE}/${collection}/${id}`;
}

function subcollectionParentName(parentCollection, parentId, subCollection) {
  return `${FIRESTORE_BASE}/${parentCollection}/${parentId}/${subCollection}`;
}

function docFullName(path) { // pass like "Products/abcd"
  return `${FIRESTORE_BASE}/${path}`;
}

function firestoreToObj(fields) {
  // loosely converts Firestore typed fields to plain JS object
  const obj = {};
  if (!fields) return obj;
  for (const [k, v] of Object.entries(fields)) {
    if (v.stringValue !== undefined) obj[k] = v.stringValue;
    else if (v.integerValue !== undefined) obj[k] = parseInt(v.integerValue, 10);
    else if (v.doubleValue !== undefined) obj[k] = Number(v.doubleValue);
    else if (v.timestampValue !== undefined) obj[k] = v.timestampValue;
    else if (v.booleanValue !== undefined) obj[k] = v.booleanValue;
    else if (v.mapValue !== undefined) obj[k] = firestoreToObj(v.mapValue.fields);
    // add types as needed
  }
  return obj;
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") fields[k] = { stringValue: v };
    else if (Number.isInteger(v)) fields[k] = { integerValue: `${v}` };
    else if (typeof v === "number") fields[k] = { doubleValue: v };
    else if (typeof v === "boolean") fields[k] = { booleanValue: v };
    else if (v instanceof Date) fields[k] = { timestampValue: v.toISOString() };
    else if (v === null) fields[k] = { nullValue: null };
    else fields[k] = { stringValue: String(v) };
  }
  return fields;
}

/* ===== basic Firestore REST wrappers ===== */
async function listCollection(collectionName) {
  const url = `${FIRESTORE_BASE}/${collectionName}`;
  const res = await fetch(`${url}?t=${Date.now()}`, { headers: { ...getAuthHeader() }, cache: "no-store" });

  if (!res.ok) {
    if (res.status === 404) return []; // no documents
    throw new Error(`Failed list ${collectionName}: ${res.status}`);
  }
  const data = await res.json();
  // data.documents is array of doc objects
  if (!data.documents) return [];
  return data.documents.map(d => {
    return { id: d.name.split("/").pop(), ...firestoreToObj(d.fields), __updateTime: d.updateTime };
  });
}

async function getDocumentByPath(path) { // "Products/{id}"
  const url = `${FIRESTORE_BASE}/${path}`;
  const res = await fetch(url, { headers: { ...getAuthHeader() } });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`GET doc ${path} failed: ${res.status}`);
  }
  const d = await res.json();
  return { id: d.name.split("/").pop(), ...firestoreToObj(d.fields), __name: d.name, __updateTime: d.updateTime };
}

async function createDocWithId(collectionName, id, obj) {
  const url = `${FIRESTORE_BASE}/${collectionName}/${id}`;
  const body = { fields: toFirestoreFields(obj) };
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeader() },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Create doc failed: ${res.status}`);
  return res.json();
}

async function patchDocByPath(path, obj) {
  const url = `${FIRESTORE_BASE}/${path}`;
  const body = { fields: toFirestoreFields(obj) };
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAuthHeader() },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Patch doc ${path} failed: ${res.status}`);
  return res.json();
}

async function deleteDocByPath(path) {
  const url = `${FIRESTORE_BASE}/${path}`;
  const res = await fetch(url, { method: "DELETE", headers: { ...getAuthHeader() } });
  if (!res.ok) throw new Error(`Delete ${path} failed: ${res.status}`);
  return true;
}

async function loadCategories() {
  const container = document.getElementById("collections");
  container.innerHTML = "<p>Loading Categories...</p>";

  const cats = await listCollection("Categories");

  container.innerHTML = ""; // clear before showing Categories

  // Create a div for Categories
  const catDiv = document.createElement("div");
  catDiv.id = "category-bar";
  catDiv.style.display = "flex";
  catDiv.style.flexWrap = "wrap";
  catDiv.style.gap = "8px";
  catDiv.style.marginBottom = "20px";

  cats.forEach(cat => {
    const btn = document.createElement("button");
    btn.textContent = cat.Category;
    btn.className = "category-btn";
    btn.addEventListener("click", () => loadProductsByCategory(cat.Category)); // click → load Products
    catDiv.appendChild(btn);
  });

  container.appendChild(catDiv);

  
}

async function loadProductsByCategory(categoryName = null) {
  const container = document.getElementById("collections");
  // remove old product grid if exists
  let oldGrid = document.getElementById("product-grid");
  if (oldGrid) oldGrid.remove();

  const oldTitles = container.querySelectorAll("h2");
  oldTitles.forEach(t => t.remove());
  const allProducts = await listCollection("Products");


  // filter by category if one is selected
  let filtered = allProducts;
  if (categoryName) {
    filtered = allProducts.filter(p => (p.Category || "").toLowerCase() === categoryName.toLowerCase());
  }

  // now display the Products under that category
  displayProducts(filtered, categoryName);
}

function displayProducts(Products, categoryName = null) {
  const container = document.getElementById("collections");

  // Clear old grid
  let oldGrid = document.getElementById("product-grid");
  if (oldGrid) oldGrid.remove();

  const grid = document.createElement("div");
  grid.id = "product-grid";
  grid.style.display = "flex";
  grid.style.flexWrap = "wrap";
  grid.style.gap = "10px";

  if (categoryName) {
    const title = document.createElement("h2");
    title.textContent = `🧺 ${categoryName} Products`;
    title.style.width = "100%";
    title.style.marginTop = "15px";
    container.appendChild(title);
  }

  if (!Products.length) {
    const msg = document.createElement("p");
    msg.textContent = "No Products found for this category.";
    container.appendChild(msg);
    return;
  }

  Products.forEach(p => {
    const div = document.createElement("div");
    div.className = "product-card";
    div.style.border = "1px solid #ccc";
    div.style.padding = "10px";
    div.style.borderRadius = "10px";
    div.style.width = "220px";
    div.style.textAlign = "center";
    div.style.margin = "10px";
    div.style.boxShadow = "0 2px 6px rgba(0,0,0,0.1)";

    // ✅ Safely handle both Name and name versions
    const name = p.name || p.Name || "Unnamed";
    const price = p.price || p.Price || "-";
    const brand = p.brand || p.Brand || "-";
    const colour = p.colour || p.Colour || "-";
    const category = p.category || p.Category || "-";
    const quantity = p.quantity || p.Quantity || "-";
    const image = p.image || p.Image || "";

    let html = `
      <h4>${name}</h4>
      <p>Brand: ${brand}</p>
      <p>Colour: ${colour}</p>
      <p>Category: ${category}</p>
      <p>Qty: ${quantity}</p>
      <p>Price: ₹${price}</p>
    `;

    if (image) {
      html = `<img src="${image}" style="width:100%; height:150px; object-fit:cover; border-radius:5px;">` + html;
    }

   const role = (sessionStorage.getItem("User_role") || "user").toLowerCase();

if (role === "admin") {
  // Admin can only edit/delete, no Add to Cart
  html += `
    <button onclick="editProductRest('${p.id}')">✏️ Edit</button>
    <button onclick="deleteProductRest('${p.id}')">🗑️ Delete</button>
  `;
} else if (role === "user") {
  // Regular users only see Add to Cart
  html += `<button onclick="addToCartRest('${p.id}')">🛒 Add to Cart</button>`;
}

    div.innerHTML = html;
    grid.appendChild(div);
  });

  container.appendChild(grid);
}



/* ===== load dashboard ===== */
async function loadDashboard() {
  const UserName = sessionStorage.getItem("user_name") || "User";
  const UserEmail = sessionStorage.getItem("User_email") || "";
  document.getElementById("user-info").innerHTML = `<h2>Welcome, ${UserName}</h2>`;

  // User role might be present in sessionStorage from login; if not, fetch User/{uid}
  let role = sessionStorage.getItem("User_role");
  const uid = sessionStorage.getItem("firebase_uid") || sessionStorage.getItem("User_email");
  if (!role && uid) {
    // fetch User doc
    console.log("🔍 Checking user doc:", uid);
    const UserDoc = await getDocumentByPath(`Users/${uid}`);
    if (UserDoc && (UserDoc.Role || UserDoc.role)) {
  role = (UserDoc.Role || UserDoc.role).toLowerCase();
} else {
  role = "user";
}
sessionStorage.setItem("User_role", role);

  }
  const adminPanel = document.getElementById("admin-panel");
  if (role.toLowerCase() === "admin") {

    adminPanel.innerHTML = `<button id="add-product-btn">➕ Add Product</button>`;
    document.getElementById("add-product-btn").addEventListener("click", addProductRest);
  } else {
    adminPanel.innerHTML = "";
  }

  // Categories + Products
  await loadCategories();

  // search
  // 🔍 Search products (fixed version)
const searchInput = document.getElementById("search");
searchInput.addEventListener("input", async () => {
  const queryText = searchInput.value.toLowerCase();

  // 🔹 Always fetch fresh data from Firestore
  const Products = await listCollection("Products");

  // 🔹 Filter live data
  const filtered = Products.filter(p =>
    Object.values(p).some(v => typeof v === "string" && v.toLowerCase().includes(queryText))
  );

  // 🔹 Clear old results before showing new ones
  const container = document.getElementById("collections");
  container.innerHTML = "";

  // 🔹 Re-render filtered products
  displayProducts(filtered);
});


}

/* ===== admin add/edit/delete (REST) ===== */
window.addProductRest = async function () {
  const formContainer = document.getElementById("product-form-container");
  const form = document.getElementById("product-form");
  formContainer.style.display = "block";
  form.reset();

  const categorySelect = document.getElementById("product-category");
  categorySelect.innerHTML = '<option value="">Select Category</option>';
  const cats = await listCollection("Categories");
cats.forEach(c => {
  const option = document.createElement("option");
  option.value = c.Category;   // 👈 use the field name from Firestore
  option.textContent = c.Category;
  categorySelect.appendChild(option);
});


  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);

newForm.addEventListener("submit", async e => {
  e.preventDefault();
  const name = document.getElementById("product-name").value;
  const price = parseFloat(document.getElementById("product-price").value);
  const brand = document.getElementById("product-brand").value;
  const colour = document.getElementById("product-colour").value;
  const quantity = parseInt(document.getElementById("product-quantity").value || "0", 10);
  const category = document.getElementById("product-category").value;
  const image = document.getElementById("product-image").value;

  if (!name || !price || !category) return alert("❌ Name, Price, Category required");

  // generate id
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;

  // 🔹 Use lowercase field names
await createDocWithId("Products", id, {
  Name: name,
  Price: price,
  Brand: brand,
  Colour: colour,
  Quantity: quantity,
  Category: category,
  Image: image
});

  alert("✅ Product added!");
  formContainer.style.display = "none";
  await loadDashboard();
});

document.getElementById("cancel-product-btn").addEventListener("click", () => {
  formContainer.style.display = "none";
});
};

window.editProductRest = async function (productId) {
  const role = (sessionStorage.getItem("User_role") || "user").toLowerCase();
  if (role !== "admin") return alert("Only admins can edit Products");

  const doc = await getDocumentByPath(`Products/${productId}`);
  if (!doc) return alert("Product not found");

  // 🧠 Get existing values safely (supports both Name/name formats)
  const oldName = doc.name || doc.Name || "";
  const oldPrice = doc.price || doc.Price || "";
  const oldBrand = doc.brand || doc.Brand || "";
  const oldColour = doc.colour || doc.Colour || "";
  const oldQty = doc.quantity || doc.Quantity || "";
  const oldCategory = doc.category || doc.Category || "";
  const oldImage = doc.image || doc.Image || "";

  // 🔹 Ask user to edit (default filled with current values)
  const newName = prompt("Enter new product name:", oldName);
  if (!newName) return alert("Cancelled");

  const newPriceStr = prompt("Enter new price:", oldPrice);
  if (!newPriceStr) return alert("Cancelled");
  const newPrice = parseFloat(newPriceStr);

  const newBrand = prompt("Enter new brand:", oldBrand);
  const newColour = prompt("Enter new colour:", oldColour);
  const newQtyStr = prompt("Enter new quantity:", oldQty);
  const newQty = parseInt(newQtyStr || oldQty || "0", 10);
  const newCategory = prompt("Enter new category:", oldCategory);
  const newImage = prompt("Enter new image URL:", oldImage);

  // 🧩 Merge all fields together (don’t remove existing)
  const productFullName = `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/Products/${productId}`;


  const updatedProduct = {
    Name: newName,
    Price: newPrice,
    Brand: newBrand,
    Colour: newColour,
    Quantity: newQty,
    Category: newCategory,
    Image: newImage
  };

  // 🔥 Patch all fields (rebuild full object, not partial)
  await patchDocByPath(`Products/${productId}`, updatedProduct);

  alert("✅ Product updated!");
  await loadDashboard();
};



window.deleteProductRest = async function(productId) {
  const role = (sessionStorage.getItem("User_role") || "user").toLowerCase();
  if (role !== "admin") return alert("Only admins can delete Products");

  if (!confirm("Are you sure you want to delete this product?")) return;
  await deleteDocByPath(`Products/${productId}`);
  alert("🗑️ Product deleted!");
  loadDashboard();
};


/* ===== addToCart using commit + precondition on product document updateTime ===== */
/* ===== addToCart using commit (final working version) ===== */
window.addToCartRest = async function (productId) {
  try {
    const role = (sessionStorage.getItem("User_role") || "user").toLowerCase();
    if (role === "admin") return alert("Admins cannot add to cart");

    const uid =
      sessionStorage.getItem("firebase_uid") ||
      sessionStorage.getItem("User_email");
    if (!uid) return alert("Please sign in first.");

    const qtyStr = prompt("Enter quantity:", "1");
    if (qtyStr === null) return;
    const qty = parseInt(qtyStr, 10);
    if (isNaN(qty) || qty <= 0) return alert("Invalid quantity");

    // 1️⃣ Read product doc
    const productDoc = await getDocumentByPath(`Products/${productId}`);
    if (!productDoc) return alert("Product no longer exists");

    const currentStock = Number(productDoc.quantity || productDoc.Quantity || 0);
    if (isNaN(currentStock)) return alert("⚠️ Invalid quantity in Firestore");
    if (currentStock < qty)
      return alert(`Only ${currentStock} left in stock`);

    // 2️⃣ Prepare product update (subtract quantity)
    const newQty = currentStock - qty;
    const productFullName = `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/Products/${productId}`;
    const updatedProduct = {
      Name: productDoc.Name || productDoc.name || "",
      Price: Number(productDoc.Price || productDoc.price || 0),
      Brand: productDoc.Brand || productDoc.brand || "",
      Colour: productDoc.Colour || productDoc.colour || "",
      Category: productDoc.Category || productDoc.category || "",
      Image: productDoc.Image || productDoc.image || "",
      Quantity: newQty
    };

   const productUpdate = {
  update: {
    name: productFullName,
    fields: toFirestoreFields(updatedProduct)
  },
  updateMask: {
    fieldPaths: ["Name", "Price", "Brand", "Colour", "Category", "Image", "Quantity"]
  }
};


    // 3️⃣ Prepare cart write
    const cartItemPath = `carts/${uid}/items/${productId}`;
    const cartFullName = `projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/carts/${uid}/items/${productId}`;

    const cartDoc = await getDocumentByPath(cartItemPath);

    let cartWrite;
    if (cartDoc) {
      // update qty if already exists
      const prevQty = parseInt(cartDoc.qty || 0, 10);
      cartWrite = {
        update: {
          name: cartFullName,
          fields: toFirestoreFields({
            productId,
            qty: prevQty + qty,
            updatedAt: new Date().toISOString()
          })
        },
        updateMask: { fieldPaths: ["productId", "qty", "updatedAt"] },
        currentDocument: { exists: true }
      };
    } else {
      // create new
      cartWrite = {
        update: {
          name: cartFullName,
          fields: toFirestoreFields({
            productId,
            qty: qty,
            addedAt: new Date().toISOString()
          })
        }
      };
    }

    // 4️⃣ Send commit
    const commitBody = { writes: [productUpdate, cartWrite] };
    console.log("🚀 Commit body:", JSON.stringify(commitBody, null, 2));
    console.log("🧾 Firestore request body preview:", JSON.stringify(commitBody, null, 2));

    const commitRes = await fetch(FIRESTORE_COMMIT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader()
      },
      body: JSON.stringify(commitBody)
    });

    if (!commitRes.ok) {
      const errText = await commitRes.text();
      console.error("❌ Commit failed:", errText);
      return alert("❌ Cannot add to cart — operation conflicted or failed.");
    }

    alert("✅ Added to cart!");
  } catch (err) {
    console.error("addToCartRest error:", err);
    alert("❌ Cannot add to cart: " + (err.message || err));
  }
};


/* ===== init ===== */
loadDashboard();