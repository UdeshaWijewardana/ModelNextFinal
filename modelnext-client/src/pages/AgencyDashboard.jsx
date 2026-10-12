import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch, getCurrentUser, readJson, SERVER_BASE_URL } from "../api";
import { useAuth } from "../context/AuthContext";
import BrowseTalentLinks from "../components/BrowseTalentLinks";
import MyEvents from "../components/MyEvents";
import "../styles/AgencyDashboard.css";

const PROFILE_FIELDS = [
  ["agencyName", "Agency name"],
  ["ownerName", "Owner name"],
  ["phone", "Contact number"],
  ["address", "Office address"],
  ["businessId", "Business ID"],
];
const IMAGE_FIELDS = [
  ["profileImage", "Agency logo"],
  ["coverImage", "Cover image"],
];
const NAV_ITEMS = [
  ["Overview", "⌂", "overview"],
  ["Agency Profile", "◉", "profile"],
  ["Logo & Cover Images", "▧", "images"],
  ["My Bookings", "▤", "/my-bookings"],
  ["My Events", "◇", "events"],
  ["Event Group Chats", "▣", "/event-chats"],
  ["Notifications", "◔", "notifications"],
  ["Account Settings", "⚙", "settings"],
];

const imageUrl = (path) => {
  if (!path) return "";
  return /^https?:\/\//i.test(path)
    ? path
    : `${SERVER_BASE_URL}/${String(path).replace(/\\/g, "/").replace(/^\/+/, "")}`;
};

const accountStatus = (status) => String(status || "pending").toLowerCase();

export default function AgencyDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { logout } = useAuth();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyNotification, setBusyNotification] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const requestedSection = searchParams.get("section") || "overview";
  const activeSection = NAV_ITEMS.some(([, , section]) => !section.startsWith("/") && section === requestedSection)
    ? requestedSection
    : "overview";
  const status = accountStatus(user?.approvalStatus);
  const approved = status === "approved";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { user: current } = await getCurrentUser();
      if (current.role !== "agency") throw new Error("This account cannot access the Agency dashboard.");
      setUser(current);
      setForm(current);
      if (accountStatus(current.approvalStatus) === "approved") {
        try {
          const data = await readJson(await apiFetch("/notifications"));
          setNotifications(data.notifications || []);
        } catch (caught) {
          setError(caught.message || "Unable to load notifications.");
        }
      }
    } catch (caught) {
      setError(caught.message || "Unable to load your Agency account.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const goTo = (section) => {
    setSearchParams({ section });
    setSidebarOpen(false);
    setError("");
    setNotice("");
  };

  const saveFields = async (event, fields, successMessage) => {
    event.preventDefault();
    if (!approved || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const changes = Object.fromEntries(fields.map(([name]) => [name, form[name] || ""]));
      const { user: updated } = await readJson(await apiFetch("/auth/me/profile", {
        method: "PATCH",
        body: JSON.stringify(changes),
      }));
      setUser(updated);
      setForm(updated);
      setNotice(successMessage);
    } catch (caught) {
      setError(caught.message || "Unable to save your profile.");
    } finally {
      setSaving(false);
    }
  };

  const markRead = async (id) => {
    if (busyNotification) return;
    setBusyNotification(id);
    setError("");
    try {
      await readJson(await apiFetch(`/notifications/${id}/read`, {
        method: "PATCH",
        body: "{}",
      }));
      setNotifications((items) => items.map((item) => item._id === id ? { ...item, read: true } : item));
    } catch (caught) {
      setError(caught.message || "Unable to update this notification.");
    } finally {
      setBusyNotification("");
    }
  };

  const signOut = async () => {
    await logout();
    navigate("/");
  };

  const statusMessage = status === "pending"
    ? "Your Agency account is pending administrator approval. Your submitted details are available to review; profile changes and Agency actions are locked until approval."
    : status === "rejected"
      ? `This Agency registration was not approved.${user?.rejectionReason ? ` Reason: ${user.rejectionReason}` : " Contact support if you need assistance."}`
      : status === "suspended"
        ? "Agency account actions are unavailable while this account is suspended. Contact support for assistance."
        : "";
  const statusTitle = status === "pending" ? "Pending Admin Approval"
    : status === "rejected" ? "Registration Not Approved"
      : status === "suspended" ? "Account Suspended" : "";

  const renderProfile = () => <section className="agency-workspace-panel">
    <header className="agency-workspace-section-heading">
      <div><p className="agency-workspace-eyebrow">AGENCY DETAILS</p><h2>Agency Profile</h2></div>
      {approved && <span>Changes are saved to your existing Agency profile.</span>}
    </header>
    {!approved && <p className="agency-workspace-muted">Your submitted details are read-only until administrator approval.</p>}
    <form className="agency-workspace-form" onSubmit={(event) => saveFields(event, PROFILE_FIELDS, "Agency profile saved.")}>
      {PROFILE_FIELDS.map(([field, label]) => <label key={field}>{label}
        <input
          name={field}
          value={form[field] || ""}
          disabled={!approved || saving}
          onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
        />
      </label>)}
      <label>Email address<input value={user.email || ""} disabled readOnly /></label>
      {approved && <button className="agency-workspace-primary" disabled={saving} type="submit">{saving ? "Saving..." : "Save profile"}</button>}
    </form>
  </section>;

  const renderImages = () => <section className="agency-workspace-panel">
    <header className="agency-workspace-section-heading">
      <div><p className="agency-workspace-eyebrow">AGENCY PRESENTATION</p><h2>Logo & Cover Images</h2></div>
      <span>{approved ? "Update image URL or stored path" : "Submitted images"}</span>
    </header>
    {!approved && <p className="agency-workspace-muted">Images are read-only until administrator approval.</p>}
    <form className="agency-workspace-image-grid" onSubmit={(event) => saveFields(event, IMAGE_FIELDS, "Agency images saved.")}>
      {IMAGE_FIELDS.map(([field, label]) => <article className={`agency-workspace-image-card is-${field}`} key={field}>
        <div className="agency-workspace-image-preview">
          {form[field]
            ? <img src={imageUrl(form[field])} alt={label} />
            : <span>{field === "profileImage" ? "Agency logo not provided" : "No cover image provided"}</span>}
        </div>
        <label>{label}
          <input
            name={field}
            value={form[field] || ""}
            disabled={!approved || saving}
            onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
            placeholder="Image URL or stored path"
          />
        </label>
      </article>)}
      {approved && <div className="agency-workspace-form-actions"><p>Use an image URL or an existing server path. File uploads remain part of Agency registration.</p><button className="agency-workspace-primary" disabled={saving} type="submit">{saving ? "Saving..." : "Save images"}</button></div>}
    </form>
  </section>;

  if (loading) return <main className="agency-workspace-loading" role="status">Loading Agency workspace...</main>;
  if (!user) return <main className="agency-workspace-loading">
    <p className="agency-workspace-error" role="alert">{error || "Unable to load your Agency account."}</p>
    <Link to="/">Back to Website</Link>
  </main>;

  const sectionLink = (section) => `?section=${section}`;
  return <div className="agency-workspace">
    {sidebarOpen && <button className="agency-workspace-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
    <aside className={`agency-workspace-sidebar${sidebarOpen ? " is-open" : ""}`}>
      <Link to="/" className="agency-workspace-brand"><span className="agency-workspace-brand-mark">M</span><span>ModelNext<small>AGENCY WORKSPACE</small></span></Link>
      <p className="agency-workspace-nav-label">WORKSPACE</p>
      <nav className="agency-workspace-nav" aria-label="Agency workspace">
        {NAV_ITEMS.map(([label, icon, section]) => {
          const external = section.startsWith("/");
          const disabled = !approved && ["events", "/my-bookings", "/event-chats"].includes(section);
          const active = !external && activeSection === section;
          const content = <><span aria-hidden="true">{icon}</span>{label}</>;
          if (disabled) return <button type="button" className="agency-workspace-nav-item is-disabled" key={section} disabled>{content}</button>;
          if (external) return <Link className="agency-workspace-nav-item" key={section} to={section} onClick={() => setSidebarOpen(false)}>{content}</Link>;
          return <Link className={`agency-workspace-nav-item${active ? " is-active" : ""}`} key={section} to={sectionLink(section)} aria-current={active ? "page" : undefined} onClick={() => { setSidebarOpen(false); setError(""); setNotice(""); }}>{content}</Link>;
        })}
      </nav>
      <div className="agency-workspace-sidebar-bottom">
        <Link className="agency-workspace-nav-item" to="/">← Back to Website</Link>
        <button className="agency-workspace-nav-item" type="button" onClick={signOut}>↪ Logout</button>
      </div>
    </aside>

    <main className="agency-workspace-main">
      <header className="agency-workspace-topbar">
        <button className="agency-workspace-menu" type="button" aria-label="Open navigation" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}>☰</button>
        <span>Agency workspace</span>
        <div className="agency-workspace-user">
          <span className="agency-workspace-user-avatar">{(user.agencyName || "A").slice(0, 1).toUpperCase()}</span>
          <div><strong>{user.agencyName || "Agency account"}</strong><small>{user.email}</small></div>
        </div>
      </header>
      <div className="agency-workspace-content">
        <header className="agency-workspace-welcome">
          <div><p className="agency-workspace-eyebrow">MODELNEXT / AGENCY</p><h1>{activeSection === "overview" ? "Welcome back" : NAV_ITEMS.find(([, , section]) => section === activeSection)?.[0]}</h1>
            <p>Manage your Agency profile and existing ModelNext activity.</p></div>
          <span className={`agency-workspace-status is-${status}`}>{status.replace("-", " ")}</span>
        </header>
        {statusMessage && <section className={`agency-workspace-approval is-${status}`} role="status"><strong>{statusTitle}</strong><p>{statusMessage}</p></section>}
        {error && <p className="agency-workspace-error" role="alert">{error}</p>}
        {notice && <p className="agency-workspace-notice" role="status">{notice}</p>}

        {activeSection === "overview" && <div className="agency-workspace-overview">
          <section className="agency-workspace-overview-card agency-workspace-overview-cover">
            {user.coverImage && <img src={imageUrl(user.coverImage)} alt="" />}
            <div className="agency-workspace-overview-logo">{user.profileImage ? <img src={imageUrl(user.profileImage)} alt={`${user.agencyName} logo`} /> : <span>{(user.agencyName || "A").slice(0, 1)}</span>}</div>
            <div><p className="agency-workspace-eyebrow">YOUR AGENCY</p><h2>{user.agencyName || "Agency account"}</h2><p>{user.ownerName || "Owner not provided"} · {user.email}</p></div>
            <button type="button" className="agency-workspace-secondary" onClick={() => goTo("profile")}>View profile</button>
          </section>
          <div className="agency-workspace-summary-grid">
            <article className="agency-workspace-summary-card"><span>Account status</span><strong>{status.replace("-", " ")}</strong><small>{approved ? "Agency actions are available." : "Actions remain restricted."}</small></article>
            <article className="agency-workspace-summary-card"><span>Contact number</span><strong>{user.phone || "Not provided"}</strong><small>{user.address || "Office address not provided"}</small></article>
          </div>
          <BrowseTalentLinks />
        </div>}
        {activeSection === "profile" && renderProfile()}
        {activeSection === "images" && renderImages()}
        {activeSection === "events" && approved && <section className="agency-workspace-panel agency-workspace-events"><MyEvents /></section>}
        {activeSection === "notifications" && <section className="agency-workspace-panel">
          <header className="agency-workspace-section-heading"><div><p className="agency-workspace-eyebrow">ACCOUNT UPDATES</p><h2>Notifications</h2></div></header>
          {!approved ? <p className="agency-workspace-muted">Notifications are available after account approval.</p>
            : notifications.length === 0 ? <p className="agency-workspace-muted">No notifications yet.</p>
              : <div className="agency-workspace-notifications">{notifications.map((item) => <article key={item._id}>
                <p>{item.message}</p><time>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}</time>
                <button type="button" disabled={item.read || busyNotification === item._id} onClick={() => markRead(item._id)}>{item.read ? "Read" : busyNotification === item._id ? "Updating..." : "Mark as read"}</button>
              </article>)}</div>}
        </section>}
        {activeSection === "settings" && <section className="agency-workspace-panel">
          <header className="agency-workspace-section-heading"><div><p className="agency-workspace-eyebrow">ACCOUNT</p><h2>Account Settings</h2></div></header>
          <div className="agency-workspace-settings-row"><span>Email address</span><strong>{user.email}</strong></div>
          <div className="agency-workspace-settings-row"><span>Approval status</span><strong>{status.replace("-", " ")}</strong></div>
          <div className="agency-workspace-settings-row"><span>Business ID</span><strong>{user.businessId || "Not provided"}</strong></div>
          {user.rejectionReason && status === "rejected" && <div className="agency-workspace-settings-row"><span>Review note</span><strong>{user.rejectionReason}</strong></div>}
        </section>}
      </div>
    </main>
  </div>;
}
