import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import App from './App';

beforeEach(() => {
  // Only authentication reads are allowed in this application smoke test.
  global.fetch = jest.fn(async url => {
    if (!String(url).endsWith('/auth/me') && !String(url).endsWith('/admin/me')) {
      throw new Error('Unexpected request in isolated App test: ' + url);
    }
    return {ok:false,status:401,json:async () => ({error:'Authentication required.'})};
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  window.history.replaceState({}, '', '/');
});

test('the real application router renders login and restores an anonymous session', async () => {
  window.history.replaceState({}, '', '/login');
  render(<App/>);
  expect(screen.getByRole('heading',{name:'Welcome Back'})).toBeInTheDocument();
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/admin/me'),expect.objectContaining({credentials:'include'})));
});

test('the real chat route requires authentication and does not request private chat data', async () => {
  window.history.replaceState({}, '', '/event-chats');
  render(<App/>);
  expect(await screen.findByText(/An approved user account is required/)).toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Sign in'})).toHaveAttribute('href','/login');
  expect(fetch).toHaveBeenCalledTimes(2);
});
