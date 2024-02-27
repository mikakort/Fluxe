import React, { useEffect, useCallback, useState } from 'react';
import ReactPlayer from 'react-player';
import peer from '../service/peer';

const VideoChat = ({ roomId, socket, to }) => {
  // Chat vars
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  // Cam vars
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState();
  const [remoteStream, setRemoteStream] = useState();

  useEffect(() => {
    setRemoteSocketId(to);
  }, [to]);

  const handleCallUser = useCallback(async () => {
    if (socket) {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      const offer = await peer.getOffer();
      socket.emit('user:call', { to: remoteSocketId, offer });
      setMyStream(stream);
    }
  }, [remoteSocketId, socket]);

  const handleIncommingCall = useCallback(
    async ({ from, offer }) => {
      if (socket) {
        setRemoteSocketId(from);
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        setMyStream(stream);
        console.log(`Incoming Call`, from, offer);
        const ans = await peer.getAnswer(offer);
        socket.emit('call:accepted', { to: from, ans });
      }
    },
    [socket]
  );

  const sendStreams = useCallback(() => {
    if (myStream) {
      for (const track of myStream.getTracks()) {
        peer.peer.addTrack(track, myStream);
      }
    }
  }, [myStream]);

  const handleCallAccepted = useCallback(
    ({ from, ans }) => {
      peer.setLocalDescription(ans);
      console.log('Call Accepted!');
      sendStreams();
    },
    [sendStreams]
  );

  const handleNegoNeeded = useCallback(async () => {
    if (socket) {
      const offer = await peer.getOffer();
      socket.emit('peer:nego:needed', { offer, to: remoteSocketId });
    }
  }, [remoteSocketId, socket]);

  useEffect(() => {
    peer.peer.addEventListener('negotiationneeded', handleNegoNeeded);
    return () => {
      peer.peer.removeEventListener('negotiationneeded', handleNegoNeeded);
    };
  }, [handleNegoNeeded]);

  const handleNegoNeedIncomming = useCallback(
    async ({ from, offer }) => {
      if (socket) {
        const ans = await peer.getAnswer(offer);
        socket.emit('peer:nego:done', { to: from, ans });
      }
    },
    [socket]
  );

  const handleNegoNeedFinal = useCallback(async ({ ans }) => {
    await peer.setLocalDescription(ans);
  }, []);

  useEffect(() => {
    peer.peer.addEventListener('track', async (ev) => {
      const remoteStream = ev.streams;
      console.log('GOT TRACKS!!');
      setRemoteStream(remoteStream[0]);
    });
  }, []);

  useEffect(() => {
    if (socket) {
      // socket.on('user:joined', handleUserJoined);
      socket.on('incomming:call', handleIncommingCall);
      socket.on('call:accepted', handleCallAccepted);
      socket.on('peer:nego:needed', handleNegoNeedIncomming);
      socket.on('peer:nego:final', handleNegoNeedFinal);

      return () => {
        // socket.off('user:joined', handleUserJoined);
        socket.off('incomming:call', handleIncommingCall);
        socket.off('call:accepted', handleCallAccepted);
        socket.off('peer:nego:needed', handleNegoNeedIncomming);
        socket.off('peer:nego:final', handleNegoNeedFinal);
      };
    }
  }, [socket, handleIncommingCall, handleCallAccepted, handleNegoNeedIncomming, handleNegoNeedFinal]);

  // Chat funcs

  useEffect(() => {
    if (socket) {
      socket.on('message', (data) => {
        const message = data.text;
        if (message) {
          setMessages((messages) => {
            return [...messages, '[Guest] ' + message];
          });
        }
      });

      return () => {
        socket.close();
      };
    }
  }, [socket]);

  const handleSend = () => {
    socket.emit('messagetoserver', roomId, input, to);

    setMessages((messages) => {
      return [...messages, '[Me] ' + input];
    });

    setInput('');
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="main">
      <div className="camholder">
        <div className="video">
          <ReactPlayer playing url={remoteStream} />
        </div>

        <button onClick={handleCallUser}>CALL</button>

        <div className="video">
          <ReactPlayer playing url={myStream} />
        </div>
      </div>

      <div className="chat">
        <div className="chatbox">
          {messages.map((message, index) => (
            <p key={index}>{message}</p>
          ))}
        </div>
        <div className="chat-input">
          <input
            type="text"
            name="inputBox"
            placeholder="Enter your message here"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
          />
          <button type="button" onClick={handleSend}>
            Send
          </button>
          <button type="submit">Skip</button>
        </div>
      </div>
    </div>
  );
};

export default VideoChat;
