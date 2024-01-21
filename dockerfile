FROM ubuntu

# Instalar Node.js
RUN apt-get update && apt-get install -y nodejs npm

# Copiar arquivos do projeto
WORKDIR /app
COPY . /app

# Instalar dependências do Node.js
RUN npm install

# Expor a porta (assumindo que usaremos a porta 3000)
EXPOSE 3000

# Comando para iniciar o aplicativo
CMD ["node", "index.js"]
