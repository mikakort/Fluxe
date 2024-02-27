import React, { useEffect, useState } from 'react';
import './App.css';
import Header from './Header';
import io from 'socket.io-client';
import VideoChat from './VideoChat';

function Home() {
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [to, setTo] = useState(null);

  useEffect(() => {
    console.log('Setting up socket connection');
    const newSocket = io('http://192.168.2.106:3001');
    setSocket(newSocket);
    console.log(newSocket);

    newSocket.on('connect', () => {
      console.log('Successfully connected!');
    });

    newSocket.on('user:joined', (data) => {
      console.log('Successfully connected!');

      const roomId = data.room;
      const to = data.remote;

      setRoomId(roomId);
      setTo(to);
    });

    return () => {
      console.log('Closing socket connection');
      newSocket.close();
    };
  }, []);

  return (
    <div className="App">
      <Header />
      {/* <div className="main"> */}
      <VideoChat roomId={roomId} socket={socket} to={to} />
      {/* <Chatbox roomId={roomId} socket={socket} to={to} /> */}
      {/* </div> */}
    </div>
  );
}

export default Home;
