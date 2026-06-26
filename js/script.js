function toggleNav() {
  var nav = document.getElementById("mainNav");
  if (nav) nav.classList.toggle("open");
}

document.addEventListener("DOMContentLoaded", function () {
  let slides = document.querySelectorAll(".slide");
  let index = 0;

  if (slides.length === 0) return;

  function showSlide() {
    slides.forEach(slide => slide.classList.remove("active"));
    slides[index].classList.add("active");
    index = (index + 1) % slides.length;
  }

  setInterval(showSlide, 3000);
});

function renderProjects(projects, limit) {
  const container = document.getElementById("projectsContainer");
  if (!container) return;
  var sorted = projects.slice().sort(function (a, b) { return b.id - a.id; });
  const items = limit ? sorted.slice(0, limit) : sorted;
  container.innerHTML = items.map(function (p) {
    var id = p.id;
    var imgSrc = p.images && p.images.length ? p.images[0] : (p.image || "");
    var descId = "desc-" + id;
    return '<div class="service">' +
      '<img src="' + imgSrc + '" alt="' + p.title + '">' +
      '<h2>' + p.title + '</h2>' +
      '<h2>Description</h2>' +
      '<div class="desc-wrap">' +
        '<div class="desc-text" id="' + descId + '">' + p.description + '</div>' +
        '<button class="read-more-btn" onclick="toggleDesc(\'' + descId + '\', this)">Read More</button>' +
      '</div>' +
      '<div class="btn-row">' +
        '<button class="view-btn" onclick="window.open(\'project-detail.html?id=' + id + '\', \'_blank\')"><i class="fa-solid fa-arrow-right"></i> View Project</button>' +
      '</div>' +
    '</div>';
  }).join("");
}

function toggleDesc(id, btn) {
  var el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle("open");
  btn.textContent = el.classList.contains("open") ? "Read Less" : "Read More";
}

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

function loadProjects() {
  var max = document.getElementById("projectsContainer")?.dataset?.limit;
  var limit = max ? parseInt(max) : null;
  openDB().then(function (db) {
    var tx = db.transaction("projects", "readonly");
    var store = tx.objectStore("projects");
    var all = store.getAll();
    all.onsuccess = function () {
      if (all.result && all.result.length) { renderProjects(all.result, limit); return; }
      fallbackLoad(limit);
    };
    all.onerror = function () { fallbackLoad(limit); };
  }).catch(function () { fallbackLoad(limit); });
}

function fallbackLoad(limit) {
  var local = localStorage.getItem("adminProjects");
  if (local) { try { renderProjects(JSON.parse(local), limit); return; } catch (_) {} }
  fetch("projects.json").then(function (r) { return r.json(); }).then(function (p) {
    localStorage.setItem("adminProjects", JSON.stringify(p));
    renderProjects(p, limit);
  }).catch(function () { renderProjects([], limit); });
}

function closeNewsModal() {
  document.getElementById("newsModalOverlay").style.display = "none";
}

function loadNews() {
  var ticker = document.getElementById("newsTicker");
  if (!ticker) return;
  openDB().then(function (db) {
    var tx = db.transaction("news", "readonly");
    var store = tx.objectStore("news");
    var all = store.getAll();
    all.onsuccess = function () {
      if (all.result && all.result.length) {
        var items = all.result;
        if (!items[0].heading) {
          items = items.map(function (n, i) { return { id: n.id || i + 1, heading: n.text || "News", text: n.text || "", image: n.image || "", active: n.active !== false }; });
        }
        renderTicker(items.filter(function (n) { return n.active !== false; }));
        return;
      }
      fallbackNews();
    };
    all.onerror = function () { fallbackNews(); };
  }).catch(function () { fallbackNews(); });
}

function fallbackNews() {
  var local = localStorage.getItem("adminNews");
  if (local) {
    try {
      var items = JSON.parse(local);
      if (items.length && !items[0].heading) {
        items = items.map(function (n, i) { return { id: n.id || i + 1, heading: n.text || "News", text: n.text || "", image: n.image || "", active: n.active !== false }; });
      }
      renderTicker(items.filter(function (n) { return n.active !== false; }));
      // migrate to IndexedDB
      openDB().then(function (db) {
        var tx = db.transaction("news", "readwrite");
        var store = tx.objectStore("news");
        store.clear();
        items.forEach(function (n) { store.put(n); });
      });
    } catch (_) {}
    return;
  }
  fetch("news.json").then(function (r) { return r.json(); }).then(function (data) {
    var items = data.map(function (n) { return Object.assign({}, n, { active: n.active !== false }); });
    renderTicker(items.filter(function (n) { return n.active !== false; }));
    openDB().then(function (db) {
      var tx = db.transaction("news", "readwrite");
      var store = tx.objectStore("news");
      store.clear();
      items.forEach(function (n) { store.put(n); });
    });
  }).catch(function () {});
}

let _newsData = [];

function renderTicker(active) {
  var ticker = document.getElementById("newsTicker");
  if (!ticker) return;
  _newsData = active.length ? active : [];
  ticker.innerHTML = _newsData.map(function (n, i) {
    var imgHtml = n.image && n.image.length > 10 ? '<img src="' + n.image + '" style="width:22px;height:22px;object-fit:cover;border-radius:4px;vertical-align:middle;margin-right:6px;" onerror="this.style.display=\'none\'">' : "";
    var linkIcon = n.link ? '<i class="fa-solid fa-external-link" style="font-size:11px;margin-left:4px;"></i>' : "";
    var clickHandler = n.link ? "window.open('" + n.link.replace(/'/g, "\\'") + "','_blank')" : "openNewsModal(" + i + ")";
    return '<a href="#" onclick="' + clickHandler + '; return false;" style="color:#f5f23d;text-decoration:none;white-space:nowrap;">' + imgHtml + (n.heading || n.text) + linkIcon + '</a>';
  }).join(" <span style='color:#f5f23d;margin:0 4px;'>&bull;</span> ") + " <span style='color:#f5f23d;margin:0 4px;'>&bull;</span>";
}

function openNewsModal(index) {
  var item = _newsData[index];
  if (!item) return;
  var overlay = document.getElementById("newsModalOverlay");
  var img = document.getElementById("newsModalImage");
  var title = document.getElementById("newsModalTitle");
  var text = document.getElementById("newsModalText");
  var linkWrap = document.getElementById("newsModalLink");
  var hasImg = item.image && item.image.length > 10;
  if (hasImg) {
    img.src = item.image;
    img.style.display = "block";
    img.onerror = function () { this.style.display = "none"; };
  } else {
    img.style.display = "none";
  }
  title.textContent = item.heading || "News";
  text.textContent = item.text || "";
  if (linkWrap) {
    if (item.link) {
      linkWrap.style.display = "block";
      linkWrap.innerHTML = '<a href="' + item.link + '" target="_blank" style="color:#007bff;text-decoration:none;font-weight:500;"><i class="fa-solid fa-external-link"></i> ' + item.link + '</a>';
    } else {
      linkWrap.style.display = "none";
    }
  }
  overlay.style.display = "flex";
}

loadProjects();
loadNews();
ensureAdminAccount();
checkAuth();

function ensureAdminAccount() {
  const users = JSON.parse(localStorage.getItem("users") || "[]");
  if (!users.find(u => u.email === "admin@admin.com")) {
    users.push({
      fname: "Admin",
      lname: "",
      email: "admin@admin.com",
      password: "admin123",
      phone: ""
    });
    localStorage.setItem("users", JSON.stringify(users));
  }
}

function handleLogout() {
  localStorage.removeItem("loggedInUser");
  checkAuth();
}

function checkAuth() {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));
  const loginNavItem = document.getElementById("loginNavItem");
  const logoutNavItem = document.getElementById("logoutNavItem");
  const adminNavItem = document.getElementById("adminNavItem");

  if (user) {
    loginNavItem.style.display = "none";
    logoutNavItem.style.display = "";
    if (adminNavItem) {
      adminNavItem.style.display = user.email === "admin@admin.com" ? "" : "none";
    }
  } else {
    loginNavItem.style.display = "";
    logoutNavItem.style.display = "none";
    if (adminNavItem) {
      adminNavItem.style.display = "none";
    }
  }
}

/*counter*/
const counters = document.querySelectorAll('.counter');
const projects = document.querySelectorAll('.project');

let started = false;

window.addEventListener('scroll', () => {
  const section = document.querySelector('.count');
  const sectionTop = section.getBoundingClientRect().top;

  if (sectionTop < window.innerHeight - 100 && !started) {
    startCounting();
    showBoxes();
    started = true;
  }
});

function startCounting() {
  counters.forEach(counter => {
    const target = +counter.getAttribute('data-target');
    let count = 0;
    const speed = target / 100;

    const update = () => {
      count += speed;
      if (count < target) {
        counter.innerText = Math.ceil(count);
        requestAnimationFrame(update);
      } else {
        counter.innerText = target + "+";
      }
    };

    update();
  });
}

function showBoxes() {
  projects.forEach((box, index) => {
    setTimeout(() => {
      box.classList.add('show');
    }, index * 200);
  });
}


// Form Validation

const form = document.getElementById("contactForm");

form.addEventListener("submit", function(e){

    e.preventDefault();

    // Inputs
    const name = document.getElementById("name");
    const email = document.getElementById("email");
    const phone = document.getElementById("phone");
    const message = document.getElementById("message");

    // Error Elements
    const nameError = document.getElementById("nameError");
    const emailError = document.getElementById("emailError");
    const phoneError = document.getElementById("phoneError");
    const messageError = document.getElementById("messageError");

    // Reset Errors
    nameError.textContent = "";
    emailError.textContent = "";
    phoneError.textContent = "";
    messageError.textContent = "";

    // Remove old classes
    name.classList.remove("input-error","input-success");
    email.classList.remove("input-error","input-success");
    phone.classList.remove("input-error","input-success");
    message.classList.remove("input-error","input-success");

    let isValid = true;

    // Name Validation
    if(name.value.trim() === ""){
        nameError.textContent = "Name is required";
        name.classList.add("input-error");
        isValid = false;
    }else{
        name.classList.add("input-success");
    }

    // Email Validation
    const emailPattern = /^[^ ]+@[^ ]+\.[a-z]{2,3}$/;

    if(email.value.trim() === ""){
        emailError.textContent = "Email is required";
        email.classList.add("input-error");
        isValid = false;
    }
    else if(!email.value.match(emailPattern)){
        emailError.textContent = "Enter valid email";
        email.classList.add("input-error");
        isValid = false;
    }
    else{
        email.classList.add("input-success");
    }

    // Phone Validation
    if(phone.value.trim() === ""){
        phoneError.textContent = "Phone number is required";
        phone.classList.add("input-error");
        isValid = false;
    }
    else if(phone.value.length < 11){
        phoneError.textContent = "Phone number must be 11 digits";
        phone.classList.add("input-error");
        isValid = false;
    }
    else{
        phone.classList.add("input-success");
    }

    // Message Validation
    if(message.value.trim() === ""){
        messageError.textContent = "Message is required";
        message.classList.add("input-error");
        isValid = false;
    }else{
        message.classList.add("input-success");
    }

    // Success
    if(isValid){
        alert("Form Submitted Successfully");
        form.reset();
    }

});