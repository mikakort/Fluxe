import React, { useEffect, useCallback, useState } from 'react';
import ReactPlayer from 'react-player';
import peer from '../service/peer';

const VideoChat = ({ roomId, socket, to, setBegin }) => {
  // Chat vars
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  // Cam vars
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState();
  const [remoteStream, setRemoteStream] = useState();

  const [skOrCl, setSkOrCl] = useState('Start');

  useEffect(() => {
    setRemoteSocketId(to);
  }, [to]);

  const start = () => {
    if (skOrCl === 'Start') {
      console.log('socket begin');
      setBegin(true);
    } else if (skOrCl === 'Skip') {
      console.log('skiping');
      // MISSING FUNCTIONALITY

      /*
      1. Close WebRTC
      2. Close socket, then reset all variables: socket, begin, room...
      3. Emit disconnect, automatically done after socket close
      4. *SERVER SIDE*: delete room after both users are out
      */
    }
  };

  const handleCallUser = useCallback(
    async (data) => {
      console.log(data.peerServer);
      if (socket && data.peerServer === 'A') {
        console.log(`Peer: ${socket.id} sends offer`);
        const room = data.room;
        setSkOrCl('Skip');
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        const offer = await peer.getOffer();
        setMyStream(stream);
        console.log(`Peer: ${socket.id} sets stream`);
        socket.emit('user:call', { roomId: room, offer });
        console.log(`Peer: ${socket.id} sends offer through server`);
      } else if (data.peerServer === 'B') {
        console.log('Peer B, wait for call');
      }
    },
    [socket]
  );

  const handleIncommingCall = useCallback(
    async ({ from, offer }) => {
      console.log(`Peer: ${socket.id} receives offer`);
      setRemoteSocketId(from);
      console.log(`Peer: ${socket.id} sets remote socket Id`);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      setMyStream(stream);
      console.log(`Incoming Call`, from, offer);
      const ans = await peer.getAnswer(offer);
      console.log(`Peer: ${socket.id} sets remote description`);
      socket.emit('call:accepted', { to: from, ans });
      console.log(`Peer: ${socket.id} sends answer`);
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
      console.log(`Peer: ${socket.id} gets accepted`);
      sendStreams();
      console.log(`Peer: ${socket.id} sent streams`);
    },
    [sendStreams, socket]
  );

  const handleNegoNeeded = useCallback(async () => {
    if (socket) {
      console.log('Emitting negotiation');
      const offer = await peer.getOffer();
      socket.emit('peer:nego:needed', { offer, to: remoteSocketId });
    }
  }, [remoteSocketId, socket]);

  useEffect(() => {
    // Listen for connection state changes
    peer.peer.onconnectionstatechange = (event) => {
      console.log(`Connection state change: ${peer.peer.connectionState}`);
    };

    // Listen for signaling state changes
    peer.peer.onsignalingstatechange = (event) => {
      console.log(`Signaling state change: ${peer.peer.signalingState}`);
    };

    // Listen for ICE gathering state changes
    peer.peer.onicegatheringstatechange = (event) => {
      console.log(`ICE gathering state change: ${peer.peer.iceGatheringState}`);
    };

    // Listen for ICE connection state changes
    peer.peer.oniceconnectionstatechange = (event) => {
      console.log(`ICE connection state change: ${peer.peer.iceConnectionState}`);
    };

    peer.peer.addEventListener('negotiationneeded', handleNegoNeeded);
    return () => {
      peer.peer.removeEventListener('negotiationneeded', handleNegoNeeded);
    };
  }, [handleNegoNeeded]);

  const handleNegoNeedIncomming = useCallback(
    async ({ from, offer }) => {
      console.log('Answering negotiation');
      if (socket) {
        const ans = await peer.getAnswer(offer);
        socket.emit('peer:nego:done', { to: from, ans });
      }
    },
    [socket]
  );

  const handleNegoNeedFinal = useCallback(async ({ ans }) => {
    console.log('Negotiation confirmation');
    await peer.setLocalDescription(ans);
  }, []);

  useEffect(() => {
    peer.peer.addEventListener('track', async (ev) => {
      const remoteStream = ev.streams;
      console.log('GOT TRACKS!!');
      setRemoteStream(remoteStream[0]);
      console.log(remoteStream[0]);
      console.log(ev);
    });
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('user:joined', handleCallUser);
      socket.on('incomming:call', handleIncommingCall);
      socket.on('call:accepted', handleCallAccepted);
      socket.on('peer:nego:needed', handleNegoNeedIncomming);
      socket.on('peer:nego:final', handleNegoNeedFinal);

      return () => {
        socket.off('user:joined', handleCallUser);
        socket.off('incomming:call', handleIncommingCall);
        socket.off('call:accepted', handleCallAccepted);
        socket.off('peer:nego:needed', handleNegoNeedIncomming);
        socket.off('peer:nego:final', handleNegoNeedFinal);
      };
    }
  }, [socket, handleCallUser, handleIncommingCall, handleCallAccepted, handleNegoNeedIncomming, handleNegoNeedFinal]);

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
          <button type="submit" onClick={start}>
            {skOrCl}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoChat;
