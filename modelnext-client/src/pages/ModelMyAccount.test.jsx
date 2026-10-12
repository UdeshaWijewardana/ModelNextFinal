import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ModelMyAccount from "./ModelMyAccount";
import { apiFetch, getCurrentUser, readJson } from "../api";
import { useAuth } from "../context/AuthContext";

jest.mock("../api", () => ({
  apiFetch: jest.fn(),
  getCurrentUser: jest.fn(),
  readJson: jest.fn((response) => response.json()),
  SERVER_BASE_URL: "http://localhost",
}));
jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));

const model = {
  id: "model-1", role: "model", approvalStatus: "approved", fullName: "Test Model",
  email: "model@example.test", portfolioImages: [], categories: [], skills: [],
};
const booking = {
  id: "booking-1", requesterName: "Client One", jobType: "Fashion Editorial",
  bookingDate: "2026-12-01", location: "Colombo", status: "confirmed",
};
const invitation = {
  _id: "invitation-1", chatId: "chat-2", status: "pending",
  chat: { available: true, eventTitle: "Viva Event" },
};
let invitations;
let chats;
let bookings;
let eventBookingRequests;

const response = (data) => ({ ok: true, status: 200, json: async () => data });

beforeEach(() => {
  jest.clearAllMocks();
  invitations = [{ ...invitation }];
  chats = [{ id: "chat-1", eventTitle: "Joined Event", isOwner: false }];
  bookings = [{ ...booking }];
  eventBookingRequests = [{
    id: "event-request-1",
    requestType: "booking",
    status: "pending",
    eventTitle: "Editorial Event",
    eventType: "Fashion",
    eventLocation: "Colombo",
  }];
  useAuth.mockReturnValue({ logout: jest.fn(), restoreSession: jest.fn() });
  getCurrentUser.mockResolvedValue({ user: model });
  apiFetch.mockImplementation(async (path, options = {}) => {
    if (path === "/notifications") return response({ notifications: [] });
    if (path === "/direct-bookings") return response({ sent: [], received: bookings });
    if (path === "/events/requests/mine") return response({ requests: eventBookingRequests });
    if (path.startsWith("/event-chats/invitations/mine")) return response({ invitations, nextCursor: null });
    if (path.startsWith("/event-chats/mine")) return response({ chats, nextCursor: null });
    if (path.startsWith("/models/me/availability")) return response({ bookedDates: [], manualDates: [] });
    if (path === "/event-chats/invitations/invitation-1/respond") {
      invitations[0].status = JSON.parse(options.body).action === "accept" ? "accepted" : "declined";
      if (invitations[0].status === "accepted") chats.push({ id: "chat-2", eventTitle: "Viva Event", isOwner: false });
      return response({ invitation: invitations[0] });
    }
    if (path === "/direct-bookings/booking-1/status") {
      bookings[0].status = JSON.parse(options.body).status;
      return response({ booking: bookings[0] });
    }
    if (path === "/events/bookings/event-request-1/respond") {
      eventBookingRequests[0].status = JSON.parse(options.body).status;
      return response({ request: eventBookingRequests[0] });
    }
    throw new Error(`Unexpected API request: ${path}`);
  });
  readJson.mockImplementation((result) => result.json());
});

const renderDashboard = (path = "/model-account") => render(
  <MemoryRouter initialEntries={[path]}><ModelMyAccount /></MemoryRouter>
);

test("sidebar switches one dashboard section at a time and contains one Notifications item", async () => {
  renderDashboard();
  expect(await screen.findByText("Welcome back, Test Model")).toBeInTheDocument();
  const sidebar = screen.getByLabelText("Model account navigation");
  expect(within(sidebar).getAllByRole("button", { name: /Notifications/ })).toHaveLength(1);

  const sections = [
    ["My Profile", "My Profile"],
    ["Portfolio", "Portfolio"],
    ["Availability Calendar", "Availability Calendar"],
    ["My Bookings", "Incoming Booking Requests"],
    ["Private Messages", "Private Messages"],
    ["Event Group Chats", "Event Group Chats"],
    ["Notifications", "Notifications"],
    ["Account Settings", "Account Settings"],
  ];
  for (const [button, heading] of sections) {
    fireEvent.click(within(sidebar).getByRole("button", { name: new RegExp(button) }));
    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.queryByText("Welcome back, Test Model")).not.toBeInTheDocument();
  }
  fireEvent.click(within(sidebar).getByRole("button", { name: /Overview/ }));
  expect(await screen.findByText("Welcome back, Test Model")).toBeInTheDocument();
});

test("event invitations accept into joined chats and private messages link to the booking", async () => {
  renderDashboard("/model-account?section=event-chats");
  expect(await screen.findByText("Joined Event")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open Chat" })).toHaveAttribute("href", "/event-chats/chat-1");
  fireEvent.click(screen.getByRole("button", { name: "Accept" }));
  expect(await screen.findByText("Viva Event")).toBeInTheDocument();
  expect(screen.getAllByRole("link", { name: "Open Chat" }).some((link) => link.getAttribute("href") === "/event-chats/chat-2")).toBe(true);

  fireEvent.click(within(screen.getByLabelText("Model account navigation")).getByRole("button", { name: /Private Messages/ }));
  expect(await screen.findByText(/With Client One/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open Private Chat" })).toHaveAttribute("href", "/private-messages/booking-1");
});

test("booking response actions remain available and update the displayed status", async () => {
  bookings[0].status = "pending";
  renderDashboard("/model-account?section=bookings");
  fireEvent.click((await screen.findAllByRole("button", { name: "Accept" }))[0]);
  await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/direct-bookings/booking-1/status", expect.objectContaining({ method: "PATCH" })));
  expect(await screen.findByText("Status: confirmed")).toBeInTheDocument();
});

test("event booking requests use the existing response endpoint", async () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
  renderDashboard("/model-account?section=bookings");
  expect(await screen.findByText("Editorial Event")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Accept" }));
  await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
    "/events/bookings/event-request-1/respond",
    expect.objectContaining({ method: "PATCH" })
  ));
  const eventRequests = screen.getByRole("region", { name: "Event Booking Requests" });
  expect(await within(eventRequests).findByText("Status: confirmed")).toBeInTheDocument();
  confirm.mockRestore();
});
