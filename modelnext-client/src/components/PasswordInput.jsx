import React, { useState } from "react";
import "../styles/PasswordInput.css";

export default function PasswordInput({ className = "", disabled, readOnly, ...inputProps }) {
  const [visible, setVisible] = useState(false);
  return <span className={`mn-password-input ${className}`.trim()}>
    <input {...inputProps} type={visible ? "text" : "password"} disabled={disabled} readOnly={readOnly} />
    <button
      type="button"
      className="mn-password-toggle"
      aria-label={visible ? "Hide password" : "Show password"}
      aria-pressed={visible}
      onClick={() => setVisible((current) => !current)}
      disabled={disabled}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {visible
          ? <><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.1 9.5 7-.4 1.2-1.3 2.5-2.5 3.6M6.2 6.2C3.9 7.7 2.8 9.9 2.5 12c.8 2.6 4.3 7 9.5 7 1.1 0 2.1-.2 3.1-.6" />
          </>
          : <><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" /><circle cx="12" cy="12" r="2.5" /></>}
      </svg>
    </button>
  </span>;
}
