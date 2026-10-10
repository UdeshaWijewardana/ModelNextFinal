import {acknowledge, chatApi, mergeMessages, pagePath, privateImage, recoverHistory, uploadImage} from './api';
import {API_BASE_URL} from '../api';

const message = (id, time = '2026-01-01T00:00:00.000Z') => ({id, createdAt:time});
const response = data => ({ok:true,status:200,json:async () => data});
beforeEach(() => {global.fetch = jest.fn();});
afterEach(() => jest.restoreAllMocks());

test('merges acknowledgements, broadcasts and history by server ID in stable order', () => {
  expect(mergeMessages([message('b'),message('a')],[message('b'),message('c','2026-01-02T00:00:00.000Z')]).map(item=>item.id)).toEqual(['a','b','c']);
});
test('recovers a reconnect gap spanning multiple history pages', async () => {
  fetch.mockResolvedValueOnce(response({messages:[message('d')],nextCursor:'new cursor'}))
    .mockResolvedValueOnce(response({messages:[message('b'),message('c')],nextCursor:'older'}))
    .mockResolvedValueOnce(response({messages:[message('a')],nextCursor:'oldest'}));
  const result = await recoverHistory('chat',new Set(['a']),new AbortController().signal);
  expect(result.messages.map(item=>item.id)).toEqual(['a','b','c','d']);
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(fetch.mock.calls[1][0]).toContain('before=new%20cursor');
  expect(fetch.mock.calls[0][1].credentials).toBe('include');
});
test('initial recovery loads one page and preserves older pagination', async () => {
  fetch.mockResolvedValue(response({messages:[message('a')],nextCursor:'older'}));
  expect((await recoverHistory('chat',new Set())).nextCursor).toBe('older');
  expect(fetch).toHaveBeenCalledTimes(1);
});
test('preserves authentication failure status for access revocation', async () => {
  fetch.mockResolvedValue({ok:false,status:401,json:async()=>({error:'Session expired'})});
  await expect(chatApi('/mine')).rejects.toMatchObject({status:401,message:'Session expired'});
});
test('member pagination uses its documented cursor name', () => {
  expect(pagePath('/chat/members','id:model','memberBefore')).toBe('/chat/members?limit=30&memberBefore=id%3Amodel');
});
test('private images use credentialed no-store API retrieval', async () => {
  const blob=new Blob(['image'],{type:'image/webp'});
  fetch.mockResolvedValue({ok:true,blob:async()=>blob});
  await expect(privateImage('chat','message')).resolves.toBe(blob);
  expect(fetch).toHaveBeenCalledWith(API_BASE_URL+'/event-chats/chat/messages/message/image',expect.objectContaining({credentials:'include',cache:'no-store'}));
});
test('image retries preserve the original key and omit JSON Content-Type', async () => {
  fetch.mockResolvedValue(response({message:message('saved')}));
  const pending={file:new File(['image'],'photo.png',{type:'image/png'}),text:'Caption',clientMessageId:'same_retry_key'};
  await uploadImage('chat',pending); await uploadImage('chat',pending);
  for (const [,options] of fetch.mock.calls) {
    expect(options.credentials).toBe('include'); expect(options.headers).toBeUndefined();
    expect(options.body.get('clientMessageId')).toBe('same_retry_key');
    expect(options.body.get('text')).toBe('Caption');
  }
});
test('socket acknowledgement failures preserve status', async () => {
  const socket={timeout:jest.fn().mockReturnThis(),emit:jest.fn((event,payload,callback)=>callback(null,{ok:false,status:403,error:'Removed'}))};
  await expect(acknowledge(socket,'chat:join',{chatId:'chat'})).rejects.toMatchObject({status:403});
});
test('acknowledgement timeout does not claim message delivery failed definitively', async () => {
  const socket={timeout:jest.fn().mockReturnThis(),emit:jest.fn((event,payload,callback)=>callback(new Error('timeout')))};
  await expect(acknowledge(socket,'chat:send',{clientMessageId:'retry_key'})).rejects.toMatchObject({status:0,message:expect.stringContaining('Retry the same message')});
});
