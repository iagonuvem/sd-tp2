const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send(`Servidor na porta ${PORT} está funcionando!`);
    io.emit('message', `Mensagem do servidor na porta ${PORT}: Rota GET acessada.`);
});

io.on('connection', (socket) => {
    console.log('Um dispositivo conectado');

    // Enviar uma mensagem para todos os outros dispositivos
    socket.broadcast.emit('message', `Dispositivo na porta ${PORT} conectado`);

    // Manipulador para mensagens recebidas
    socket.on('message', (msg) => {
        console.log(`Mensagem recebida na porta ${PORT}: ${msg}`);
    });

    socket.on('disconnect', () => {
        console.log('Um dispositivo desconectado');
        // Notificar os outros dispositivos que um dispositivo foi desconectado
        socket.broadcast.emit('message', `Dispositivo na porta ${PORT} desconectado`);
    });

    // Adicionar mais manipuladores de eventos conforme necessário
});

server.listen(PORT, () => {
    console.log(`Dispositivo executando na porta ${PORT}`);
});
