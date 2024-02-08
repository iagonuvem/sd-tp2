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
const HOSTNAME = process.env.HOSTNAME || `http://localhost:${PORT}`;
const COORDINATOR = process.env.COORDINATOR || false;

let maquinas = [
    'http://dispositivo1:3001', 
    'http://dispositivo2:3002', 
    'http://dispositivo3:3003', 
    'http://dispositivo4:3004'
]; // Usado para realizar a conexão com outras máquinas

let conexoes = new Map(); // Armazena IDs das conexoes conectados como chaves
let hosts = new Map();
let acks = new Map();

hosts.set(`${HOSTNAME}:${PORT}`, {
    coordinator: COORDINATOR,
    timestamp: new Date().getTime()
})

// acks.set('election', null);
// acks.set('coordinator', null);
// acks.set('file', null);
acks.set('hosts', hosts);

if(COORDINATOR === 'true') acks.set('coordinator', `${HOSTNAME}:${PORT}`);

// CLIENTE
setTimeout(() => { // Para dar tempo das maquinas subirem
    // Conectar a outros dispositivos
    maquinas.forEach((maquina) => {
        let type = 'CLIENT';
        if (maquina !== `http://${HOSTNAME}:${PORT}`) { // Não conectar a si mesmo
            console.log(`CLIENT: CONECTANDO: ${HOSTNAME} -> ${maquina}`);
            
            try {
                const now = new Date();
                const socket = ioClient(maquina, {
                    extraHeaders: {
                        "client": HOSTNAME,
                        "client_port": PORT
                    }
                });

                // TO-DO: REFATORAR
                // socket.on("connect_error", (err) => {
                //     console.log(`${type}: ERRO DE CONEXAO ${err.message}`);
                //     // console.log(`${type}: Socket`, socket);
                //     console.log(`${type}: Endereco`, socket._opts.hostname);
                //     console.log(conexoes.keys());
                // })

                socket.on("connect", () => {
                    console.log(`${type}: CONEXÃO ESTABELECIDA! ${HOSTNAME} -> ${maquina}`)
                    
                    // Guardar o socket do cliente para uso posterior
                    conexoes.set(`${HOSTNAME}_${type}`, {...socket,
                        client: HOSTNAME,
                        host: maquina,
                        timestamp: now.getTime()
                    });

                    acks.set('hosts', [...hosts.entries()]);

                    socket.emit('acks', [...acks.entries()], (newValues) => {
                        setAcks(newValues, 'CLIENT');
                    });
                });

                // TO-DO: REFACTOR parte do keyval
                socket.on('acks_client', (keyval) => {
                    // console.log(`${type}: ACKNOWLEDGE!`);
                    // console.log(`${type} Keyval: `, JSON.stringify(keyval));

                    socket.emit('acks', keyval, (newValues) => {
                        // console.log(`${type}: NewValues `, newValues);
                        setAcks(newValues, 'CLIENT');
                    });
                })

                // TO-DO: Atualizar coordenador dentro de 'hosts'
                socket.on('new_coordinator', (keyval) => {
                    // console.log(`${type} new_coordinator Keyval: `, JSON.stringify(keyval));

                    const acks = new Map(keyval);
                    const hosts = new Map(acks.get('hosts'));

                    // console.log(`${type}: new_coordinator ACK.hosts:`, hosts);
                    console.log(`${type}: Habemus Coordenador! `, JSON.stringify(acks.get('coordinator')));

                    acks.delete('election');
                    acks.set('hosts', [...hosts.entries()]);
                    acks.set('coordinator', acks.get('coordinator'));

                    socket.emit('acks', [...acks.entries()], (newValues) => {
                        setAcks(newValues, 'CLIENT');
                    });
                })

                socket.on('disconnect', () => {
                    const server = `${socket._opts.hostname}:${socket._opts.port}`;
                    console.log(`${type}: CONEXÃO ENCERRADA! ${HOSTNAME} -> ${server}`);

                    const coordinator = acks.get('coordinator');
                    if(server === coordinator) {
                        console.log(`${type}: O COORDENADOR CAIU!`);
                        // acks.delete('coordinator');
                    };

                    conexoes.delete(`${HOSTNAME}_${type}`);

                    const hosts = new Map(acks.get('hosts'));
                    hosts.delete(server);

                    acks.set('hosts', [...hosts.entries()]);
                    socket.emit('acks', [...acks.entries()], (newValues) => {setAcks(newValues, 'CLIENT')});                   
                });

            } catch (error) {
                console.log(`${type}: `, error.type);
                // console.log(error);
            }
        }
    });
    
}, 5000);

app.get('/', (req, res) => {
    res.send(`Servidor na porta ${PORT} está funcionando!`);
    io.emit('message', `Mensagem do servidor na porta ${PORT}: Rota GET acessada.`);
});

// SERVIDOR
io.on('connection', (socket) => {
    const type = 'SERVER';
    const now = new Date();
    const headers = socket.handshake.headers;
    // console.log(`${type}: Custom Headers:`, headers);

    // console.log('QUANTIDADE DE HOSTS:', hosts.size);
    conexoes.set(`${headers.client}_${type}`, {...socket, timestamp: now.getTime()});
    
    console.log(`${type}: Conexoes: `, JSON.stringify([...conexoes.keys()]));
    // console.log(`${type}: Total de conexões: ${conexoes.size}`);

    // Eleger um novo coordenador se necessário
    // if (!acks.get('coordinator')) {
    //     elegerCoordenador(socket);
    // }

    socket.on('disconnect', () => {
        console.log(`${type}: CONEXÃO ENCERRADA! ${headers.host} -> ${headers.client}:${headers.client_port}`);
        const coordenador = acks.get('coordinator');
        // console.log(`${type}: Conexoes:`, conexoes.keys());
        

        const hosts = new Map(acks.get('hosts'));
        // conexoes.delete(`${headers.client}_${type}`);
        // hosts.delete(`${headers.client}:${headers.client_port}`);
        // console.log(`${type}: Disconnect`, hosts);

        acks.set('hosts', [...hosts.entries()]);
        socket.broadcast.emit('acks_client', [...acks.entries()]);

        // Verificar se o coordenador caiu pra chamar eleição
        if (`${headers.client}:${headers.client_port}` === coordenador) {
            iniciarEleicao(socket);
        }
    });

    socket.on('acks', (keyval, callback) => {
        // console.log(`${type}: ACKNOWLEDGE!`);
        
        const acks = setAcks(keyval, 'SERVER');
        callback(acks);        
    });

    socket.on('ack_coordinator', (coordinator) => {
        console.log(`${type}: Habemus Coordenador: ${JSON.parse(coordinator)}`);
        // Implemente a lógica de eleição aqui
    });

    socket.on('request_access', () => {
        console.log(`${type}: Dispositivo ${socket.id} solicitou acesso`);
        // Adicione à fila e gerencie a concessão de acesso aqui
    });
});

io.engine.on("connection_error", (err) => {
    console.log(err.req);      // the request object
    console.log(err.code);     // the error code, for example 1
    console.log(err.message);  // the error message, for example "Session ID unknown"
    console.log(err.context);  // some additional error context
});

function iniciarEleicao(socket){
    const now = new Date();
    if(!acks.has('election')){ // Avisa todos que vai começar eleição
        console.log('INICIANDO ELEIÇÃO...');
        const election = { 
            started_by: socket.handshake.headers.host, 
            started_at: now.getTime()
        };
        acks.delete('coordinator');
        acks.set('election', election);
        socket.broadcast.emit('acks_client', [...acks.entries()]);

        const hosts = new Map(acks.get('hosts'));
        let winner;
        
        console.log('INICIAR ELEICAO HOSTS:', hosts);
        hosts.forEach((hostData, hostName) => { // Percorre vizinho por vizinho para comparar o timestamp
            winner = percorreAnel(hostName, [...hosts.entries()]);
        })

        console.log('WINNER:' , winner);
        acks.set('coordinator', winner);

        hosts.forEach((hostData, hostName) => { // Percorre vizinho por vizinho para comparar o timestamp
            if(hostName == winner){
                hostData.coordinator = true;
            }
            hostData.coordinator = false;

            hosts.set(hostName, hostData);
        })
        acks.set('hosts', [...hosts.entries()]);

        setTimeout(() => {
            socket.broadcast.emit('new_coordinator', [...acks.entries()]);
        }, 500);
    }
}

function setAcks(keyval, type) {
    const parsed = JSON.parse(JSON.stringify(keyval));
    // console.log(`${type} setAcks:`, parsed);
    const map = parsed.map((p) => {
        switch (p[0]) {
            case 'election':
                const parsedElection = JSON.parse(JSON.stringify(p[1]));
                // const cached = JSON.parse(JSON.stringify(acks.get('election')));

                // if((cached && cached.started_at) > parsedElection.started_at){
                //     acks.set('election', parsedElection);
                // }
                acks.set('election', parsedElection);
                break;
            case 'hosts':
                console.log(`${type} rawValue:`, p[1]);
                const parsedHosts = new Map(p[1]);
                parsedHosts.forEach((hostData, hostName) => {
                    // console.log('hostName', hostName);
                    // console.log('hostData', hostData);
                    if (hostData.coordinator == 'true') {
                        console.log(`${type}: ${hostName} é coordenador!`);
                        acks.set('coordinator', hostName);
                    };
                    hosts.set(hostName, hostData);
                })
                // console.log(`${type} Hosts: `, parsedHosts);
                // console.log(`${type} Hosts Entries: `, [...parsedHosts.entries()]);
                acks.set('hosts', parsedHosts);
                break;
            default:
                break;
        }
        return p;
    });

    return map;
}

function percorreAnel(host, hosts) {
    const newHosts = new Map(hosts);

    if(!newHosts.has(host)){
        return;
    }

    const hostData = JSON.parse(JSON.stringify(newHosts.get(host)));
    let greater = hostData.timestamp;
    let winner = host;

    newHosts.forEach((hostData, hostName) => { // Percorre vizinho por vizinho para comparar o timestamp
        const data = JSON.parse(JSON.stringify(hostData));
        if (data.timestamp < greater) {
            greater = data.timestamp;
            winner = hostName;
            // acks.set('winner', h[0]);
        }
    })

    return winner;
}

server.listen(PORT, () => {
    console.log(`Dispositivo executando na porta ${PORT}`);
    console.log(`é Coordenador: ${COORDINATOR}\n`);
});
