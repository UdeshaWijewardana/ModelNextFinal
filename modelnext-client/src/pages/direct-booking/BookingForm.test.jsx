import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BookingForm from './BookingForm';

jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ status: 'authenticated', kind: 'user', role: 'client', account: { id: 'client-1' } }) }));
const json = data => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => data });
const currentMonth = () => { const value = new Date(); return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`; };

beforeEach(() => {
  const month = currentMonth();
  global.fetch = jest.fn(async url => {
    if (String(url).includes('/models/model-1/availability')) return json({ bookedDates: [`${month}-29`], manualDates: [{ date: `${month}-28`, status: 'available' }, { date: `${month}-27`, status: 'unavailable' }] });
    throw new Error(`Unexpected request: ${url}`);
  });
});

test('mini calendar loads availability and an available day fills the booking date', async () => {
  render(<MemoryRouter><BookingForm talentId="model-1" talentRole="model" talentName="Test Model" /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'BOOK NOW' }));
  const available = await screen.findByRole('button', { name: `${currentMonth()}-28: available` });
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`/models/model-1/availability?month=${currentMonth()}`), expect.objectContaining({ signal: expect.anything() }));
  fireEvent.click(available);
  expect(screen.getByLabelText('Booking Date')).toHaveValue(`${currentMonth()}-28`);
});

test('booked and unavailable days are disabled and manual blocked dates show validation', async () => {
  render(<MemoryRouter><BookingForm talentId="model-1" talentRole="model" talentName="Test Model" /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'BOOK NOW' }));
  expect(await screen.findByRole('button', { name: `${currentMonth()}-29: already booked` })).toBeDisabled();
  expect(screen.getByRole('button', { name: `${currentMonth()}-27: manually unavailable` })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Booking Date'), { target: { value: `${currentMonth()}-29` } });
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('already booked'));
  expect(screen.getByRole('button', { name: 'SEND BOOKING REQUEST' })).toBeDisabled();
});

test('date field exposes a visible control for the native picker', async () => {
  render(<MemoryRouter><BookingForm talentId="model-1" talentRole="model" talentName="Test Model" /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'BOOK NOW' }));
  expect(screen.getByRole('button', { name: 'Open booking date picker' })).toBeVisible();
  expect(await screen.findByRole('button', { name: `${currentMonth()}-28: available` })).toBeEnabled();
});

test('AI event context is server-verified, locked, and submitted once', async () => {
  let finish;
  global.fetch = jest.fn(async (url, options = {}) => {
    const path = new URL(url).pathname.replace('/api', '');
    if (path === '/events/mine/event-1') return json({ event: { id: 'event-1', title: 'Verified Campaign', eventType: 'Commercial', location: 'Colombo', status: 'approved' } });
    if (path === '/events/event-1/bookings' && options.method === 'POST') return new Promise(resolve => { finish = () => resolve(json({ message: 'Booking request sent successfully.' })); });
    throw new Error(`Unexpected request: ${path}`);
  });
  render(<MemoryRouter><BookingForm talentId="model-1" talentRole="model" talentName="Test Model" eventContext={{ eventId: 'event-1', eventTitle: 'URL title', eventType: 'URL type', eventLocation: 'URL place' }} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'BOOK FOR THIS EVENT' }));
  expect(await screen.findByText('Verified Campaign')).toBeInTheDocument();
  expect(screen.queryByLabelText('Job Type')).not.toBeInTheDocument();
  const submit = screen.getByRole('button', { name: 'SEND BOOKING REQUEST' });
  fireEvent.click(submit); fireEvent.click(submit);
  expect(screen.getByRole('button', { name: 'Sending...' })).toBeDisabled();
  expect(fetch.mock.calls.filter(([, options = {}]) => options.method === 'POST')).toHaveLength(1);
  await act(async () => finish());
  expect(await screen.findByText('Booking request sent successfully.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'REQUEST SENT' })).toBeDisabled();
});

test('invalid or unowned AI event context never enables submission', async () => {
  global.fetch = jest.fn(async () => ({ ok: false, status: 404, headers: { get: () => 'application/json' }, json: async () => ({ error: 'Event was not found.' }) }));
  render(<MemoryRouter><BookingForm talentId="model-1" talentRole="model" talentName="Test Model" eventContext={{ eventId: 'not-owned' }} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'BOOK FOR THIS EVENT' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Event was not found');
  expect(screen.getByRole('button', { name: 'SEND BOOKING REQUEST' })).toBeDisabled();
  expect(fetch.mock.calls.filter(([, options = {}]) => options.method === 'POST')).toHaveLength(0);
});
