import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div>
      <h1>ModelNext</h1>

      <button onClick={() => navigate("/role")}>
        Register
      </button>

      <button onClick={() => navigate("/login")}>
        Login
      </button>
    </div>
  );
}