import { useState } from "react";
import "../styles/clientForm.css";

export default function ClientForm() {

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

  const handleSubmit = (e) => {
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

    alert("Registration Successful!");
    console.log(form);
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