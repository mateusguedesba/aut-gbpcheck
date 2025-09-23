# Migração para Selkies WebRTC

## Comparação: VNC vs Selkies

| Aspecto | VNC (Atual) | Selkies (Novo) |
|---------|-------------|----------------|
| **Protocolo** | VNC + noVNC | WebRTC nativo |
| **Performance** | ~30fps, alta latência | 60fps, baixa latência |
| **Qualidade** | Compressão lossy | Hardware-accelerated |
| **Browser** | Compatibilidade limitada | WebRTC moderno |
| **GPU** | Software rendering | Hardware acceleration |
| **Firewall** | Portas específicas | WebRTC + TURN |

## Como usar Selkies

### 1. Build e Start
```bash
docker-compose -f docker-compose.selkies.yml up --build -d
```

### 2. Acesso WebRTC
- **URL**: `http://localhost:8081`
- **Credentials**: Sem autenticação (desabilitada)
- **API Playwright**: `http://localhost:3002`

### 3. Requisitos
- **GPU NVIDIA**: Recomendado (Maxwell+)
- **NVIDIA Container Toolkit**: Necessário
- **Driver NVIDIA**: 450.80.02+

### 4. Fallback (sem GPU)
Para servidores sem GPU NVIDIA, use:
```bash
# docker-compose.yml original (VNC)
docker-compose up --build -d
```

## Vantagens do Selkies

✅ **Performance**: 60fps vs 30fps VNC
✅ **Latência**: WebRTC nativo
✅ **Qualidade**: Hardware-accelerated encoding
✅ **Moderno**: Tecnologia 2025
✅ **Escalável**: Cloud-native

## Configuração Dual

Mantenha ambos os arquivos:
- `docker-compose.yml` - VNC (fallback)
- `docker-compose.selkies.yml` - Selkies (principal)

Escolha baseado na infraestrutura disponível.

## Comparação de Portas

**VNC Container (atual):**
- `80` → API Playwright
- `6080` → noVNC Web Interface
- `5901` → VNC Direct

**Selkies Container (novo):**
- `3002` → API Playwright
- `8081` → WebRTC Interface

✅ **Sem conflitos** - Ambos podem rodar simultaneamente!