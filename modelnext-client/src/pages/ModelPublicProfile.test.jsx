import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ModelPublicProfile from './ModelPublicProfile';

jest.mock('../components/Navbar', () => () => <nav aria-label="Public navigation" />);
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ status: 'authenticated', kind: 'user', role: 'client', account: { id: 'client-1' } }) }));
const modelId = 'abcdef0123456789abcdef01';
const response = data => ({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => data });
beforeEach(() => { global.fetch = jest.fn(async () => response({ model: { id: modelId, fullName: 'Canonical Model', location: 'Colombo', categories: ['Editorial'], skills: [], portfolioImages: [] } })); });
const renderProfile = entry => render(<MemoryRouter initialEntries={[entry]}><Routes><Route path="/models/:modelId" element={<ModelPublicProfile />} /></Routes></MemoryRouter>);

test('normal canonical profile preserves direct booking', async () => {
  renderProfile(`/models/${modelId}`);
  expect(await screen.findByRole('heading', { name: 'Canonical Model' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'BOOK NOW' })).toBeInTheDocument();
  expect(screen.queryByLabelText('AI recommendation event context')).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`/models/${modelId}`), expect.anything());
});

test('AI canonical profile displays event context and locks booking mode', async () => {
  const query = new URLSearchParams({ eventId: 'event-1', eventTitle: 'Autumn Campaign', eventType: 'Commercial', eventLocation: 'Kandy' });
  renderProfile(`/models/${modelId}?${query}`);
  expect(await screen.findByRole('heading', { name: 'Canonical Model' })).toBeInTheDocument();
  expect(screen.getByLabelText('AI recommendation event context')).toHaveTextContent('Autumn Campaign');
  expect(screen.getByLabelText('AI recommendation event context')).toHaveTextContent('Commercial · Kandy');
  expect(screen.getByRole('button', { name: 'BOOK FOR THIS EVENT' })).toBeInTheDocument();
});
