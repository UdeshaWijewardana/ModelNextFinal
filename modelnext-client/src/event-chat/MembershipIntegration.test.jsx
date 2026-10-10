import React from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import {io} from 'socket.io-client';
import EventChatRoom from '../pages/EventChatRoom';
import EventChats from '../pages/EventChats';

jest.mock('../components/Navbar',()=>()=>null);
let mockAuth;
jest.mock('../context/AuthContext',()=>({useAuth:()=>mockAuth}));
jest.mock('socket.io-client',()=>({io:jest.fn()}));
const createClient=()=>{
  const handlers={};
  const client={connected:false,on:(event,callback)=>{handlers[event]=callback;return client;},off:event=>{delete handlers[event];return client;},timeout:()=>client,
    emit:(event,payload,callback)=>callback(null,{ok:true,chatId:payload.chatId}),
    connect:()=>{client.connected=true;handlers.connect();return client;},disconnect:()=>{client.connected=false;return client;}};
  return client;
};
const chatId='abcdef0123456789abcdef01';
let count, accepted, requestStatus, actionFailure, headerForbidden, missingImage;
const json=(data,status=200)=>({ok:status<400,status,json:async()=>data});
beforeEach(()=>{
  io.mockImplementation(createClient);
  missingImage=false;count=2;accepted=false;requestStatus='pending';actionFailure=null;headerForbidden=false;
  mockAuth={status:'authenticated',kind:'user',role:'client',account:{id:'owner',role:'client'}};
  global.fetch=jest.fn(async(url,options={})=>{
    const path=new URL(url).pathname.replace('/api/event-chats','');
    if (options.method==='PATCH' && path==='/invitations/invitation/respond') {
      accepted=true;count=2;return json({invitation:{id:'invitation',chatId,status:'accepted'}});
    }
    if (options.method==='POST' && path==='/'+chatId+'/invitations') return json({error:'Invited account unavailable'},actionFailure || 404);
    if (options.method==='PATCH' && path==='/join-requests/request/respond') {
      requestStatus='approved';count=3;return json({request:{id:'request',chatId,status:'approved'}});
    }
    if (options.method==='DELETE' && path==='/'+chatId+'/members/model/member') {
      if (actionFailure) return json({error:'Member already removed'},actionFailure);
      count=1;return json(null,204);
    }
    if (path==='/'+chatId) return headerForbidden ? json({error:'Chat access revoked'},403) : json({chat:{id:chatId,eventTitle:'Fixture event',memberCount:count,isOwner:mockAuth.role==='client'}});
    if (path==='/'+chatId+'/messages') return json({messages:missingImage?[{id:'missing',chatId,sender:{id:'member',role:'model',name:'Member'},messageType:'image',text:'',createdAt:'2026-01-01T00:00:00.000Z',image:{width:10,height:10}}]:[],nextCursor:null});
    if (path==='/'+chatId+'/messages/missing/image') return json({error:'Image not found'},404);
    if (path==='/'+chatId+'/members') return json({members:[{id:'owner',role:'client',name:'Owner',isOwner:true},...(count>1?[{id:'member',role:'model',name:'Member'}]:[])],nextCursor:null});
    if (path==='/'+chatId+'/users') return json({users:[{id:'target',role:'model',name:'Target model'}],nextCursor:null});
    if (path==='/'+chatId+'/invitations') return json({invitations:[{_id:'invitation',status:accepted?'accepted':'pending',recipient:{name:'Member'},invitedUserRole:'model'}],nextCursor:null});
    if (path==='/'+chatId+'/join-requests') return json({requests:[{_id:'request',status:requestStatus,requester:{name:'Applicant'},requestedByRole:'model'}],nextCursor:null});
    if (path==='/mine') return json({chats:accepted?[{id:chatId,eventTitle:'Fixture event'}]:[],nextCursor:null});
    if (path==='/invitations/mine') return json({invitations:[{_id:'invitation',chatId,status:accepted?'accepted':'pending',chat:{eventTitle:'Fixture event',available:true}}],nextCursor:null});
    if (path==='/join-requests/mine') return json({requests:[],nextCursor:null});
    throw new Error('Unexpected isolated request: '+options.method+' '+path);
  });
});
const renderRoute=path=>render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/event-chats" element={<EventChats/>}/><Route path="/event-chats/:chatId" element={<EventChatRoom/>}/></Routes></MemoryRouter>);
const openRoom=async()=>{renderRoute('/event-chats/'+chatId);await screen.findByText(/Live.*2 members/);};

test('uppercase browser routes use canonical IDs for every chat API request',async()=>{
  renderRoute('/event-chats/'+chatId.toUpperCase());
  await screen.findByText(/Live.*2 members/);
  expect(fetch.mock.calls.every(([url])=>!String(url).includes(chatId.toUpperCase()))).toBe(true);
});
test('accepting an invitation opens a conversation with the fresh member count',async()=>{
  count=1;mockAuth={...mockAuth,role:'model',account:{id:'member',role:'model'}};
  renderRoute('/event-chats');
  fireEvent.click(await screen.findByRole('button',{name:'Accept'}));
  expect(await screen.findByText(/Live.*2 members/)).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/invitations/invitation/respond'),expect.objectContaining({method:'PATCH',body:JSON.stringify({action:'accept'})}));
});
test('join approval refreshes the current conversation header',async()=>{
  await openRoom();
  fireEvent.click(screen.getByText('Incoming join requests'));
  fireEvent.click(await screen.findByRole('button',{name:'Approve'}));
  expect(await screen.findByText(/3 members/)).toBeInTheDocument();
});
test('successful removal refreshes the header and member list',async()=>{
  await openRoom();
  fireEvent.click(await screen.findByRole('button',{name:'Remove',exact:true}));
  fireEvent.click(screen.getByRole('button',{name:'Confirm removal'}));
  expect(await screen.findByText(/1 members/)).toBeInTheDocument();
  await waitFor(()=>expect(screen.queryByRole('button',{name:'Remove',exact:true})).not.toBeInTheDocument());
});
test('refreshing received invitation status reconciles the owner header',async()=>{
  await openRoom();
  fireEvent.click(screen.getByText('Sent invitations'));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Refresh invitations'})).toBeEnabled());
  accepted=true;count=3;
  fireEvent.click(screen.getByRole('button',{name:'Refresh invitations'}));
  expect(await screen.findByText(/3 members/)).toBeInTheDocument();
});
test.each([403,404])('an invitation target error (%s) remains local when the owner retains chat access',async status=>{
  await openRoom();actionFailure=status;
  fireEvent.click(screen.getByText('Invite approved users'));
  fireEvent.click(await screen.findByRole('button',{name:'Invite',exact:true}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Invited account unavailable');
  await act(async()=>{});
  expect(screen.getByText(/Live.*2 members/)).toBeInTheDocument();
  expect(screen.queryByText(/Private chat content has been cleared/)).not.toBeInTheDocument();
});
test('a missing removal target does not revoke the owner conversation',async()=>{
  await openRoom();actionFailure=404;
  fireEvent.click(await screen.findByRole('button',{name:'Remove',exact:true}));
  fireEvent.click(screen.getByRole('button',{name:'Confirm removal'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Member already removed');
  await act(async()=>{});
  expect(screen.getByText(/Live.*2 members/)).toBeInTheDocument();
});
test('owner resource errors still clear content when the access recheck confirms revocation',async()=>{
  await openRoom();actionFailure=403;headerForbidden=true;
  fireEvent.click(screen.getByText('Invite approved users'));
  fireEvent.click(await screen.findByRole('button',{name:'Invite',exact:true}));
  expect(await screen.findByText(/Private chat content has been cleared/)).toBeInTheDocument();
  expect(screen.queryByText(/members$/)).not.toBeInTheDocument();
});

test('a missing private image keeps the real conversation connected and visible',async()=>{
  missingImage=true;await openRoom();
  expect(await screen.findByRole('alert')).toHaveTextContent('Private image is unavailable.');
  expect(screen.getByText(/Live.*2 members/)).toBeInTheDocument();
  expect(screen.getByRole('textbox',{name:'Message'})).toBeInTheDocument();
  expect(screen.queryByText(/Private chat content has been cleared/)).not.toBeInTheDocument();
});
