import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { chatApi, pagePath } from './api';
import '../styles/EventChat.css';

export function ChatGate({children}) {
  const auth = useAuth();
  if (auth.status === 'loading') return <p className="ec-notice" role="status">Checking your session...</p>;
  if (auth.status !== 'authenticated' || auth.kind !== 'user') return <p className="ec-notice">An approved user account is required. <Link to="/login">Sign in</Link></p>;
  return <React.Fragment key={auth.role + ':' + (auth.account?.id || auth.account?._id)}>{children}</React.Fragment>;
}
export function Notice({error, children}) {
  return <p className={error ? 'ec-error' : 'ec-notice'} role={error ? 'alert' : 'status'}>{error || children}</p>;
}
export function useList(path, field, onError, cursorName = 'before') {
  const [state, setState] = useState({items:[], cursor:null, loading:true, error:''});
  const generation = useRef(0);
  const controller = useRef(null);
  const callback = useRef(onError);
  callback.current = onError;
  const load = useCallback(async (cursor = null) => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const version = ++generation.current;
    setState(previous => ({...previous, loading:true, error:''}));
    try {
      const data = await chatApi(pagePath(path, cursor, cursorName), {signal:abort.signal});
      if (version !== generation.current || abort.signal.aborted) return;
      setState(previous => ({items:cursor ? [...previous.items, ...data[field]] : data[field], cursor:data.nextCursor, loading:false, error:''}));
    } catch (error) {
      if (abort.signal.aborted || version !== generation.current) return;
      setState(previous => ({...previous, loading:false, error:error.message}));
      callback.current?.(error);
    }
  }, [path, field, cursorName]);
  useEffect(() => { setState({items:[],cursor:null,loading:true,error:''}); load(); return () => { controller.current?.abort(); }; }, [load]);
  return {...state, refresh:() => load(), more:() => load(state.cursor)};
}
export function ListState({list}) {
  return <>{list.error && <Notice error={list.error}/>} {list.loading && <Notice>Loading...</Notice>}{!list.loading && !list.error && !list.items.length && <p className="ec-muted">Nothing here yet.</p>}{list.cursor && <button type="button" disabled={list.loading} onClick={list.more}>Load more</button>}</>;
}
