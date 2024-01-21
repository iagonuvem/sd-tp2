const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

io.on('connection', (socket) => {
  console.log('Um dispositivo conectado');

  socket.on('disconnect', () => {
    console.log('Um dispositivo desconectado');
  });

  // Aqui você pode adicionar mais manipuladores de eventos para comunicação
});

server.listen(PORT, () => {
  console.log(`Dispositivo executando na porta ${PORT}`);
});
