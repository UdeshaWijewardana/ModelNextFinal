import React, {useState} from 'react';
import {ListState, Notice, useList} from './shared';
import {chatApi, mutate} from './api';

export default function OwnerTools({chatId, onError, onMembersChanged}) {
  const [role, setRole] = useState('model');
  const [name, setName] = useState('');
  const [query, setQuery] = useState({role:'model',name:''});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const users = useList('/' + chatId + '/users?role=' + query.role + '&q=' + encodeURIComponent(query.name), 'users', onError);
  const invitations = useList('/' + chatId + '/invitations', 'invitations', onError);
  const requests = useList('/' + chatId + '/join-requests', 'requests', onError);
  const act = async (path, body, method = 'POST') => {
    setBusy(true); setError(''); setNotice('');
    try { await mutate(path, body, method); setNotice('Saved successfully.'); invitations.refresh(); requests.refresh(); if (body.action === 'approve') onMembersChanged(); }
    catch (error) { setError(error.message); onError(error); if (error.status === 409) { invitations.refresh(); requests.refresh(); } }
    finally { setBusy(false); }
  };
  const refreshManagement = async list => {
    await list.refresh();
    onMembersChanged();
  };
  return <section className="ec-card ec-owner"><h2>Manage this chat</h2>{error && <Notice error={error}/>} {notice && <Notice>{notice}</Notice>}
    <details><summary>Invite approved users</summary><form className="ec-search" onSubmit={event => {event.preventDefault(); setQuery({role,name});}}><label>Account role<select value={role} onChange={event => setRole(event.target.value)}>{['model','photographer','agency','client'].map(value => <option key={value}>{value}</option>)}</select></label><label>Name<input value={name} maxLength={80} onChange={event => setName(event.target.value)}/></label><button type="submit">Search</button></form>{users.items.map(user => <div className="ec-row" key={user.role + user.id}><span>{user.name} <small>({user.role})</small></span><button disabled={busy} onClick={() => act('/' + chatId + '/invitations',{invitedUserId:user.id,invitedUserRole:user.role})}>Invite</button></div>)}<ListState list={users}/></details>
    <details><summary>Sent invitations</summary><button disabled={invitations.loading} onClick={() => refreshManagement(invitations)}>Refresh invitations</button>{invitations.items.map(item => <div className="ec-row" key={item._id}><span>{item.recipient?.name || 'Unavailable account'} | {item.invitedUserRole}</span><span className="ec-badge">{item.status}</span></div>)}<ListState list={invitations}/></details>
    <details><summary>Incoming join requests</summary><button disabled={requests.loading} onClick={() => refreshManagement(requests)}>Refresh requests</button>{requests.items.map(item => <div className="ec-row" key={item._id}><span>{item.requester?.name || 'Unavailable account'} | {item.requestedByRole}</span><span className="ec-badge">{item.status}</span>{item.status === 'pending' && <div className="ec-actions"><button disabled={busy} onClick={() => act('/join-requests/' + item._id + '/respond',{action:'approve'},'PATCH')}>Approve</button><button disabled={busy} onClick={() => act('/join-requests/' + item._id + '/respond',{action:'reject'},'PATCH')}>Reject</button></div>}</div>)}<ListState list={requests}/></details>
  </section>;
}
export function Members({chatId, isOwner, onError, revision, onChanged}) {
  const list = useList('/' + chatId + '/members', 'members', onError, 'memberBefore');
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = React.useRef(list.refresh); refresh.current = list.refresh;
  React.useEffect(() => { if (revision) refresh.current(); }, [revision]);
  const remove = async () => {
    setBusy(true); setError('');
    try { await chatApi('/' + chatId + '/members/' + target.role + '/' + target.id,{method:'DELETE'}); setTarget(null); list.refresh(); onChanged(); }
    catch (error) { setError(error.message); onError(error); }
    finally { setBusy(false); }
  };
  return <section className="ec-card"><div className="ec-section-title"><h2>Members</h2><button disabled={list.loading} onClick={async () => { await list.refresh(); onChanged(); }}>Refresh</button></div>{error && <Notice error={error}/>} {list.items.map(member => <div className="ec-row" key={member.role + member.id}><span>{member.name}<small>{member.role}{member.isOwner ? ' | Owner' : ''}</small></span>{isOwner && !member.isOwner && <button disabled={busy} onClick={() => setTarget(member)}>Remove</button>}</div>)}{target && <div className="ec-confirm" role="group" aria-label="Confirm member removal"><p>Remove {target.name} from this chat?</p><button disabled={busy} onClick={remove}>Confirm removal</button><button disabled={busy} onClick={() => setTarget(null)}>Cancel</button></div>}<ListState list={list}/></section>;
}
