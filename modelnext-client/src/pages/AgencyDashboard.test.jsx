import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AgencyDashboard from "./AgencyDashboard";
import { apiFetch, getCurrentUser, readJson } from "../api";

jest.mock("../api", () => ({
  apiFetch: jest.fn(),
  getCurrentUser: jest.fn(),
  readJson: jest.fn(),
  SERVER_BASE_URL: "http://localhost:5000",
}));

jest.mock("../context/AuthContext", () => ({
  useAuth: () => ({ logout: jest.fn() }),
}));

const approvedAgency = {
  role: "agency",
  agencyName: "North Star Agency",
  ownerName: "Jordan Lee",
  email: "agency@example.test",
  phone: "+1 555 0100",
  address: "Studio street",
  businessId: "AG-12",
  profileImage: "uploads/agency-logo.png",
  coverImage: "uploads/agency-cover.png",
  approvalStatus: "approved",
};

const renderDashboard = (entry = "/agency-dashboard") => render(
  <MemoryRouter initialEntries={[entry]}><AgencyDashboard /></MemoryRouter>
);

beforeEach(() => {
  jest.clearAllMocks();
  getCurrentUser.mockResolvedValue({ user: approvedAgency });
  apiFetch.mockImplementation(async (path, options = {}) => ({ path, options }));
  readJson.mockImplementation(async (response) => response.path === "/notifications"
    ? { notifications: [] }
    : { user: { ...approvedAgency, ...JSON.parse(response.options.body) } });
});

test("pending agencies see one approval banner, read-only details, and disabled restricted links", async () => {
  getCurrentUser.mockResolvedValue({
    user: { ...approvedAgency, approvalStatus: "pending" },
  });
  renderDashboard("/agency-dashboard?section=profile");

  expect(await screen.findByRole("heading", { name: "Agency Profile", level: 2 })).toBeInTheDocument();
  expect(screen.getByText("Pending Admin Approval")).toBeInTheDocument();
  expect(screen.getByLabelText("Agency name")).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Save profile" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "My Bookings" })).toBeDisabled();
  expect(apiFetch).not.toHaveBeenCalledWith("/notifications", expect.anything());
});

test("approved agency profile edits use the existing profile endpoint and images render", async () => {
  renderDashboard("/agency-dashboard?section=profile");
  const agencyName = await screen.findByLabelText("Agency name");
  expect(agencyName).toBeEnabled();
  fireEvent.change(agencyName, { target: { value: "Updated Agency" } });
  fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

  await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/auth/me/profile", expect.objectContaining({
    method: "PATCH",
    body: expect.stringContaining('"agencyName":"Updated Agency"'),
  })));

  renderDashboard("/agency-dashboard?section=images");
  expect(await screen.findByAltText("Agency logo")).toHaveAttribute("src", "http://localhost:5000/uploads/agency-logo.png");
  expect(screen.getByAltText("Cover image")).toHaveAttribute("src", "http://localhost:5000/uploads/agency-cover.png");
});
