const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const ioClient = require("socket.io-client");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
      origin: "*", 
      methods: ["GET", "POST"]
    }
  });

const PORT = process.env.PORT || 3000;

const enderecos = [
    'http://localhost:3001', 
    'http://localhost:3002', 
    'http://localhost:3003', 
    'http://localhost:3004'
]; // Usado para realizar a conexão com outras máquinas

const dispositivos = new Map(); // Armazena IDs dos dispositivos conectados como chaves
let coordenador = null; // ID do coordenador

// Conectar a outros dispositivos
enderecos.forEach((endereco) => {
    if (endereco !== `http://localhost:${PORT}`) { // Não conectar a si mesmo
        const socket = ioClient(endereco);
        socket.on("connect", () => {
            console.log(`Conectado ao dispositivo em ${endereco}`);
            // Você pode emitir eventos aqui se necessário
        });

        // Adicionar manipuladores de eventos, como para ouvir por mensagens
        socket.on('message', (msg) => {
            console.log(`Mensagem recebida de ${endereco}: ${JSON.stringify(msg)}`);
        });

        // Guardar o socket do cliente para uso posterior
        dispositivos.set(endereco, socket);
    }
});

app.get('/', (req, res) => {
    res.send(`Servidor na porta ${PORT} está funcionando!`);
    io.emit('message', `Mensagem do servidor na porta ${PORT}: Rota GET acessada.`);
});

io.on('connection', (socket) => {
    dispositivos.set(socket.id, socket);
    console.log(`Dispositivo ${socket.id} conectado. Total de dispositivos: ${dispositivos.size}`);

    // Eleger um novo coordenador se necessário
    if (!coordenador || !dispositivos.has(coordenador)) {
        elegerCoordenador();
    }

    // Enviar uma mensagem para todos os outros dispositivos
    socket.broadcast.emit('message', `Dispositivo na porta ${PORT} conectado`);

    // Manipulador para mensagens recebidas
    socket.on('message', (msg) => {
        console.log(`Mensagem recebida na porta ${PORT}: ${JSON.stringify(msg)}`);
    });

    socket.on('disconnect', () => {
        console.log('Um dispositivo desconectado');
        // Notificar os outros dispositivos que um dispositivo foi desconectado
        socket.broadcast.emit('message', `Dispositivo na porta ${PORT} desconectado`);
        // Remover da lista de dispositivos
        dispositivos.delete(socket.id);
        
        // Verificar necessidade de nova eleição
        if (socket.id === coordenador) {
            elegerCoordenador();
        }
    });

    socket.on('request_access', () => {
        console.log(`Dispositivo ${socket.id} solicitou acesso`);
        // Adicione à fila e gerencie a concessão de acesso aqui
    });

    socket.on('initiate_election', () => {
        console.log(`Iniciando eleição pelo dispositivo ${socket.id}`);
        // Implemente a lógica de eleição aqui
    });
});

function elegerCoordenador() {
    const dispositivosIds = [...dispositivos.keys()];
    const index = Math.floor(Math.random() * dispositivosIds.length);
    coordenador = dispositivosIds[index];
    console.log(`Novo coordenador eleito: ${coordenador}`);
    // Notificar todos os dispositivos sobre o novo coordenador
    io.emit('new_coordinator', coordenador);
}

server.listen(PORT, () => {
    console.log(`Dispositivo executando na porta ${PORT}`);
});
