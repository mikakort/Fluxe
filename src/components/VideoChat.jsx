import React, { useEffect, useCallback, useState } from 'react';
import ReactPlayer from 'react-player';
import peer from '../service/peer';

const VideoChat = ({ roomId, socket, to, setBegin, setSocket, setRoomId, setTo }) => {
  const [pr, setPr] = useState(peer);
  // Chat vars
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  // Cam var
  const [remoteSocketId, setRemoteSocketId] = useState(null);
  const [myStream, setMyStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const [callerlee, setCallerlee] = useState('');
  const [signalState, setSignalState] = useState('');
  const [gotTracks, setGotTracks] = useState(false);
  const [sentStreams, setSentStreams] = useState(false);

  const [skOrCl, setSkOrCl] = useState('Start');

  const init = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    if (!stream) {
      window.alert("couldn't get camera && || audio");
    }

    console.log(navigator);
    console.log(navigator.mediaDevices);

    setMyStream(stream);

    return;
  }, [pr]);

  const terminateCall = useCallback(
    async (who) => {
      //1. Close WebRTC

      if (remoteStream) {
        await remoteStream.getTracks().forEach((track) => track.stop());
      }
      setRemoteStream(null);

      if (myStream) {
        await myStream.getTracks().forEach((track) => track.stop());
      }

      setMyStream(null);

      pr.peer.close();

      pr.peer = new RTCPeerConnection({
        iceServers: [
          {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
          },
        ],
      }); //3. Then reset all variables: socket, begin, room...

      setPr(pr);

      // Higher level
      setBegin(false);
      setSocket(null);
      setRoomId(null);
      setTo(null);

      // messages
      setMessages([`${who.who} disconnected, you will be matched again shortly`]);
      setInput(''); // if leaves with message in input, wouldn't have reset

      // cam
      setRemoteSocketId(null);
      setRemoteStream(null);

      setCallerlee('');
      setSignalState('');
      setGotTracks(false);
      setSentStreams(false);

      await init();

      return;
    },
    [remoteStream, setRoomId, setSocket, setTo, setBegin, pr, setPr, init, myStream]
  );

  const terminate = useCallback(
    async (who) => {
      console.log('terminating');

      await terminateCall({ who: who.who });

      pr.peer.addEventListener('track', async (ev) => {
        const rem = ev.streams;
        console.log('GOT TRACKS!!');
        setRemoteStream(rem[0]);
        setGotTracks(true);
        console.log(rem[0]);
      });

      console.log('resetting begin');

      setTimeout(() => {
        setBegin(true);
      }, 0.1);
    },
    [setBegin, terminateCall]
  );

  const start = useCallback(async () => {
    if (skOrCl === 'Start') {
      console.log('socket begin');
      await init();
      setBegin(true);
      setSkOrCl('Skip');
    } else if (skOrCl === 'Skip') {
      if (socket) {
        console.log('user:disconnect');
        socket.emit('user:disconnect');
      }
    }
  }, [skOrCl, init, setBegin, socket]);

  const sendStreams = useCallback(() => {
    if (myStream) {
      console.log('made it here');
      for (const track of myStream.getTracks()) {
        pr.peer.addTrack(track, myStream);
      }
    }
  }, [myStream, pr]);

  const handleCallUser = useCallback(
    async (data) => {
      setMessages([]);
      console.log(data.peerServer);
      setCallerlee(data.peerServer);
      if (socket && data.peerServer === 'A') {
        const room = data.room;
        setRemoteSocketId(data.remote);

        const offer = await pr.getOffer();

        socket.emit('user:call', { roomId: room, offer });
        console.log(`Peer: ${socket.id} Sends offer`);
      }
    },
    [socket, pr]
  );

  const handleIncommingCall = useCallback(
    async ({ from, offer }) => {
      console.log(`Incoming Call`, from, offer);

      setRemoteSocketId(from);
      console.log(`Peer: ${socket.id} sets remote socket Id`);

      const ans = await pr.getAnswer(offer);

      socket.emit('call:accepted', { to: from, ans });
      console.log(`Peer: ${socket.id} Sends answer`);
    },
    [socket, pr]
  );

  const handleCallAccepted = useCallback(
    async ({ from, ans }) => {
      pr.setLocalDescription(ans);
      sendStreams();
      console.log(`Peer: ${socket.id} Adds tracks`);
      console.log(`Peer: ${socket.id} Sets remote description to ans`);
    },
    [socket, sendStreams, pr]
  );

  const handleNegoNeeded = useCallback(async () => {
    if (socket) {
      console.log('Emitting negotiation');

      const offer = await pr.getOffer();
      socket.emit('peer:nego:needed', { offer, to: remoteSocketId });
    }
  }, [socket, remoteSocketId, pr]);

  useEffect(() => {
    // Listen for connection state changes
    pr.peer.onconnectionstatechange = (event) => {
      console.log(`Connection state change: ${pr.peer.connectionState}`);
    };

    // Listen for signaling state changes
    pr.peer.onsignalingstatechange = (event) => {
      console.log(`Signaling state change: ${pr.peer.signalingState}`);
      setSignalState(pr.peer.signalingState);
    };

    // Listen for ICE gathering state changes
    pr.peer.onicegatheringstatechange = (event) => {
      console.log(`ICE gathering state change: ${pr.peer.iceGatheringState}`);
    };

    // Listen for ICE connection state changes
    pr.peer.oniceconnectionstatechange = (event) => {
      console.log(`ICE connection state change: ${pr.peer.iceConnectionState}`);
    };

    pr.peer.ontrack = (event) => {
      console.log(`track track:`);
      console.log(event.streams[0]);
    };

    pr.peer.addEventListener('negotiationneeded', handleNegoNeeded);
    return () => {
      console.log('removing');
      pr.peer.removeEventListener('negotiationneeded', handleNegoNeeded);
    };
  }, [handleNegoNeeded, socket, pr]);

  const handleNegoNeedIncomming = useCallback(
    async ({ from, offer }) => {
      console.log('Answering negotiation');
      if (socket) {
        const ans = await pr.getAnswer(offer);
        socket.emit('peer:nego:done', { to: from, ans });
      }
    },
    [socket, pr]
  );

  const handleNegoNeedFinal = useCallback(
    async ({ ans }) => {
      await pr.setLocalDescription(ans);
      console.log('Negotiation confirmation');
    },
    [pr]
  );

  useEffect(() => {
    pr.peer.addEventListener('track', async (ev) => {
      const rem = ev.streams;
      console.log('GOT TRACKS!!');
      setRemoteStream(rem[0]);
      setGotTracks(true);
      console.log(rem[0]);
    });
  }, [pr]);

  useEffect(() => {
    if (callerlee === 'B' && signalState === 'stable' && gotTracks && !sentStreams) {
      sendStreams();
      setSentStreams(true);
    }
  }, [callerlee, signalState, gotTracks, sentStreams, sendStreams]);

  useEffect(() => {
    if (socket) {
      socket.on('user:joined', handleCallUser);
      socket.on('incomming:call', handleIncommingCall);
      socket.on('call:accepted', handleCallAccepted);
      socket.on('peer:nego:needed', handleNegoNeedIncomming);
      socket.on('peer:nego:final', handleNegoNeedFinal);
      socket.on('peer:skip', terminate);

      return () => {
        socket.off('user:joined', handleCallUser);
        socket.off('incomming:call', handleIncommingCall);
        socket.off('call:accepted', handleCallAccepted);
        socket.off('peer:nego:needed', handleNegoNeedIncomming);
        socket.off('peer:nego:final', handleNegoNeedFinal);
        socket.off('peer:skip', terminate);
      };
    }
  }, [
    socket,
    handleCallUser,
    handleIncommingCall,
    handleCallAccepted,
    handleNegoNeedIncomming,
    handleNegoNeedFinal,
    terminate,
  ]);

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
          <button type="submit" onClick={sendStreams}>
            Send Streams
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoChat;
