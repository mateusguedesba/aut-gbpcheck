# 🤖 Automação GBP Check - VNC Manual Login

Sistema de automação Playwright integrado com a extensão GBP Check Chrome, usando arquitetura VNC para login manual e persistência automática de sessão.

## 🎯 **Características Principais**

- ✅ **Login Manual via VNC**: Interface gráfica para autenticação segura
- ✅ **Persistência Automática**: Dados de login preservados entre reinicializações
- ✅ **Contexto Persistente**: Browser profile mantido no volume Docker
- ✅ **Extensão Integrada**: GBP Check Chrome Extension pré-carregada
- ✅ **API Simplificada**: Endpoints limpos sem parâmetros de login
- ✅ **VNC Sempre Visível**: Browser automaticamente visível quando necessário

## 🏗️ **Arquitetura**

```
┌─────────────────────┐    ┌─────────────────────┐
│   vnc-server        │    │  playwright-service │
│   (Ubuntu Desktop)  │◄──►│  (Node.js + Chrome) │
│   - Display :99     │    │  - DISPLAY=vnc:99   │
│   - VNC Server      │    │  - Playwright API   │
│   - noVNC Web       │    │  - GBP Extension    │
└─────────────────────┘    └─────────────────────┘
         ▲                           ▲
         │                           │
    http://localhost:6080       http://localhost:3001
```

## 🚀 **Início Rápido**

### **1. Iniciar Containers**
```bash
docker-compose up --build
```

### **2. Iniciar Browser VNC**
```bash
curl -X POST "http://localhost:3001/start-vnc-browser"
```

### **3. Login Manual**
1. Acesse: http://localhost:6080
2. Senha: `playwright123`
3. Clique na extensão GBP Check
4. Faça login manualmente
5. Dados automaticamente persistidos

### **4. Executar Automações**
```bash
curl -X POST "http://localhost:3001/automate" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.google.com/maps/search/restaurante+sao+paulo",
    "enable_vnc": true,
    "wait_time": 300
  }'
```

## 📡 **API Endpoints**

### **POST /start-vnc-browser**
Inicia browser VNC para login manual
```bash
curl -X POST "http://localhost:3001/start-vnc-browser"
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "vnc_url": "http://localhost:6080",
    "vnc_password": "playwright123",
    "extension_loaded": true,
    "instructions": ["..."]
  }
}
```

### **POST /automate**
Executa automação usando sessão existente
```bash
curl -X POST "http://localhost:3001/automate" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "wait_time": 300,
    "button_selectors": [],
    "completion_selectors": [],
    "headless": false,
    "enable_vnc": true
  }'
```

### **GET /test-login-persistence**
Testa persistência de dados de login
```bash
curl "http://localhost:3001/test-login-persistence?headless=false&enable_vnc=true"
```

### **GET /health**
Verifica status do serviço
```bash
curl "http://localhost:3001/health"
```

## 🔧 **Configuração**

### **Variáveis de Ambiente**
```bash
# docker-compose.yml ou .env
NODE_ENV=production
TZ=America/Sao_Paulo
HEADLESS=true
VNC_PASSWORD=playwright123
RESOLUTION=1280x720
```

### **Volumes Docker**
```yaml
volumes:
  - playwright_data:/app/data  # Dados persistentes do browser
```

### **Portas**
- **3001**: API Playwright
- **6080**: Interface VNC (noVNC)
- **5900**: VNC direto (opcional)

## 🧪 **Testes**

### **Script de Teste Automatizado**
```bash
node test-vnc-manual-login.js
```

### **Teste Manual**
1. `docker-compose up --build`
2. `curl -X POST http://localhost:3001/start-vnc-browser`
3. Acesse http://localhost:6080
4. Faça login na extensão
5. `curl -X POST http://localhost:3001/automate -d '{"url":"https://www.google.com/maps"}'`

## 📁 **Estrutura do Projeto**

```
aut-gbpcheck/
├── server.js                     # Servidor principal Playwright
├── docker-compose.yml            # Orquestração dos containers
├── Dockerfile.playwright         # Container Node.js + Playwright
├── chrome-extension/             # Extensão GBP Check (oficial)
│   ├── manifest.json
│   ├── background.js
│   ├── popup.js
│   └── code.js
├── VNC_MANUAL_LOGIN_GUIDE.md     # Guia detalhado
├── test-vnc-manual-login.js      # Script de teste
└── data/                         # Volume persistente
    ├── browser-data/             # Perfil do Chrome
    └── screenshots/              # Screenshots de debug
```

## 🔒 **Segurança e Limitações**

### **Vantagens do Login Manual**
- ✅ Evita detecção anti-bot do Google
- ✅ Suporta 2FA e verificações de segurança
- ✅ Controle total do usuário sobre autenticação
- ✅ Compatível com políticas de segurança corporativas

### **Considerações de Segurança**
- 🔐 VNC protegido por senha
- 🔐 Dados de login armazenados localmente
- 🔐 Sem credenciais em código ou logs
- 🔐 Contexto isolado por container

## 🚨 **Troubleshooting**

### **Browser não aparece no VNC**
```bash
# Verificar containers
docker-compose ps

# Verificar logs
docker-compose logs vnc-server
docker-compose logs playwright-service

# Testar conectividade
curl http://localhost:6080
```

### **Extensão não carregada**
```bash
# Verificar arquivos da extensão
ls chrome-extension/

# Testar carregamento
curl http://localhost:3001/test-login-persistence
```

### **Login não persiste**
```bash
# Verificar volume
docker volume inspect aut-gbpcheck_playwright_data

# Reiniciar containers
docker-compose restart
```

## 📚 **Documentação Adicional**

- [VNC_MANUAL_LOGIN_GUIDE.md](VNC_MANUAL_LOGIN_GUIDE.md) - Guia completo
- [LOGIN_PERSISTENCE_FIX.md](LOGIN_PERSISTENCE_FIX.md) - Detalhes técnicos
- [CLAUDE.md](CLAUDE.md) - Documentação do projeto

## 🤝 **Contribuição**

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📄 **Licença**

Este projeto está sob licença MIT. Veja o arquivo LICENSE para detalhes.

---

**🎯 Objetivo**: Automatizar verificações de Google Business Profile de forma confiável e segura, com login manual via VNC e persistência automática de sessão.
