import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/clientForm.css";


export default function ClientForm() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    type: "",
    name: "",
    username: "",
    phone: "",
    email: "",
    address: "",
    password: "",
    confirmPassword: ""
  });

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    for (let key in form) {
      if (!form[key]) {
        alert("Please fill all fields");
        return;
      }
    }

    if (form.password !== form.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/api/clients/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to register");

      alert("Registration Successful!");
      navigate("/client-portal");
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
  };

  return (
    <div className="form-page">

      <div className="form-box">

        <h1>Client Registration</h1>
        <p className="subtitle">Join ModelNext as a Client</p>

        <form onSubmit={handleSubmit}>

          {/* TYPE */}
          <select name="type" onChange={handleChange}>
            <option value="">Select Type</option>
            <option value="company">Company</option>
            <option value="individual">Individual</option>
          </select>

          {/* NAME */}
          <input
            name="name"
            placeholder={form.type === "company" ? "Company Name" : "Full Name"}
            onChange={handleChange}
          />

          {/* USERNAME */}
          <input name="username" placeholder="Username" onChange={handleChange} />

          {/* PHONE */}
          <input name="phone" placeholder="Phone Number" onChange={handleChange} />

          {/* EMAIL */}
          <input name="email" placeholder="Email Address" onChange={handleChange} />

          {/* ADDRESS */}
          <input name="address" placeholder="Address" onChange={handleChange} />

          {/* PASSWORD */}
          <input
            type="password"
            name="password"
            placeholder="Password"
            onChange={handleChange}
          />

          {/* CONFIRM PASSWORD */}
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            onChange={handleChange}
          />

          <button type="submit">CREATE ACCOUNT</button>

        </form>

      </div>

    </div>
  );
}