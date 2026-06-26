var projects = [];
var DB_NAME = "FNCConstruction";
var DB_VER = 1;

function openDB() {
  return new Promise(function (resolve, reject) {
    var req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = function (e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
      if (!db.objectStoreNames.contains("news")) db.createObjectStore("news", { keyPath: "id" });
    };
    req.onsuccess = function (e) { resolve(e.target.result); };
    req.onerror = function (e) { reject(e.target.error); };
  });
}

(function checkAdminAuth() {
  var user = JSON.parse(localStorage.getItem("loggedInUser"));
  if (!user || user.email !== "admin@admin.com") {
    alert("Access denied. Admin login required.");
    window.location.href = "index.html";
  }
})();

function switchTab(tab) {
  document.querySelectorAll(".sidebar-item").forEach(function (el) { el.classList.remove("active"); });
  document.querySelectorAll(".section-panel").forEach(function (el) { el.classList.remove("active"); });
  var t = document.getElementById("tab-" + tab); if (t) t.classList.add("active");
  var p = document.getElementById("panel-" + tab); if (p) p.classList.add("active");
}

function saveToLocal() {
  openDB().then(function (db) {
    var tx = db.transaction("projects", "readwrite");
    var store = tx.objectStore("projects");
    store.clear();
    projects.forEach(function (p) { store.put(p); });
  }).catch(function (err) {
    console.error("IndexedDB save failed:", err);
    alert("Storage error. Please try again.");
  });
}

async function loadProjects() {
  try {
    var db = await openDB();
    var tx = db.transaction("projects", "readonly");
    var store = tx.objectStore("projects");
    var all = store.getAll();
    all.onsuccess = function () {
      if (all.result && all.result.length) {
        projects = all.result;
        renderProjects();
        populateProjectSelect();
        return;
      }
      fallbackLoadProjects();
    };
    all.onerror = function () { fallbackLoadProjects(); };
  } catch (e) {
    fallbackLoadProjects();
  }
}

function fallbackLoadProjects() {
  var local = localStorage.getItem("adminProjects");
  if (local) {
    try { projects = JSON.parse(local); saveToLocal(); renderProjects(); populateProjectSelect(); return; } catch (_) {}
  }
  fetch("projects.json").then(function (r) { return r.json(); }).then(function (p) {
    projects = p; saveToLocal(); renderProjects(); populateProjectSelect();
  }).catch(function () {
    projects = []; saveToLocal(); renderProjects(); populateProjectSelect();
  });
}

function renderProjects() {
  const container = document.getElementById("projectsList");
  const count = document.getElementById("projectCount");
  if (count) count.textContent = projects.length;
  if (!projects.length) {
    container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-folder-open"></i><p>No projects yet</p></div>';
    return;
  }
  container.innerHTML = projects.map(p => {
    const imgSrc = p.images && p.images.length ? p.images[0] : (p.image || "");
    return `
    <div class="list-item">
      <img class="thumb" src="${imgSrc}" alt="${p.title}">
      <div class="info">
        <h4>${p.title}</h4>
        <p>${(p.description || "").substring(0, 80)}${(p.description || "").length > 80 ? "..." : ""}</p>
      </div>
      <div class="item-actions">
        <button class="btn btn-sm btn-primary" onclick="editProject(${p.id})"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-sm btn-danger" onclick="deleteProject(${p.id})"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  `}).join("");
}

let _projectImages = [];
let _fileStore = {};

function handleImages(event) {
  var files = Array.from(event.target.files);
  if (!files.length) return;
  Promise.all(files.map(function (file) {
    return new Promise(function (resolve) {
      var reader = new FileReader();
      reader.onload = function (e) { resolve(e.target.result); };
      reader.onerror = function () { console.error("Failed to read:", file.name); resolve(null); };
      reader.readAsDataURL(file);
    });
  })).then(function (results) {
    var valid = results.filter(function (r) { return r !== null; });
    _projectImages = _projectImages.concat(valid);
    renderImagePreviews();
    if (valid.length < files.length) {
      alert("Some images could not be read and were skipped.");
    }
  });
  event.target.value = "";
}

function removeImage(index) {
  _projectImages.splice(index, 1);
  renderImagePreviews();
}

function renderImagePreviews() {
  const grid = document.getElementById("imagePreviewGrid");
  const hidden = document.getElementById("projectImagesData");
  if (!grid) return;
  if (!_projectImages.length) {
    grid.innerHTML = '<span class="img-empty">No images selected</span>';
    if (hidden) hidden.value = "";
    return;
  }
  grid.innerHTML = _projectImages.map((src, i) => `
    <div class="img-item ${i === 0 ? 'cover' : ''}">
      <img src="${src}">
      <button type="button" class="remove-btn" onclick="removeImage(${i})">&times;</button>
      ${i === 0 ? '<span class="cover-badge">Cover</span>' : ''}
    </div>
  `).join("");
  if (hidden) hidden.value = JSON.stringify(_projectImages);
}

function setFileData(nameField, dataField, event) {
  const file = event.target.files[0];
  if (!file) return;
  document.getElementById(nameField).value = file.name;
  document.getElementById(dataField).value = "";
  const reader = new FileReader();
  reader.onload = function (e) {
    _fileStore[dataField] = e.target.result;
    document.getElementById(dataField).value = e.target.result;
  };
  reader.readAsDataURL(file);
}

document.getElementById("projectDoc").addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const titleField = document.getElementById("projectTitle");
  const descField = document.getElementById("projectDesc");
  if (titleField.value.trim() && descField.value.trim()) return;
  const ext = file.name.split(".").pop().toLowerCase();
  const reader = new FileReader();
  if (ext === "txt") {
    reader.onload = function (ev) {
      const text = ev.target.result;
      const lines = text.split("\n").filter(l => l.trim());
      if (!titleField.value.trim() && lines.length) {
        titleField.value = lines[0].trim();
      }
      if (!descField.value.trim() && lines.length > 1) {
        descField.value = lines.slice(1).join("\n").trim();
      } else if (!descField.value.trim() && lines.length === 1) {
        descField.value = lines[0].trim();
      }
    };
    reader.readAsText(file);
  } else if (ext === "docx") {
    reader.onload = function (ev) {
      const text = ev.target.result;
      const match = text.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
      if (match) {
        const content = match.map(t => t.replace(/<[^>]+>/g, "")).join(" ").replace(/\s+/g, " ").trim();
        const parts = content.split(/[.\n]/).filter(s => s.trim());
        if (!titleField.value.trim() && parts.length) {
          titleField.value = parts[0].trim().substring(0, 60);
        }
        if (!descField.value.trim() && parts.length > 1) {
          descField.value = parts.slice(1).join(". ").trim().substring(0, 500);
        }
      } else {
        alert("Could not extract text from this .docx file. Please fill in Title and Description manually.");
      }
    };
    reader.readAsBinaryString(file);
  } else if (ext === "pdf") {
    reader.onload = function (ev) {
      const text = ev.target.result;
      const match = text.match(/[\x20-\x7E]{10,}/g);
      if (match) {
        const content = match.join(" ");
        const parts = content.split(/[.\n]/).filter(s => s.trim());
        if (!titleField.value.trim() && parts.length) {
          titleField.value = parts[0].trim().substring(0, 60);
        }
        if (!descField.value.trim() && parts.length > 1) {
          descField.value = parts.slice(1).join(". ").trim().substring(0, 500);
        }
      } else {
        alert("Could not extract text from this PDF. Please fill in Title and Description manually.");
      }
    };
    reader.readAsBinaryString(file);
  } else {
    alert("Unsupported file type. Please use .txt, .docx, or .pdf.");
  }
});

document.getElementById("projectForm").addEventListener("submit", function (e) {
  e.preventDefault();
  try {
    var id = document.getElementById("projectId").value;
    var title = document.getElementById("projectTitle").value.trim();
    var description = document.getElementById("projectDesc").value.trim();
    var images = _projectImages.length ? _projectImages.slice() : null; // copy the array
    var pdf = document.getElementById("projectPdf").value.trim();
    var pdfData = _fileStore["projectPdfData"] || document.getElementById("projectPdfData").value;
    var docx = document.getElementById("projectDocx").value.trim();
    var docxData = _fileStore["projectDocxData"] || document.getElementById("projectDocxData").value;
    var link = document.getElementById("projectLink").value.trim();

    if (!title || !description) {
      alert("Please fill in Title and Description.");
      return;
    }

    if (id) {
      var idx = projects.findIndex(function (p) { return p.id == id; });
      if (idx !== -1) {
        projects[idx] = { ...projects[idx], title: title, description: description, images: images || projects[idx].images || null, pdf: pdf, pdfData: pdfData || projects[idx].pdfData || "", docx: docx, docxData: docxData || projects[idx].docxData || "", link: link };
      }
      alert("Project updated successfully!");
    } else {
      var newId = projects.length ? Math.max.apply(null, projects.map(function (p) { return p.id; })) + 1 : 1;
      if (!images) { alert("Please add at least one image."); return; }
      projects.push({ id: newId, title: title, description: description, images: images, pdf: pdf, pdfData: pdfData, docx: docx, docxData: docxData, link: link });
      alert("Project \"" + title + "\" saved successfully!");
    }

    this.reset();
    document.getElementById("projectId").value = "";
    document.getElementById("projectPdfData").value = "";
    document.getElementById("projectDocxData").value = "";
    document.getElementById("imagePreviewGrid").innerHTML = '<span class="img-empty">No images selected</span>';
    _fileStore = {};
    _projectImages = [];
    document.getElementById("formTitle").innerHTML = '<i class="fa-solid fa-plus-circle" style="color:#007bff;margin-right:8px;"></i>Add New Project';
    document.getElementById("saveBtn").innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Project';
    document.getElementById("cancelBtn").style.display = "none";
    saveToLocal();
    renderProjects();
    populateProjectSelect();
  } catch (err) {
    console.error("Form submit error:", err);
    alert("Error saving project. Check console for details.");
  }
});

function editProject(id) {
  const p = projects.find(proj => proj.id === id);
  if (!p) return;
  document.getElementById("projectId").value = p.id;
  document.getElementById("projectTitle").value = p.title;
  document.getElementById("projectDesc").value = p.description;
  _projectImages = p.images ? [...p.images] : (p.image ? [p.image] : []);
  renderImagePreviews();
  document.getElementById("projectPdf").value = p.pdf || "";
  document.getElementById("projectPdfData").value = p.pdfData || "";
  document.getElementById("projectDocx").value = p.docx || "";
  document.getElementById("projectDocxData").value = p.docxData || "";
  document.getElementById("projectLink").value = p.link || "";
  document.getElementById("formTitle").innerHTML = '<i class="fa-solid fa-pen" style="color:#007bff;margin-right:8px;"></i>Edit Project';
  document.getElementById("saveBtn").innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Project';
  document.getElementById("cancelBtn").style.display = "inline-block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelEdit() {
  document.getElementById("projectForm").reset();
  document.getElementById("projectId").value = "";
  document.getElementById("projectPdfData").value = "";
  document.getElementById("projectDocxData").value = "";
  _fileStore = {};
  _projectImages = [];
  document.getElementById("imagePreviewGrid").innerHTML = '<span class="img-empty">No images selected</span>';
  document.getElementById("formTitle").innerHTML = '<i class="fa-solid fa-plus-circle" style="color:#007bff;margin-right:8px;"></i>Add New Project';
  document.getElementById("saveBtn").innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Project';
  document.getElementById("cancelBtn").style.display = "none";
}

function deleteProject(id) {
  if (!confirm("Delete this project?")) return;
  projects = projects.filter(p => p.id !== id);
  saveToLocal();
  renderProjects();
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(projects, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "projects.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data)) {
        projects = data;
        saveToLocal();
        renderProjects();
        populateProjectSelect();
        alert("Projects imported successfully!");
      } else {
        alert("Invalid format. Must be an array of projects.");
      }
    } catch {
      alert("Invalid JSON file.");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

loadProjects();
loadNews();

/* ========== NEWS MANAGEMENT ========== */

var news = [];

function saveNewsToLocal() {
  openDB().then(function (db) {
    var tx = db.transaction("news", "readwrite");
    var store = tx.objectStore("news");
    store.clear();
    news.forEach(function (n) { store.put(n); });
  }).catch(function (err) {
    console.error("IndexedDB news save failed:", err);
  });
}

function loadNews() {
  openDB().then(function (db) {
    var tx = db.transaction("news", "readonly");
    var store = tx.objectStore("news");
    var all = store.getAll();
    all.onsuccess = function () {
      if (all.result && all.result.length) {
        news = all.result;
        if (news.length && !news[0].heading) {
          news = news.map(function (n, i) { return { id: n.id || i + 1, heading: n.text || "News", text: n.text || "", image: n.image || "", active: n.active !== false }; });
          saveNewsToLocal();
        }
        renderNews();
        return;
      }
      fallbackLoadNews();
    };
    all.onerror = function () { fallbackLoadNews(); };
  }).catch(function () { fallbackLoadNews(); });
}

function fallbackLoadNews() {
  var local = localStorage.getItem("adminNews");
  if (local) {
    try {
      news = JSON.parse(local);
      if (news.length && !news[0].heading) {
        news = news.map(function (n, i) { return { id: n.id || i + 1, heading: n.text || "News", text: n.text || "", image: n.image || "", active: n.active !== false }; });
      }
      saveNewsToLocal(); // migrate to IndexedDB
      renderNews();
      return;
    } catch (_) {}
  }
  fetch("news.json").then(function (r) { return r.json(); }).then(function (data) {
    news = data.map(function (n) { return Object.assign({}, n, { active: n.active !== false }); });
    saveNewsToLocal();
    renderNews();
  }).catch(function () { news = []; renderNews(); });
}

function renderNews() {
  const container = document.getElementById("newsList");
  const count = document.getElementById("newsCount");
  if (count) count.textContent = news.length;
  if (!container) return;
  if (!news.length) {
    container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-newspaper"></i><p>No news items yet</p></div>';
    return;
  }
  container.innerHTML = news.map(n => `
    <div class="list-item">
      ${n.image && n.image !== "img/" ? `<img class="thumb" src="${n.image}" alt="">` : '<div class="thumb" style="background:#f0f2f5;display:flex;align-items:center;justify-content:center;color:#ccc;"><i class="fa-solid fa-newspaper"></i></div>'}
      <div class="info">
        <h4>${n.heading || "Untitled"} <span class="status-badge ${n.active ? 'active' : 'inactive'}">${n.active ? 'Active' : 'Inactive'}</span></h4>
        <p>${(n.text || "").substring(0, 60)}${(n.text || "").length > 60 ? "..." : ""}</p>
      </div>
      <div class="item-actions" style="flex-wrap:wrap;">
        <button class="btn btn-xs ${n.active ? 'btn-warning' : 'btn-success'}" onclick="toggleNews(${n.id})"><i class="fa-solid ${n.active ? 'fa-pause' : 'fa-play'}"></i></button>
        <button class="btn btn-xs btn-primary" onclick="editNews(${n.id})"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-xs btn-danger" onclick="deleteNews(${n.id})"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  `).join("");
}

document.getElementById("newsForm").addEventListener("submit", function (e) {
  e.preventDefault();
  var id = document.getElementById("newsId").value;
  var heading = document.getElementById("newsHeading").value.trim();
  var text = document.getElementById("newsText").value.trim();
  var image = document.getElementById("newsImage").value.trim();
  var imageData = document.getElementById("newsImageData").value;
  var link = document.getElementById("newsLink").value.trim();
  var active = document.getElementById("newsActive").checked;

  if (!heading) { alert("Heading is required."); return; }

  if (id) {
    var idx = news.findIndex(function (n) { return n.id == id; });
    if (idx !== -1) {
      news[idx] = Object.assign({}, news[idx], { heading: heading, text: text, image: imageData || image || news[idx].image || "", link: link || news[idx].link || "", active: active });
    }
  } else {
    var newId = news.length ? Math.max.apply(null, news.map(function (n) { return n.id; })) + 1 : 1;
    news.push({ id: newId, heading: heading, text: text, image: imageData || image || "", link: link, active: active });
  }

  saveNewsToLocal();
  this.reset();
  document.getElementById("newsId").value = "";
  document.getElementById("newsImageData").value = "";
  document.getElementById("newsFormTitle").innerHTML = '<i class="fa-solid fa-plus-circle" style="color:#007bff;margin-right:8px;"></i>Add News';
  document.getElementById("saveNewsBtn").innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Add News';
  document.getElementById("cancelNewsBtn").style.display = "none";
  document.getElementById("newsActive").checked = true;
  renderNews();
  populateProjectSelect();
});

function editNews(id) {
  var n = news.find(function (item) { return item.id === id; });
  if (!n) return;
  document.getElementById("newsId").value = n.id;
  document.getElementById("newsHeading").value = n.heading || "";
  document.getElementById("newsText").value = n.text || "";
  document.getElementById("newsImage").value = n.image && n.image.indexOf("data:") === 0 ? "(image loaded)" : (n.image || "");
  document.getElementById("newsImageData").value = n.image && n.image.indexOf("data:") === 0 ? n.image : "";
  document.getElementById("newsLink").value = n.link || "";
  document.getElementById("newsActive").checked = n.active !== false;
  document.getElementById("newsFormTitle").innerHTML = '<i class="fa-solid fa-pen" style="color:#007bff;margin-right:8px;"></i>Edit News';
  document.getElementById("saveNewsBtn").innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update News';
  document.getElementById("cancelNewsBtn").style.display = "inline-block";
  window.scrollTo({ top: document.getElementById("newsForm").offsetTop - 100, behavior: "smooth" });
}

function cancelNewsEdit() {
  document.getElementById("newsForm").reset();
  document.getElementById("newsId").value = "";
  document.getElementById("newsImageData").value = "";
  document.getElementById("newsFormTitle").innerHTML = '<i class="fa-solid fa-plus-circle" style="color:#007bff;margin-right:8px;"></i>Add News';
  document.getElementById("saveNewsBtn").innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Add News';
  document.getElementById("cancelNewsBtn").style.display = "none";
  document.getElementById("newsActive").checked = true;
}

function deleteNews(id) {
  if (!confirm("Delete this news item?")) return;
  news = news.filter(n => n.id !== id);
  saveNewsToLocal();
  renderNews();
}

function toggleNews(id) {
  const n = news.find(item => item.id === id);
  if (n) {
    n.active = !n.active;
    saveNewsToLocal();
    renderNews();
  }
}

function setNewsImage(event) {
  var file = event.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function (e) {
    document.getElementById("newsImage").value = file.name;
    document.getElementById("newsImageData").value = e.target.result;
  };
  reader.readAsDataURL(file);
}

function fetchLinkTitle(url) {
  if (!url || !url.match(/^https?:\/\//)) return;
  var headingField = document.getElementById("newsHeading");
  if (headingField.value.trim()) return;
  fetch(url).then(function (r) { return r.text(); }).then(function (html) {
    var m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (m && m[1]) headingField.value = m[1].trim().substring(0, 100);
  }).catch(function () {});
}

function populateProjectSelect() {
  const select = document.getElementById("projectSelect");
  if (!select) return;
  const local = localStorage.getItem("adminProjects");
  let projs = [];
  if (local) { try { projs = JSON.parse(local); } catch (_) {} }
  select.innerHTML = '<option value="">-- Select a project --</option>';
  projs.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.title;
    select.appendChild(opt);
  });
}

function addProjectAsNews() {
  const select = document.getElementById("projectSelect");
  const id = select.value;
  if (!id) { alert("Please select a project."); return; }
  const local = localStorage.getItem("adminProjects");
  let projs = [];
  if (local) { try { projs = JSON.parse(local); } catch (_) {} }
  const project = projs.find(p => p.id == id);
  if (!project) return;
  const newId = news.length ? Math.max(...news.map(n => n.id)) + 1 : 1;
  news.push({
    id: newId,
    heading: project.title,
    text: project.description,
    image: project.image || "",
    active: true
  });
  saveNewsToLocal();
  renderNews();
  select.value = "";
  alert("Project added as news!");
}

function exportNewsJSON() {
  const data = news.map(n => ({ heading: n.heading, text: n.text, image: n.image, active: n.active }));
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "news.json";
  a.click();
  URL.revokeObjectURL(a.href);
}
