# Guia de Deploy - KitRunner

Este guia explica como publicar o KitRunner em produção.

---

## Parte 1: Deploy em Servidor Proprio (VPS/Cloud)

### Requisitos do Servidor

- **Sistema Operacional**: Ubuntu 20.04+ ou Debian 11+
- **Node.js**: versão 20 ou superior
- **PostgreSQL**: versão 14 ou superior
- **RAM**: mínimo 1GB (recomendado 2GB)
- **Armazenamento**: mínimo 10GB

### 1. Preparar o Servidor

#### Atualizar o sistema
```bash
sudo apt update && sudo apt upgrade -y
```

#### Instalar Node.js 20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

#### Verificar instalação
```bash
node --version  # deve mostrar v20.x.x
npm --version
```

### 2. Instalar e Configurar PostgreSQL

#### Instalar PostgreSQL
```bash
sudo apt install -y postgresql postgresql-contrib
```

#### Criar banco de dados e usuário
```bash
sudo -u postgres psql
```

No console do PostgreSQL:
```sql
CREATE USER kitrunner WITH PASSWORD 'sua-senha-segura';
CREATE DATABASE kitrunner_db OWNER kitrunner;
GRANT ALL PRIVILEGES ON DATABASE kitrunner_db TO kitrunner;
\q
```

### 3. Clonar e Configurar o Projeto

#### Criar pasta do projeto
```bash
sudo mkdir -p /var/www/kitrunner
sudo chown $USER:$USER /var/www/kitrunner
cd /var/www/kitrunner
```

#### Copiar os arquivos do projeto
Você pode usar SCP, SFTP, ou Git para transferir os arquivos:

```bash
# Opção 1: Via Git (se tiver repositório)
git clone https://seu-repositorio.git .

# Opção 2: Via SCP (do seu computador)
scp -r ./sports-textil-main/* usuario@seu-servidor:/var/www/kitrunner/
```

#### Instalar dependências
```bash
cd /var/www/kitrunner
npm install
```

### 4. Configurar Variáveis de Ambiente

#### Criar arquivo .env
```bash
nano .env
```

Adicione as seguintes variáveis:
```env
# Banco de Dados
DATABASE_URL=postgresql://kitrunner:sua-senha-segura@localhost:5432/kitrunner_db

# Sessão (gere uma chave aleatória com: openssl rand -hex 32)
SESSION_SECRET=sua-chave-secreta-com-pelo-menos-32-caracteres

# Mercado Pago (credenciais de PRODUCAO)
MERCADOPAGO_ACCESS_TOKEN=APP_USR-seu-token-de-producao
MERCADOPAGO_PUBLIC_KEY=APP_USR-sua-public-key

# Ambiente
NODE_ENV=production
PORT=5000
```

Salve com `Ctrl+X`, `Y`, `Enter`.

### 5. Fazer o Build

```bash
npm run build
```

Isso vai gerar a pasta `dist/` com o código compilado.

### 6. Executar as Migrações do Banco

```bash
npm run db:push
```

### 7. Testar a Aplicação

```bash
node dist/index.js
```

Acesse `http://seu-ip:5000` para verificar se está funcionando.

### 8. Configurar PM2 (Gerenciador de Processos)

O PM2 mantém a aplicação rodando e reinicia automaticamente se cair.

#### Instalar PM2
```bash
sudo npm install -g pm2
```

#### Iniciar a aplicação com PM2
```bash
cd /var/www/kitrunner
pm2 start dist/index.js --name kitrunner
```

#### Configurar para iniciar no boot
```bash
pm2 startup
pm2 save
```

#### Comandos úteis do PM2
```bash
pm2 status          # Ver status
pm2 logs kitrunner  # Ver logs
pm2 restart kitrunner  # Reiniciar
pm2 stop kitrunner     # Parar
```

### 9. Configurar Nginx (Proxy Reverso)

O Nginx serve como proxy reverso e permite usar HTTPS.

#### Instalar Nginx
```bash
sudo apt install -y nginx
```

#### Criar configuração do site
```bash
sudo nano /etc/nginx/sites-available/kitrunner
```

Adicione:
```nginx
server {
    listen 80;
    server_name seu-dominio.com.br www.seu-dominio.com.br;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
```

#### Ativar o site
```bash
sudo ln -s /etc/nginx/sites-available/kitrunner /etc/nginx/sites-enabled/
sudo nginx -t  # Testar configuração
sudo systemctl restart nginx
```

### 10. Configurar HTTPS com Let's Encrypt

#### Instalar Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

#### Gerar certificado SSL
```bash
sudo certbot --nginx -d seu-dominio.com.br -d www.seu-dominio.com.br
```

Siga as instruções na tela. O Certbot configura automaticamente o Nginx para HTTPS.

#### Renovação automática
O Certbot configura renovação automática. Para testar:
```bash
sudo certbot renew --dry-run
```

### 11. Configurar Firewall

```bash
sudo ufw allow 22      # SSH
sudo ufw allow 80      # HTTP
sudo ufw allow 443     # HTTPS
sudo ufw enable
```

### 12. Configurar Webhook do Mercado Pago

No painel do Mercado Pago:
1. Acesse **Suas integrações** > **Webhooks**
2. Adicione a URL: `https://seu-dominio.com.br/api/payments/webhook`
3. Selecione eventos de **Pagamentos**

---

## Atualizando a Aplicação

Para atualizar o código em produção:

```bash
cd /var/www/kitrunner

# 1. Baixar novas alterações (se usar Git)
git pull origin main

# 2. Instalar novas dependências
npm install

# 3. Fazer novo build
npm run build

# 4. Reiniciar a aplicação
pm2 restart kitrunner
```

---

## Backup do Banco de Dados

### Criar backup
```bash
pg_dump -U kitrunner kitrunner_db > backup_$(date +%Y%m%d).sql
```

### Restaurar backup
```bash
psql -U kitrunner kitrunner_db < backup_20250127.sql
```

### Automatizar backup diário
```bash
crontab -e
```

Adicione:
```
0 3 * * * pg_dump -U kitrunner kitrunner_db > /var/backups/kitrunner_$(date +\%Y\%m\%d).sql
```

---

## Monitoramento

### Verificar logs da aplicação
```bash
pm2 logs kitrunner
```

### Verificar logs do Nginx
```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Verificar uso de recursos
```bash
htop
```

---

## Troubleshooting

### Aplicação não inicia
```bash
# Ver logs de erro
pm2 logs kitrunner --err

# Verificar se a porta está em uso
sudo lsof -i :5000
```

### Erro de conexão com banco
```bash
# Testar conexão
psql -U kitrunner -h localhost kitrunner_db

# Verificar status do PostgreSQL
sudo systemctl status postgresql
```

### Erro 502 Bad Gateway (Nginx)
```bash
# Verificar se a aplicação está rodando
pm2 status

# Reiniciar aplicação
pm2 restart kitrunner
```

### Certificado SSL expirado
```bash
sudo certbot renew
sudo systemctl restart nginx
```

---

## Parte 2: Deploy no Replit

### Passo a Passo

1. Clique no botão **Publish** no canto superior direito
2. Selecione **Autoscale** para aplicações web
3. Configure recursos (0.5 vCPU, 512 MB RAM recomendado)
4. Clique em **Publish**

### Variáveis de Ambiente no Replit

Configure na aba **Secrets**:
- `DATABASE_URL`
- `SESSION_SECRET`
- `MERCADOPAGO_ACCESS_TOKEN`
- `NODE_ENV=production`

---

**Dúvidas?** Entre em contato:
- WhatsApp: (83) 98130-2961
- Instagram: @kitrunner_
