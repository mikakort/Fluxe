import React, { useEffect, useState } from 'react';
import './App.css';
import Header from './Header';
import io from 'socket.io-client';
import VideoChat from './VideoChat';

function Home() {
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [to, setTo] = useState(null);
  const [begin, setBegin] = useState(false);

  useEffect(() => {
    if (begin) {
      console.log('Setting up socket connection');
      const newSocket = io('localhost:3001');
      setSocket(newSocket);
      console.log(newSocket);

      newSocket.on('connect', () => {
        console.log('Successfully connected!');
      });

      newSocket.on('user:joined', (data) => {
        console.log('user:joined');

        const roomId = data.room;
        const to = data.remote;

        setRoomId(roomId);
        setTo(to);
      });

      return () => {
        console.log('Closing socket connection');
        newSocket.close();
      };
    }
  }, [begin]);

  return (
    <div className="App">
      <Header />
      <VideoChat
        roomId={roomId}
        socket={socket}
        to={to}
        setBegin={setBegin}
        setSocket={setSocket}
        setRoomId={setRoomId}
        setTo={setTo}
      />
    </div>
  );
}

export default Home;
