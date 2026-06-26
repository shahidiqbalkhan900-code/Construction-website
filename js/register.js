document.getElementById("registerForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const fname = document.getElementById("fname").value.trim();
  const lname = document.getElementById("lname").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value.trim();
  const phone = document.getElementById("phone").value.trim();

  if (!fname || !lname || !email || !password || !phone) {
    alert("All fields are required.");
    return;
  }

  const users = JSON.parse(localStorage.getItem("users") || "[]");

  if (users.find(u => u.email === email)) {
    alert("This email is already registered. Please login.");
    return;
  }

  users.push({ fname, lname, email, password, phone });
  localStorage.setItem("users", JSON.stringify(users));

  alert("Registration successful! You can now login.");
  document.getElementById("registerForm").reset();
});
