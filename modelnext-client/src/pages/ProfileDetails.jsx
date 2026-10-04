import React from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

const ProfileDetails = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const name = searchParams.get("name") || "Model";
  const role = searchParams.get("role") || "Model";
  const img = searchParams.get("img") || "";
  const location =
    searchParams.get("location") || "Sri Lanka";

  const handleBooking = () => {
    alert("Request sent!");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(135deg, #050505 0%, #101010 50%, #050505 100%)",
        color: "#ffffff",
        padding: "40px 8%",
        boxSizing: "border-box",
      }}
    >
      <button
        onClick={() => navigate(-1)}
        style={{
          background: "transparent",
          border: "1px solid #444",
          color: "#ffffff",
          borderRadius: "8px",
          padding: "10px 17px",
          cursor: "pointer",
          marginBottom: "35px",
        }}
      >
        ← BACK
      </button>

      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "55px",
            alignItems: "center",
            borderBottom: "1px solid #303030",
            paddingBottom: "45px",
          }}
        >
          {/* MODEL IMAGE */}
          <div
            style={{
              width: "300px",
              height: "400px",
              background: "#202020",
              borderRadius: "12px",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {img ? (
              <img
                src={img}
                alt={name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                  background: "#202020",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#d9edf7",
                  fontSize: "80px",
                  fontWeight: "700",
                }}
              >
                {name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* MODEL INFORMATION */}
          <div>
            <p
              style={{
                margin: "0 0 8px",
                color: "#9bbdcd",
                fontSize: "10px",
                letterSpacing: "2px",
                fontWeight: "700",
              }}
            >
              MODEL PROFILE
            </p>

            <h1
              style={{
                fontSize: "52px",
                lineHeight: "1.1",
                margin: "0 0 12px",
                fontWeight: "600",
              }}
            >
              {name}
            </h1>

            <p
              style={{
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                color: "#999",
                marginBottom: "30px",
              }}
            >
              {role} • {location}
            </p>

            <button
              onClick={handleBooking}
              style={{
                background: "#d9edf7",
                color: "#111111",
                border: "none",
                borderRadius: "9px",
                padding: "14px 24px",
                fontSize: "14px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              Book Talent →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileDetails;