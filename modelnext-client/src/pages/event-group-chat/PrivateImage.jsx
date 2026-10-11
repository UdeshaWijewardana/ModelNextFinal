import React, {useEffect, useState} from 'react';
import {privateImage} from './api';

export default function PrivateImage({chatId, message, onError}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl;
    setUrl(''); setError('');
    privateImage(chatId,message.id,controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
    }).catch(error => { if (!controller.signal.aborted) {setError(error.message); if ([401,403].includes(error.status)) onError(error);} });
    return () => {controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl);};
  }, [chatId,message.id,onError]);
  if (error) return <span role="alert">{error}</span>;
  return url ? <a href={url} target="_blank" rel="noreferrer"><img className="ec-message-image" src={url} alt="Shared event chat attachment" width={message.image?.width} height={message.image?.height} loading="lazy"/></a> : <span role="status">Loading private image...</span>;
}
