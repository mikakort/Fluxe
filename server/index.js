const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv').config();
const cors = require('cors');

const app = express();

app.use(express.json());
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

mongoose.connect(process.env.DB);

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
  console.log('Successfully connected to the database');
});

const userSchema = new mongoose.Schema({
  id: String,
  socketId: String,
});

const User = mongoose.model('User', userSchema);

const roomSchema = new mongoose.Schema({
  id: String,
  users: [userSchema],
  chatLog: [{ message: String, timestamp: Date }],
});

const Room = mongoose.model('Room', roomSchema);

let usersQueue = [];

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  const user = new User({ id: uuidv4(), socketId: socket.id });
  // implement start here
  usersQueue.push(user);

  if (usersQueue.length >= 2) {
    const room = new Room({
      id: uuidv4(),
      users: [usersQueue.shift(), usersQueue.shift()],
      chatLog: [],
    });
    room.save().then(() => {
      io.to(room.users[0].socketId).emit('user:joined', {
        room: room.id,
        remote: room.users[1].socketId,
        peerServer: 'A', // fixing double call problem
      });
      io.to(room.users[1].socketId).emit('user:joined', {
        room: room.id,
        remote: room.users[0].socketId,
        peerServer: 'B', // fixing double call problem
      });
    });
    console.log(room.id);
    console.log(room.users[0].socketId + ' A');
    console.log(room.users[1].socketId + ' B');
  }

  socket.on('messagetoserver', async (roomId, message, to) => {
    console.log(message);

    const room = await Room.findOne({ id: roomId });
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }

    io.to(to).emit('message', { text: message });

    room.chatLog.push({ message: message, timestamp: new Date() });
    await room.save();
  });

  socket.on('user:call', async ({ roomId, offer }) => {
    const room = await Room.findOne({ id: roomId });
    if (room.users[0].socketId) {
      const to = room.users[1].socketId;
      console.log('calling ' + to);
      io.to(to).emit('incomming:call', { from: socket.id, offer });
    }
  });

  socket.on('call:accepted', ({ to, ans }) => {
    io.to(to).emit('call:accepted', { from: socket.id, ans });
  });

  socket.on('peer:nego:needed', ({ to, offer }) => {
    console.log('peer:nego:needed', offer);
    io.to(to).emit('peer:nego:needed', { from: socket.id, offer });
  });

  socket.on('peer:nego:done', ({ to, ans }) => {
    console.log('peer:nego:done', ans);
    io.to(to).emit('peer:nego:final', { from: socket.id, ans });
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    // Find the room the user was in
    const room = await Room.findOne({ 'users.socketId': socket.id });
    if (!room) return;

    // Remove the user from the room
    room.users = room.users.filter((user) => user.socketId !== socket.id);
    await room.save();

    // If there's a remaining user, add them back to the queue
    if (room.users.length > 0) {
      usersQueue.push(room.users[0]);
      io.to(room.users[0].socketId).emit(
        'message',
        'Your chat partner has disconnected. You will be reconnected with a new partner soon.'
      );
    }
  });
});

server.listen(3001, () => console.log('Server started on port 3001'));
