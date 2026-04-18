import { useNavigate } from "react-router-dom";

export default function RoleSelection() {
  const navigate = useNavigate();

  return (
    <div>
      <h1>Select Your Role</h1>

      <button onClick={() => navigate("/register?role=model")}>
        Model
      </button>

      <button onClick={() => navigate("/register?role=photographer")}>
        Photographer
      </button>

      <button onClick={() => navigate("/register?role=agency")}>
        Agency
      </button>

      <button onClick={() => navigate("/register?role=client")}>
        Client
      </button>
    </div>
  );
}