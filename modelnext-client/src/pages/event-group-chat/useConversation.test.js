import {act, renderHook, waitFor} from '@testing-library/react';
import {io} from 'socket.io-client';
import {acknowledge, chatApi, recoverHistory} from './api';
import useConversation from './useConversation';

jest.mock('socket.io-client',()=>({io:jest.fn()}));
jest.mock('./api',()=>({...jest.requireActual('./api'),chatApi:jest.fn(),recoverHistory:jest.fn(),acknowledge:jest.fn()}));
let client;
let handlers;
const first={id:'1',chatId:'chat',createdAt:'2026-01-01T00:00:00Z'};
beforeEach(()=>{
  jest.clearAllMocks(); handlers={};
  client={connected:false,on:jest.fn((event,handler)=>{handlers[event]=handler;return client;}),off:jest.fn(),timeout:jest.fn().mockReturnThis(),emit:jest.fn(),disconnect:jest.fn(()=>{client.connected=false;return client;}),connect:jest.fn(()=>{client.connected=true;handlers.connect?.();return client;})};
  io.mockReturnValue(client);
  chatApi.mockResolvedValue({chat:{id:'chat',eventTitle:'Test event',isOwner:false}});
  acknowledge.mockResolvedValue({ok:true,chatId:'chat'});
  recoverHistory.mockResolvedValue({messages:[first],nextCursor:'older'});
});
test('joins with cookie credentials, deduplicates events and re-recovers after reconnect', async()=>{
  const {result,unmount}=renderHook(()=>useConversation('chat'));
  await waitFor(()=>expect(result.current.connection).toBe('Live'));
  expect(io).toHaveBeenCalledWith(expect.any(String),{withCredentials:true,autoConnect:false});
  expect(acknowledge).toHaveBeenCalledWith(client,'chat:join',{chatId:'chat'});
  act(()=>{handlers['chat:message']({message:first});handlers['chat:message']({message:{...first,id:'2'}});});
  expect(result.current.messages).toHaveLength(2);
  await act(async()=>{handlers.disconnect();handlers.connect();});
  await waitFor(()=>expect(recoverHistory).toHaveBeenCalledTimes(2));
  expect([...recoverHistory.mock.calls[1][1]]).toEqual(['1','2']);
  unmount();
  expect(client.off).toHaveBeenCalledTimes(6);
  expect(client.emit).toHaveBeenCalledWith('chat:leave',{chatId:'chat'},expect.any(Function));
  expect(client.disconnect).toHaveBeenCalled();
});
test('clears private content and ignores later packets after access revocation', async()=>{
  const {result}=renderHook(()=>useConversation('chat'));
  await waitFor(()=>expect(result.current.messages).toHaveLength(1));
  act(()=>handlers['chat:access_revoked']({status:403,error:'Membership removed',chatId:'chat'}));
  expect(result.current.messages).toEqual([]); expect(result.current.chat).toBeNull();
  expect(result.current.revoked).toBe('Membership removed');
  act(()=>handlers['chat:message']({message:first}));
  expect(result.current.messages).toEqual([]);
  await act(async()=>result.current.reconnect());
  expect(client.connect).toHaveBeenCalledTimes(1);
});
test('session expiry at connection clears access',async()=>{
  const {result}=renderHook(()=>useConversation('chat'));
  await waitFor(()=>expect(result.current.connection).toBe('Live'));
  act(()=>handlers.connect_error({message:'Session expired',data:{status:401}}));
  expect(result.current.chat).toBeNull();expect(result.current.messages).toEqual([]);
  expect(result.current.revoked).toBe('Session expired');
});
test('authorization failure never opens a socket connection',async()=>{
  chatApi.mockRejectedValue({status:403,message:'Not a member'});
  const {result}=renderHook(()=>useConversation('chat'));
  await waitFor(()=>expect(result.current.revoked).toBe('Not a member'));
  expect(client.connect).not.toHaveBeenCalled();
});

test('server access_revoked clears content even during a temporary authorization outage',async()=>{
  const {result}=renderHook(()=>useConversation('chat'));
  await waitFor(()=>expect(result.current.connection).toBe('Live'));
  act(()=>handlers['chat:access_revoked']({status:503,error:'Authorization unavailable'}));
  expect(result.current.messages).toEqual([]);expect(result.current.chat).toBeNull();
  expect(result.current.revoked).toBe('Authorization unavailable');
});
test('history recovery in flight cannot restore content after revocation',async()=>{
  let finish;
  recoverHistory.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const {result}=renderHook(()=>useConversation('chat'));
  await waitFor(()=>expect(result.current.connection).toBe('Recovering history'));
  await act(async()=>{
    handlers['chat:access_revoked']({status:403,error:'Removed'});
    finish({messages:[first],nextCursor:null});
  });
  expect(result.current.messages).toEqual([]);expect(result.current.revoked).toBe('Removed');
});

test('uppercase chat IDs join the canonical room and process messages and revocation',async()=>{
  const canonical='abcdef0123456789abcdef01';
  chatApi.mockResolvedValue({chat:{id:canonical,memberCount:2}});
  recoverHistory.mockResolvedValue({messages:[],nextCursor:null});
  const {result}=renderHook(()=>useConversation(canonical.toUpperCase()));
  await waitFor(()=>expect(result.current.connection).toBe('Live'));
  expect(acknowledge).toHaveBeenCalledWith(client,'chat:join',{chatId:canonical});
  act(()=>handlers['chat:message']({message:{...first,chatId:canonical}}));
  expect(result.current.messages).toHaveLength(1);
  act(()=>handlers['chat:access_revoked']({chatId:canonical,status:403,error:'Removed'}));
  expect(result.current.messages).toEqual([]);expect(result.current.revoked).toBe('Removed');
});
test.each([403,404])('an owner action resource error %s preserves access after a successful chat recheck',async status=>{
  const {result}=renderHook(()=>useConversation('chat'));
  await waitFor(()=>expect(result.current.connection).toBe('Live'));
  await act(async()=>result.current.actionError({status,message:'Invited account unavailable'}));
  expect(chatApi).toHaveBeenCalledTimes(2);
  expect(result.current.messages).toHaveLength(1);expect(result.current.revoked).toBe('');
  expect(client.disconnect).not.toHaveBeenCalled();
});
test.each([403,404])('an action error clears content when the chat recheck confirms lost access (%s)',async status=>{
  const {result}=renderHook(()=>useConversation('chat'));
  await waitFor(()=>expect(result.current.connection).toBe('Live'));
  chatApi.mockRejectedValueOnce({status,message:'Chat no longer accessible'});
  await act(async()=>result.current.actionError({status:404,message:'Target missing'}));
  expect(result.current.messages).toEqual([]);expect(result.current.revoked).toBe('Chat no longer accessible');
});
test('owner action authentication failure clears content without a second request',async()=>{
  const {result}=renderHook(()=>useConversation('chat'));
  await waitFor(()=>expect(result.current.connection).toBe('Live'));
  await act(async()=>result.current.actionError({status:401,message:'Expired'}));
  expect(result.current.messages).toEqual([]);expect(result.current.revoked).toBe('Expired');
  expect(chatApi).toHaveBeenCalledTimes(1);
});
test('header refresh updates the member count without reconnecting or polling',async()=>{
  chatApi.mockResolvedValue({chat:{id:'chat',memberCount:2}});
  const {result}=renderHook(()=>useConversation('chat'));
  await waitFor(()=>expect(result.current.connection).toBe('Live'));
  chatApi.mockResolvedValueOnce({chat:{id:'chat',memberCount:3}});
  await act(async()=>result.current.refreshHeader());
  expect(result.current.chat.memberCount).toBe(3);
  expect(client.connect).toHaveBeenCalledTimes(1);
});
test('returning to the view refreshes the count and removes its focus listener on unmount',async()=>{
  const {result,unmount}=renderHook(()=>useConversation('chat'));
  await waitFor(()=>expect(result.current.connection).toBe('Live'));
  chatApi.mockResolvedValueOnce({chat:{id:'chat',memberCount:4}});
  await act(async()=>window.dispatchEvent(new Event('focus')));
  expect(result.current.chat.memberCount).toBe(4);
  const calls=chatApi.mock.calls.length;
  unmount();
  act(()=>window.dispatchEvent(new Event('focus')));
  expect(chatApi).toHaveBeenCalledTimes(calls);
});
test('an in-flight header refresh cannot restore content after access revocation',async()=>{
  const {result}=renderHook(()=>useConversation('chat'));
  await waitFor(()=>expect(result.current.connection).toBe('Live'));
  let finish;
  chatApi.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  await act(async()=>{
    const refresh=result.current.refreshHeader();
    handlers['chat:access_revoked']({status:403,error:'Removed',chatId:'chat'});
    finish({chat:{id:'chat',memberCount:9}});
    await refresh;
  });
  expect(result.current.chat).toBeNull();expect(result.current.revoked).toBe('Removed');
});

test('out-of-order header responses cannot overwrite a newer membership count',async()=>{
  const {result}=renderHook(()=>useConversation('chat'));
  await waitFor(()=>expect(result.current.connection).toBe('Live'));
  let finishOlder,finishNewer;
  chatApi.mockImplementationOnce(()=>new Promise(resolve=>{finishOlder=resolve;}))
    .mockImplementationOnce(()=>new Promise(resolve=>{finishNewer=resolve;}));
  await act(async()=>{
    const older=result.current.refreshHeader();
    const newer=result.current.refreshHeader();
    finishNewer({chat:{id:'chat',memberCount:4}});await newer;
    finishOlder({chat:{id:'chat',memberCount:3}});await older;
  });
  expect(result.current.chat.memberCount).toBe(4);
});
test('focus during initial authentication does not race or prevent the initial connection',async()=>{
  let finish;
  chatApi.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  const {result}=renderHook(()=>useConversation('chat'));
  act(()=>window.dispatchEvent(new Event('focus')));
  expect(chatApi).toHaveBeenCalledTimes(1);
  await act(async()=>finish({chat:{id:'chat',memberCount:2}}));
  await waitFor(()=>expect(result.current.connection).toBe('Live'));
});
