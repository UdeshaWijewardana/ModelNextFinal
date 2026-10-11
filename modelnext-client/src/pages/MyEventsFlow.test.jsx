import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { accountRouteForRole } from '../context/AuthContext';
import AccountDashboard from '../components/AccountDashboard';
import ClientSidebar from '../components/client-dashboard/ClientSidebar';
import MyEvents from '../components/MyEvents';
import EventCreate from './EventCreate';
import OwnedEventDetails from './OwnedEventDetails';
import EventChatAction from './event-group-chat/EventChatAction';
import ClientDashboard from './ClientDashboard';

let mockAuth;
jest.mock('../context/AuthContext', () => ({ ...jest.requireActual('../context/AuthContext'), useAuth: () => mockAuth }));
jest.mock('../components/Navbar', () => () => <nav aria-label="Public navigation" />);
const eventId = 'abcdef0123456789abcdef01';
const chatId = 'abcdef0123456789abcdef02';
const fixture = { id: eventId, title: 'Isolated event', eventType: 'Runway', location: 'Colombo', description: 'Stored description', startDate: '2026-11-10T10:00:00Z', status: 'pending' };
const json = (data, status = 200) => ({ ok: status < 400, status, headers: { get: () => 'application/json' }, json: async () => data });
let currentEvent, chatExists;
beforeEach(() => {
  mockAuth = { status: 'authenticated', kind: 'user', role: 'client', account: { id: 'owner' }, logout: jest.fn() };
  currentEvent = { ...fixture }; chatExists = false;
  Element.prototype.scrollIntoView = jest.fn();
  global.fetch = jest.fn(async (url, options = {}) => {
    const path = new URL(url).pathname.replace('/api', '');
    if (path === '/auth/me') return json({ user: { id: 'owner', role: mockAuth.role, approvalStatus: 'approved', name: 'Owner' } });
    if (path === '/notifications') return json({ notifications: [] });
    if (path === '/events/mine') return json({ events: [currentEvent] });
    if (path === '/events' && !options.method) return json({ events: [] });
    if (path === '/events/bookings/mine') return json({ bookings: [] });
    if (path === `/events/mine/${eventId}`) return json({ event: currentEvent });
    if (path === '/events' && options.method === 'POST') {
      currentEvent = { ...currentEvent, ...JSON.parse(options.body) };
      return json({ event: currentEvent }, 201);
    }
    if (path === `/events/${eventId}` && options.method === 'PATCH') {
      currentEvent = { ...currentEvent, ...JSON.parse(options.body) };
      return json({ event: currentEvent });
    }
    if (path === `/event-chats/events/${eventId}/chat`) return json({ canCreate: !chatExists, chat: chatExists ? { id: chatId, isOwner: true, isMember: true } : null });
    if (path === `/event-chats/events/${eventId}` && options.method === 'POST') { chatExists = true; return json({ chat: { id: chatId } }, 201); }
    throw new Error(`Unexpected isolated request: ${options.method} ${path}`);
  });
});

test('client sidebar has My Events and three secure new-tab browse links', () => {
  const navigate = jest.fn();
  render(<MemoryRouter><ClientSidebar active="my-events" onNavigate={navigate} /></MemoryRouter>);
  const myEvents = screen.getByRole('button', { name: /My Events/ });
  expect(myEvents).toHaveClass('is-active');
  fireEvent.click(myEvents); expect(navigate).toHaveBeenCalledWith('my-events');
  for (const [name, path] of [['Browse Fashion Models', '/models'], ['Browse Photographers', '/photographers'], ['Browse Agencies', '/agencies']]) {
    const link = screen.getByRole('link', { name });
    expect(link).toHaveAttribute('href', path); expect(link).toHaveAttribute('target', '_blank'); expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
});

test.each(['photographer', 'agency'])('%s account keeps profile and adds owned events and browse links', async role => {
  mockAuth.role = role;
  render(<MemoryRouter initialEntries={[accountRouteForRole(role) + '?section=my-events']}><AccountDashboard role={role} title={`${role} Account`} /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'My Events' })).toBeInTheDocument();
  expect(await screen.findByRole('link', { name: 'View Details' })).toHaveAttribute('href', `/account/events/${eventId}`);
  expect(screen.getByRole('link', { name: 'My Events' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('link', { name: 'My Profile' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to Website' })).toHaveAttribute('href', '/');
  for (const name of ['Browse Fashion Models', 'Browse Photographers', 'Browse Agencies']) expect(screen.getByRole('link', { name })).toHaveAttribute('target', '_blank');
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/events/mine'), expect.objectContaining({ credentials: 'include' }));
  expect(mockAuth.logout).not.toHaveBeenCalled();
});

test('My Events renders empty and error states and retries only the ownership endpoint', async () => {
  fetch.mockImplementationOnce(async () => json({ error: 'Service unavailable' }, 503));
  render(<MemoryRouter><MyEvents /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Service unavailable');
  fetch.mockImplementationOnce(async () => json({ events: [] }));
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('You have not created any events yet.')).toBeInTheDocument();
  expect(fetch.mock.calls.every(([url]) => url.endsWith('/events/mine'))).toBe(true);
});

test.each(['client', 'photographer', 'agency'])('%s: create returns to private stored details with role-specific My Events link', async role => {
  mockAuth.role = role;
  render(<MemoryRouter initialEntries={['/event/create']}><Routes>
    <Route path="/event/create" element={<EventCreate />} />
    <Route path="/account/events/:eventId" element={<OwnedEventDetails />} />
  </Routes></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText('Event title'), { target: { value: 'Created event' } });
  fireEvent.change(screen.getByLabelText('Start date and time'), { target: { value: '2026-11-10T10:00' } });
  fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Colombo' } });
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Actual saved description' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
  expect(await screen.findByRole('heading', { name: 'Created event' })).toBeInTheDocument();
  expect(screen.getByText('Actual saved description')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /My Events/ })).toHaveAttribute('href', accountRouteForRole(role) + '?section=my-events');
  expect(screen.getByText('Group chat is available after event approval.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'CREATE GROUP CHAT' })).not.toBeInTheDocument();
});

test('approved details create one chat and existing details show only OPEN GROUP CHAT', async () => {
  currentEvent.status = 'approved';
  const view = render(<MemoryRouter initialEntries={[`/account/events/${eventId}`]}><Routes>
    <Route path="/account/events/:eventId" element={<OwnedEventDetails />} />
    <Route path="/event-chats/:chatId" element={<p>Authorized room destination</p>} />
  </Routes></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'CREATE GROUP CHAT' }));
  expect(await screen.findByText('Authorized room destination')).toBeInTheDocument();
  expect(fetch.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(1);
  view.unmount();
  render(<MemoryRouter initialEntries={[`/account/events/${eventId}`]}><OwnedEventDetailsRoute /></MemoryRouter>);
  expect(await screen.findByRole('link', { name: 'OPEN GROUP CHAT' })).toHaveAttribute('href', `/event-chats/${chatId}`);
  expect(screen.queryByRole('button', { name: 'CREATE GROUP CHAT' })).not.toBeInTheDocument();
});
function OwnedEventDetailsRoute() { return <Routes><Route path="/account/events/:eventId" element={<OwnedEventDetails />} /></Routes>; }

test('private details are never requested for unauthenticated visitors', () => {
  mockAuth.status = 'unauthenticated';
  render(<MemoryRouter initialEntries={[`/account/events/${eventId}`]}><OwnedEventDetailsRoute /></MemoryRouter>);
  expect(screen.getByText(/An event-owner account is required/)).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

test.each(['client', 'photographer', 'agency'])('%s owner details use the compact header and role-specific return route', async role => {
  mockAuth.role = role;
  render(<MemoryRouter initialEntries={[`/account/events/${eventId}`]}><OwnedEventDetailsRoute /></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Isolated event' });
  expect(screen.queryByRole('navigation', { name: 'Public navigation' })).not.toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Event details navigation' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to My Events' })).toHaveAttribute('href', accountRouteForRole(role) + '?section=my-events');
  expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  expect(mockAuth.logout).not.toHaveBeenCalled();
});

test('owner details logout uses AuthContext and returns home', async () => {
  render(<MemoryRouter initialEntries={[`/account/events/${eventId}`]}><Routes><Route path="/account/events/:eventId" element={<OwnedEventDetails />} /><Route path="/" element={<p>Public home destination</p>} /></Routes></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Logout' }));
  await waitFor(() => expect(mockAuth.logout).toHaveBeenCalledTimes(1));
  expect(await screen.findByText('Public home destination')).toBeInTheDocument();
});

test('repeated create clicks while pending issue one request', async () => {
  let finish;
  const baseFetch = fetch.getMockImplementation();
  fetch.mockImplementation((url, options = {}) => options.method === 'POST' ? new Promise(resolve => { finish = () => resolve(json({ chat: { id: chatId } })); }) : baseFetch(url, options));
  render(<MemoryRouter><Routes><Route path="/" element={<EventChatAction eventId={eventId} />} /><Route path="/event-chats/:id" element={<p>Room</p>} /></Routes></MemoryRouter>);
  const button = await screen.findByRole('button', { name: 'CREATE GROUP CHAT' });
  fireEvent.click(button); fireEvent.click(button);
  expect(fetch.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(1);
  await act(async () => finish());
  expect(await screen.findByText('Room')).toBeInTheDocument();
});

function HistoryButtons() {
  const navigate = useNavigate();
  return <><button onClick={() => navigate(-1)}>Browser back</button><button onClick={() => navigate(1)}>Browser forward</button></>;
}

test('client My Events uses owned records and follows browser history', async () => {
  render(<MemoryRouter initialEntries={['/client-portal']}><HistoryButtons /><ClientDashboard /></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'My Events' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Isolated event' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /My Events/ }));
  await waitFor(() => expect(screen.getByRole('button', { name: /My Events/ })).toHaveAttribute('aria-current', 'page'));
  fireEvent.click(screen.getByRole('button', { name: 'Browser back' }));
  await waitFor(() => expect(screen.getByRole('button', { name: /My Profile/ })).not.toHaveAttribute('aria-current'));
  expect(screen.getByRole('button', { name: /Dashboard/ })).toHaveAttribute('aria-current', 'page');
  fireEvent.click(screen.getByRole('button', { name: 'Browser forward' }));
  await waitFor(() => expect(screen.getByRole('button', { name: /My Events/ })).toHaveAttribute('aria-current', 'page'));
});
