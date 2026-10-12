
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SERVER_BASE_URL } from "../api";
import "../styles/photographerForm.css";

const imageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxImageSize = 5 * 1024 * 1024;

const PHOTOGRAPHY_STYLE_OPTIONS = [
  "Fashion",
  "Portrait",
  "Wedding",
  "Editorial",
  "Commercial",
  "Product",
  "Lifestyle",
  "Event",
  "Beauty",
  "Street Photography",
];

const PHOTOGRAPHER_SKILL_OPTIONS = [
  "Studio Lighting",
  "Natural Lighting",
  "Photo Editing",
  "Retouching",
  "Fashion Photography",
  "Portrait Photography",
  "Event Photography",
  "Product Photography",
  "Creative Direction",
  "Camera Operation",
];

export default function PhotographerForm() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const previewRef = useRef("");

  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    phone: "",
    location: "",
    experienceYears: "",
    portfolio: "",
    password: "",
    confirmPassword: "",
    profileImage: null,
    photographyStyles: [],
    skills: [],
  });

  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [styleDropdownOpen, setStyleDropdownOpen] = useState(false);
  const [skillsDropdownOpen, setSkillsDropdownOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
      }
    };
  }, []);

  const update = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const toggleSelection = (field, value, checked) => {
    setForm((current) => ({
      ...current,
      [field]: checked
        ? current[field].includes(value)
          ? current[field]
          : [...current[field], value]
        : current[field].filter((item) => item !== value),
    }));
  };

  const setImage = (file) => {
    if (!file) return;

    if (!imageTypes.includes(file.type)) {
      setError("Choose a JPEG, PNG, or WebP profile image.");
      return;
    }

    if (file.size > maxImageSize) {
      setError("Profile image must be 5 MiB or smaller.");
      return;
    }

    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
    }

    const url = URL.createObjectURL(file);
    previewRef.current = url;
    setPreview(url);
    setError("");

    setForm((current) => ({
      ...current,
      profileImage: file,
    }));
  };

  const removeImage = () => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
    }

    previewRef.current = "";
    setPreview("");

    setForm((current) => ({
      ...current,
      profileImage: null,
    }));

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    const required = [
      "name",
      "username",
      "email",
      "phone",
      "location",
      "experienceYears",
      "password",
      "confirmPassword",
    ];

    if (
      required.some((key) => !String(form[key]).trim()) ||
      !form.profileImage
    ) {
      setError(
        "Complete every required field, including your profile image."
      );
      return;
    }

    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(form.username)) {
      setError(
        "Username must use 3–40 letters, numbers, dots, hyphens, or underscores."
      );
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("Enter a valid email address.");
      return;
    }

    if (!/^[+()\-\s0-9]{7,25}$/.test(form.phone)) {
      setError("Enter a valid contact number.");
      return;
    }

    if (
      !Number.isFinite(Number(form.experienceYears)) ||
      Number(form.experienceYears) < 0
    ) {
      setError("Experience must be zero or more years.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const data = new FormData();

    Object.entries(form).forEach(([key, value]) => {
      if (key === "photographyStyles" || key === "skills") {
        data.append(key, JSON.stringify(value));
      } else if (value !== null && value !== undefined) {
        data.append(key, value);
      }
    });

    setSubmitting(true);

    try {
      const response = await fetch(
        `${SERVER_BASE_URL}/api/photographers/register`,
        {
          method: "POST",
          body: data,
          credentials: "include",
        }
      );

      const json = (
        response.headers.get("content-type") || ""
      ).includes("application/json")
        ? await response.json()
        : null;

      if (!response.ok) {
        throw new Error(
          json?.error ||
            "Registration is temporarily unavailable. Please try again."
        );
      }

      navigate("/photographer-dashboard", {
        state: { registrationSubmitted: true },
        replace: true,
      });
    } catch (caught) {
      setError(
        caught.message || "Unable to submit photographer registration."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="photographer-registration-page">
      <header className="photographer-registration-header">
        <Link className="photographer-wordmark" to="/">
          <span>Model</span>
          <span>Next</span>
        </Link>

        <nav aria-label="Registration navigation">
          <Link to="/">Back to Website</Link>
          <Link to="/login">Sign In</Link>
        </nav>
      </header>

      <section className="photographer-registration-shell">
        <aside className="photographer-registration-intro">
          <p className="photographer-kicker">
            MODELNEXT / CREATIVE NETWORK
          </p>

          <h1>Frame what comes next.</h1>

          <p>
            Build a professional profile, connect with creative talent,
            and collaborate on approved fashion projects.
          </p>

          <div className="photographer-image-stage">
            {preview ? (
              <img src={preview} alt="Selected profile preview" />
            ) : (
              <span aria-hidden="true">◉</span>
            )}
          </div>

          <div className="photographer-image-actions">
            <label className="photographer-upload-button">
              {preview ? "Replace portrait" : "Choose portrait"}

              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  setImage(event.target.files?.[0])
                }
              />
            </label>

            {preview && (
              <button type="button" onClick={removeImage}>
                Remove
              </button>
            )}
          </div>

          <small>
            JPEG, PNG, or WebP · maximum 5 MiB · required
          </small>
        </aside>

        <section className="photographer-registration-card">
          <p className="photographer-kicker">
            PHOTOGRAPHER APPLICATION
          </p>

          <h2>Create your account</h2>

          <p className="photographer-registration-copy">
            Your registration is reviewed before public profile access is
            enabled.
          </p>

          {error && (
            <p className="photographer-form-error" role="alert">
              {error}
            </p>
          )}

          <form onSubmit={submit} noValidate>
            <div className="photographer-form-grid">
              <label>
                Full name
                <input
                  name="name"
                  value={form.name}
                  onChange={update}
                  required
                />
              </label>

              <label>
                Username
                <input
                  name="username"
                  value={form.username}
                  onChange={update}
                  required
                />
              </label>

              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={update}
                  required
                />
              </label>

              <label>
                Contact number
                <input
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={update}
                  required
                />
              </label>

              <label>
                Location
                <input
                  name="location"
                  value={form.location}
                  onChange={update}
                  required
                />
              </label>

              <label>
                Experience (years)
                <input
                  name="experienceYears"
                  type="number"
                  min="0"
                  value={form.experienceYears}
                  onChange={update}
                  required
                />
              </label>

              {/* Photography styles multi-select dropdown */}
              <div className="photographer-form-wide photographer-choice-group">
                <label
                  className="photographer-field-label"
                  htmlFor="photography-styles-trigger"
                >
                  Photography styles
                </label>

                <div className="photographer-multiselect">
                  <button
                    id="photography-styles-trigger"
                    type="button"
                    className="photographer-dropdown-trigger"
                    onClick={() =>
                      setStyleDropdownOpen((open) => !open)
                    }
                    aria-expanded={styleDropdownOpen}
                    aria-controls="photography-styles-options"
                  >
                    <span>
                      {form.photographyStyles.length
                        ? `${form.photographyStyles.length} style(s) selected`
                        : "Select photography styles"}
                    </span>

                    <span aria-hidden="true">
                      {styleDropdownOpen ? "▲" : "▼"}
                    </span>
                  </button>

                  {form.photographyStyles.length > 0 && (
                    <div className="photographer-selected-tags">
                      {form.photographyStyles.map((style) => (
                        <button
                          type="button"
                          className="photographer-selected-tag"
                          key={style}
                          onClick={() =>
                            toggleSelection(
                              "photographyStyles",
                              style,
                              false
                            )
                          }
                          aria-label={`Remove ${style}`}
                        >
                          {style} <span aria-hidden="true">×</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {styleDropdownOpen && (
                    <div
                      id="photography-styles-options"
                      className="photographer-dropdown-options"
                    >
                      {PHOTOGRAPHY_STYLE_OPTIONS.map((style) => (
                        <label
                          className="photographer-dropdown-option"
                          key={style}
                        >
                          <input
                            type="checkbox"
                            checked={form.photographyStyles.includes(
                              style
                            )}
                            onChange={(event) =>
                              toggleSelection(
                                "photographyStyles",
                                style,
                                event.target.checked
                              )
                            }
                          />

                          <span>{style}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Professional skills multi-select dropdown */}
              <div className="photographer-form-wide photographer-choice-group">
                <label
                  className="photographer-field-label"
                  htmlFor="photographer-skills-trigger"
                >
                  Professional skills
                </label>

                <div className="photographer-multiselect">
                  <button
                    id="photographer-skills-trigger"
                    type="button"
                    className="photographer-dropdown-trigger"
                    onClick={() =>
                      setSkillsDropdownOpen((open) => !open)
                    }
                    aria-expanded={skillsDropdownOpen}
                    aria-controls="photographer-skills-options"
                  >
                    <span>
                      {form.skills.length
                        ? `${form.skills.length} skill(s) selected`
                        : "Select professional skills"}
                    </span>

                    <span aria-hidden="true">
                      {skillsDropdownOpen ? "▲" : "▼"}
                    </span>
                  </button>

                  {form.skills.length > 0 && (
                    <div className="photographer-selected-tags">
                      {form.skills.map((skill) => (
                        <button
                          type="button"
                          className="photographer-selected-tag"
                          key={skill}
                          onClick={() =>
                            toggleSelection("skills", skill, false)
                          }
                          aria-label={`Remove ${skill}`}
                        >
                          {skill} <span aria-hidden="true">×</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {skillsDropdownOpen && (
                    <div
                      id="photographer-skills-options"
                      className="photographer-dropdown-options"
                    >
                      {PHOTOGRAPHER_SKILL_OPTIONS.map((skill) => (
                        <label
                          className="photographer-dropdown-option"
                          key={skill}
                        >
                          <input
                            type="checkbox"
                            checked={form.skills.includes(skill)}
                            onChange={(event) =>
                              toggleSelection(
                                "skills",
                                skill,
                                event.target.checked
                              )
                            }
                          />

                          <span>{skill}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <label className="photographer-form-wide">
                Portfolio website <span>Optional</span>
                <input
                  name="portfolio"
                  type="url"
                  placeholder="https://"
                  value={form.portfolio}
                  onChange={update}
                />
              </label>

              <label>
                Password
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={update}
                  required
                />
              </label>

              <label>
                Confirm password
                <input
                  name="confirmPassword"
                  type="password"
                  value={form.confirmPassword}
                  onChange={update}
                  required
                />
              </label>
            </div>

            <button
              className="photographer-submit"
              disabled={submitting}
            >
              {submitting
                ? "Creating account…"
                : "Create photographer account"}
            </button>
          </form>

          <p className="photographer-signin">
            Already registered? <Link to="/login">Sign in</Link>
          </p>
        </section>
      </section>
    </main>
  );
}
