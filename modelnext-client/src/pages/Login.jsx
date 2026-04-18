import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();

  return (
    <div>
      <h1>Login</h1>

      <input placeholder="Email" />
      <input placeholder="Password" type="password" />

      <button>Login</button>

      <p onClick={() => navigate("/role")}>
        Don't have account? Register
      </p>
    </div>
  );
}