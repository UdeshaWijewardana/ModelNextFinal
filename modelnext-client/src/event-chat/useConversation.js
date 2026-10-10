import {useCallback, useEffect, useRef, useState} from 'react';
import {io} from 'socket.io-client';
import {SERVER_BASE_URL} from '../api';
import {acknowledge, chatApi, mergeMessages, pagePath, recoverHistory} from './api';

export default function useConversation(routeChatId) {
  const chatId = routeChatId.toLowerCase();
  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [connection, setConnection] = useState('Connecting');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revoked, setRevoked] = useState('');
  const socket = useRef(null);
  const records = useRef([]);
  const active = useRef(false);
  const denied = useRef(false);
  const controller = useRef(null);
  const roomGeneration = useRef(0);
  const paging = useRef(false);
  const initialized = useRef(false);
  const headerGeneration = useRef(0);
  const merge = useCallback(incoming => {
    if (!active.current || denied.current) return;
    records.current = mergeMessages(records.current, incoming);
    setMessages(records.current);
  }, []);
  const fail = useCallback((reason, forceRevoke = false) => {
    if (!active.current) return;
    const status = reason.status;
    if (forceRevoke || [401,403].includes(status)) {
      denied.current = true; ++roomGeneration.current;
      controller.current?.abort(); socket.current?.disconnect();
      records.current = []; setMessages([]); setChat(null); setCursor(null);
      setRevoked(reason.message || reason.error || 'Chat access is no longer available.');
      setConnection('Access unavailable');
    } else setError(reason.message || reason.error || 'Chat is temporarily unavailable.');
  }, []);
  // A resource-specific 403/404 must not be mistaken for lost chat access.
  const refreshHeader = useCallback(async () => {
    if (!active.current || denied.current || !controller.current) return null;
    const signal = controller.current.signal;
    const generation = ++headerGeneration.current;
    try {
      const result = await chatApi('/' + chatId, {signal});
      if (signal.aborted || denied.current) return null;
      if (generation === headerGeneration.current) setChat(result.chat);
      return result.chat;
    } catch (error) {
      if (!signal.aborted && generation === headerGeneration.current) fail(error, error.status === 404);
      return null;
    }
  }, [chatId, fail]);
  const actionError = useCallback(async error => {
    if (error.status === 401) fail(error);
    else if ([403,404].includes(error.status)) await refreshHeader();
  }, [fail, refreshHeader]);
  useEffect(() => {
    active.current = true; denied.current = false; initialized.current = false;
    records.current = []; setMessages([]); setChat(null); setCursor(null); setRevoked(''); setError(''); setLoading(true);
    const abort = new AbortController(); controller.current = abort;
    const client = io(new URL(SERVER_BASE_URL).origin, {withCredentials:true, autoConnect:false});
    socket.current = client;
    const join = async () => {
      const generation = ++roomGeneration.current;
      setConnection('Joining'); setError('');
      const known = new Set(records.current.map(message => message.id));
      try {
        await acknowledge(client, 'chat:join', {chatId});
        if (abort.signal.aborted || denied.current || generation !== roomGeneration.current) return;
        if (initialized.current && !await refreshHeader()) {
          if (!abort.signal.aborted && !denied.current) {setConnection('Reconnect needed');setLoading(false);}
          return;
        }
        if (abort.signal.aborted || denied.current || generation !== roomGeneration.current) return;
        setConnection('Recovering history');
        const recovered = await recoverHistory(chatId, known, abort.signal);
        if (abort.signal.aborted || denied.current || generation !== roomGeneration.current) return;
        merge(recovered.messages);
        if (!initialized.current) { setCursor(recovered.nextCursor); initialized.current = true; }
        setConnection('Live'); setLoading(false);
      } catch (error) {
        if (abort.signal.aborted || generation !== roomGeneration.current) return;
        fail(error, error.status === 404); setConnection('Reconnect needed'); setLoading(false);
      }
    };
    const receive = payload => { if (payload.message?.chatId === chatId) merge([payload.message]); };
    const revoke = payload => { if (!payload.chatId || payload.chatId === chatId) fail({...payload,message:payload.error}, true); };
    const chatError = payload => fail({...payload,message:payload.error}, payload.status === 404);
    const connectError = error => { if (!abort.signal.aborted) {setConnection('Connection failed'); setLoading(false); fail({status:error.data?.status,message:error.message});} };
    const disconnect = () => { ++roomGeneration.current; if (!denied.current && !abort.signal.aborted) setConnection('Disconnected'); };
    client.on('connect',join); client.on('chat:message',receive); client.on('chat:access_revoked',revoke);
    client.on('chat:error',chatError); client.on('connect_error',connectError); client.on('disconnect',disconnect);
    // Fetch the authorized header first. Socket rooms never grant REST access.
    refreshHeader().then(detail => {
      if (abort.signal.aborted) return;
      if (detail) client.connect();
      else setLoading(false);
    });
    // Returning to this view reconciles changes made by another account/tab.
    // There is no membership socket event and no polling is needed.
    const focus = () => { if (!abort.signal.aborted && initialized.current) refreshHeader(); };
    window.addEventListener('focus', focus);
    return () => {
      active.current = false; abort.abort();
      window.removeEventListener('focus', focus);
      if (client.connected) client.timeout(1000).emit('chat:leave',{chatId}, () => {});
      client.off('connect',join); client.off('chat:message',receive); client.off('chat:access_revoked',revoke);
      client.off('chat:error',chatError); client.off('connect_error',connectError); client.off('disconnect',disconnect);
      client.disconnect(); socket.current = null;
    };
  }, [chatId, fail, merge, refreshHeader]);
  const older = async () => {
    if (!cursor || paging.current || denied.current) return;
    paging.current = true; setLoading(true); setError('');
    try {
      const page = await chatApi(pagePath('/' + chatId + '/messages',cursor),{signal:controller.current.signal});
      if (!active.current || denied.current) return;
      merge(page.messages); setCursor(page.nextCursor);
    } catch (error) { if (error.name !== 'AbortError') fail(error, error.status === 404); }
    finally { paging.current = false; if (active.current && !denied.current) setLoading(false); }
  };
  const send = async pending => {
    if (denied.current || !socket.current?.connected || connection !== 'Live') throw new Error('Reconnect before sending.');
    try { const result = await acknowledge(socket.current,'chat:send',{chatId,text:pending.text,clientMessageId:pending.clientMessageId}); merge([result.message]); return result; }
    catch (error) { fail(error, error.status === 404); throw error; }
  };
  const reconnect = async () => {
    if (denied.current) return;
    try {
      if (!chat && !await refreshHeader()) return;
      if (!active.current || denied.current) return;
      const client = socket.current;
      if (client?.connected) client.disconnect();
      client?.connect();
    } catch (error) { if (error.name !== 'AbortError') fail(error); }
  };
  return {chat,messages,cursor,connection,loading,error,revoked,fail,actionError,refreshHeader,merge,older,send,reconnect,signal:controller.current?.signal};
}
