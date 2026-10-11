import React from 'react';
import {render, screen, waitFor} from '@testing-library/react';
import PrivateImage from './PrivateImage';
import {privateImage} from './api';
jest.mock('./api',()=>({privateImage:jest.fn()}));
beforeEach(()=>{
  jest.clearAllMocks();URL.createObjectURL=jest.fn(()=> 'blob:private-image');URL.revokeObjectURL=jest.fn();
});
test('revokes the private image blob and aborts requests when chat content unmounts',async()=>{
  privateImage.mockResolvedValue(new Blob(['image'],{type:'image/webp'}));
  const {unmount}=render(<PrivateImage chatId="chat" message={{id:'message',image:{width:10,height:10}}} onError={jest.fn()}/>);
  await waitFor(()=>expect(screen.getByAltText('Shared event chat attachment')).toHaveAttribute('src','blob:private-image'));
  const signal=privateImage.mock.calls[0][2];
  unmount();
  expect(signal.aborted).toBe(true);expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:private-image');
});
test('a protected image authentication failure reaches the chat access handler',async()=>{
  privateImage.mockRejectedValue({status:401,message:'Session expired'});
  const onError=jest.fn();
  render(<PrivateImage chatId="chat" message={{id:'message'}} onError={onError}/>);
  await waitFor(()=>expect(onError).toHaveBeenCalledWith({status:401,message:'Session expired'}));
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

test('a missing image stays local and never revokes conversation access',async()=>{
  privateImage.mockRejectedValue({status:404,message:'Private image is unavailable.'});
  const onError=jest.fn();
  render(<PrivateImage chatId="chat" message={{id:'missing'}} onError={onError}/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Private image is unavailable.');
  expect(onError).not.toHaveBeenCalled();
});
test('a genuine image authorization failure reaches the access handler',async()=>{
  privateImage.mockRejectedValue({status:403,message:'Membership required'});
  const onError=jest.fn();
  render(<PrivateImage chatId="chat" message={{id:'message'}} onError={onError}/>);
  await waitFor(()=>expect(onError).toHaveBeenCalledWith({status:403,message:'Membership required'}));
});
