import React, { useState, useEffect } from 'react';

function Chatbox({ roomId, socket, to }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

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
  );
}

export default Chatbox;
