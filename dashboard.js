// // dashboard.js

// async function loadProductsCollection() {
//   const userName = localStorage.getItem("user_name") || "User";

//   document.getElementById("user-info").innerHTML = `<h2>Welcome, ${userName}</h2>`;

//   const projectId = "onlineshopping-ba6fb";
//   const collectionName = "Products"; // exact Firestore collection name
//   const url = `https://firestore.googleapis.com/v1/projects/onlineshopping-ba6fb/databases/(default)/documents/Products`;

//   try {
//     // REST fetch with no auth headers because rules allow public read
//     const res = await fetch(url);
//     const data = await res.json();

//     console.log("Products collection:", data);

//     const collectionsDiv = document.getElementById("collections");
//     collectionsDiv.innerHTML = "";

//     if (data.documents && data.documents.length > 0) {
//   data.documents.forEach(doc => {
//     const div = document.createElement("div");
//     div.style.border = "1px solid #ccc";
//     div.style.margin = "10px";
//     div.style.padding = "10px";
//     div.style.borderRadius = "8px";

//     // Extract only product_name and color
//     const productName = doc.fields.Name?.stringValue || "N/A";
//     const productColor = doc.fields.Colour?.stringValue || "N/A";

//     div.innerHTML = `
//       <strong>Product: ${productName}</strong><br>
//       <strong>Color: ${productColor}</strong>
//     `;
//     collectionsDiv.appendChild(div);
//   });
// } else {
//   collectionsDiv.innerHTML = "<p>No products found.</p>";
// }


//   } catch (err) {
//     console.error("Error fetching products:", err);
//     const collectionsDiv = document.getElementById("collections");
//     collectionsDiv.innerHTML = "<p>Error fetching products. Check console.</p>";
//   }
// }

// // Run on page load
// loadProductsCollection();



async function loadProductsCollection() {
  const userName = localStorage.getItem("user_name") || "User";
  document.getElementById("user-info").innerHTML = `<h2>Welcome, ${userName}</h2>`;

  const url = `https://firestore.googleapis.com/v1/projects/onlineshopping-ba6fb/databases/(default)/documents/Products`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const collectionsDiv = document.getElementById("collections");
    collectionsDiv.innerHTML = "";

    if (data.documents && data.documents.length > 0) {
      const products = data.documents.map(doc => {
        const fields = doc.fields;
        const product = { id: doc.name.split("/").pop() };
        
        // Loop through all fields dynamically
        for (let key in fields) {
          const valueObj = fields[key];
          // Determine Firestore value type
          const valueType = Object.keys(valueObj)[0]; // e.g., stringValue, integerValue
          product[key] = valueObj[valueType];
        }
        return product;
      });

      // function displayProducts(list) {
      //   collectionsDiv.innerHTML = "";
      //   list.forEach(p => {
      //     const div = document.createElement("div");
      //     div.style.border = "1px solid #ccc";
      //     div.style.borderRadius = "8px";
      //     div.style.margin = "10px";
      //     div.style.padding = "10px";
      //     div.style.width = "220px";
      //     div.style.textAlign = "center";

      //     let innerHTML = "";
      //     if (p.image) {
      //       innerHTML += `<img src="${p.image}" alt="${p.id}" style="width:100%; height:150px; object-fit:cover; border-radius:5px;">`;
      //     }
      //     for (let key in p) {
      //       if (key !== "id" && key !== "image") {
      //         innerHTML += `<p><strong>${key}:</strong> ${p[key]}</p>`;
      //       }
      //     }

      //     div.innerHTML = innerHTML;
      //     collectionsDiv.appendChild(div);
      //   });
      // }
function displayProducts(list) {
  collectionsDiv.innerHTML = "";
  list.forEach(p => {
    const div = document.createElement("div");
    div.style.border = "1px solid #ccc";
    div.style.borderRadius = "8px";
    div.style.margin = "10px";
    div.style.padding = "10px";
    div.style.width = "220px";
    div.style.textAlign = "center";

    let innerHTML = "";
    if (p.image) {
      innerHTML += `<img src="${p.image}" alt="${p.id}" style="width:100%; height:150px; object-fit:cover; border-radius:5px;">`;
    }

    // Display fields in preferred order
    const preferredOrder = ["name", "color", "price"];
    preferredOrder.forEach(key => {
      if (p[key]) {
        innerHTML += `<p><strong>${key}:</strong> ${p[key]}</p>`;
      }
    });

    // Display remaining fields
    for (let key in p) {
      if (!preferredOrder.includes(key) && key !== "id" && key !== "image") {
        innerHTML += `<p><strong>${key}:</strong> ${p[key]}</p>`;
      }
    }

    div.innerHTML = innerHTML;
    collectionsDiv.appendChild(div);
  });
}

      displayProducts(products);

      // Search functionality (search across all string fields)
      const searchInput = document.getElementById("search");
      searchInput.addEventListener("input", () => {
        const query = searchInput.value.toLowerCase();
        const filtered = products.filter(p => {
          return Object.values(p).some(value => 
            typeof value === "string" && value.toLowerCase().includes(query)
          );
        });
        displayProducts(filtered);
      });

    } else {
      collectionsDiv.innerHTML = "<p>No products found.</p>";
    }

  } catch (err) {
    console.error("Error fetching products:", err);
    const collectionsDiv = document.getElementById("collections");
    collectionsDiv.innerHTML = "<p>Error fetching products. Check console.</p>";
  }
}

loadProductsCollection();

