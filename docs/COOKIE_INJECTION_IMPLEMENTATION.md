# Cookie Injection Implementation - GBP Check Auto Login

## Overview
Implementação de injeção automática de cookies para login automático no site app.gbpcheck.com. Os cookies são injetados sempre que uma nova sessão do navegador é iniciada, garantindo que o usuário já esteja autenticado.

## ⚠️ IMPORTANTE - Correções Aplicadas

### Problema Identificado
O login automático não estava funcionando e a página estava sendo redirecionada para `/login`.

### Soluções Implementadas

1. **Mudança de SameSite para "Lax"**
   - Alterado de `"None"` para `"Lax"` em todos os cookies
   - `sameSite: "None"` requer `secure: true`, mas o site usa HTTP em alguns casos

2. **Verificação de Cookies Injetados**
   - Adicionada verificação após injeção para confirmar que os cookies foram aceitos
   - Logs detalhados mostram quantos cookies foram realmente adicionados

3. **Re-injeção Antes da Navegação**
   - Cookies são re-injetados especificamente antes de navegar para URLs do GBP Check
   - Garante que os cookies estejam presentes no momento da navegação

4. **Navegação em Duas Etapas**
   - Primeiro navega para `https://app.gbpcheck.com` (domínio base)
   - Depois navega para a URL específica (ex: `/extension/healthcheck`)
   - Isso estabelece a sessão corretamente

5. **Detecção e Recuperação de Redirecionamento**
   - Detecta se foi redirecionado para `/login`
   - Re-injeta cookies automaticamente
   - Recarrega a página original
   - Tenta recuperar a autenticação automaticamente

## Cookies Injetados

### 1. Crisp Chat Session Cookies
- **crisp-client%2Fsession%2F8b563f5e-41d9-4585-82c6-9d0e6f5fcaa7**
  - Domain: `.gbpcheck.com`
  - Expires: 1775266829 (2026-02-01)
  - Purpose: Sessão do chat Crisp

- **crisp-client%2Fsession%2F8b563f5e-41d9-4585-82c6-9d0e6f5fcaa7%2F15fdf7da5ac76f57ed3755be79111a4d45c20a4ca100e0f60dc6738f076633c0**
  - Domain: `.gbpcheck.com`
  - Expires: 1775266829 (2026-02-01)
  - Purpose: Sessão estendida do chat Crisp

### 2. Authentication Cookie
- **remember_token**
  - Domain: `app.gbpcheck.com`
  - Expires: 1790001219 (2026-09-15)
  - HttpOnly: true
  - Purpose: Token de autenticação "Remember Me"
  - Value: `111824614471070379269|33c15e0dd1686a8caaf747f9b9a0d365f75b85f2dc1e6e9e140ba56db401b17c4de6bf61bbe7ca8ebf77df5c1e7ecee2e17c66f4a0c1ac68b930a2bd33107d48`

### 3. Crisp Socket Cookie
- **crisp-client%2Fsocket%2F8b563f5e-41d9-4585-82c6-9d0e6f5fcaa7**
  - Domain: `app.gbpcheck.com`
  - Expires: 1759671629 (2025-10-05)
  - SameSite: Lax
  - Purpose: Conexão WebSocket do Crisp

### 4. Session Cookie
- **session**
  - Domain: `app.gbpcheck.com`
  - Session: true (expires quando o navegador fecha)
  - HttpOnly: true
  - Purpose: Sessão ativa do usuário
  - Value: Token JWT longo com dados da sessão

## Implementation Details

### Método `injectGBPCheckCookies(context)`
**Location:** `server.js` - Lines 241-332

```javascript
async injectGBPCheckCookies(context) {
  try {
    logger.info('🍪 Injetando cookies do GBP Check para login automático...');

    const gbpCheckCookies = [
      // Array com todos os cookies configurados
    ];

    // Adicionar cookies ao contexto
    await context.addCookies(gbpCheckCookies);

    logger.info('✅ Cookies do GBP Check injetados com sucesso', {
      cookieCount: gbpCheckCookies.length,
      domains: ['app.gbpcheck.com', '.gbpcheck.com']
    });

    return true;
  } catch (error) {
    logger.error('❌ Erro ao injetar cookies do GBP Check:', {
      error: error.message,
      stack: error.stack
    });
    return false;
  }
}
```

### Integration Points

#### 1. CDP Connection (Conexão a instância existente)
**Location:** `server.js` - Lines 457-461

```javascript
// Injetar cookies do GBP Check antes de criar a página
logger.info('🍪 Injetando cookies do GBP Check...');
await this.injectGBPCheckCookies(this.context);
logger.info('✅ Cookies injetados');
```

#### 2. Persistent Context (Contexto persistente)
**Location:** `server.js` - Lines 610-614

```javascript
// Injetar cookies do GBP Check no contexto persistente
logger.info('🍪 Injetando cookies do GBP Check...');
await this.injectGBPCheckCookies(this.context);
logger.info('✅ Cookies injetados');
```

## Workflow

### Sequência de Inicialização

1. **Browser Setup Iniciado**
   - `setupBrowser()` é chamado

2. **Contexto Criado**
   - CDP Connection OU Persistent Context é estabelecido

3. **Cookies Injetados** ⭐
   - `injectGBPCheckCookies(context)` é chamado
   - Todos os 5 cookies são adicionados ao contexto
   - Verificação confirma que cookies foram aceitos
   - Logs confirmam injeção bem-sucedida

4. **Página Criada**
   - Nova página é criada com cookies já presentes

5. **Navegação para GBP Check** 🔐
   - Detecta que é URL do GBP Check
   - **Re-injeta cookies** antes da navegação
   - **Navega primeiro para domínio base** (`https://app.gbpcheck.com`)
   - Aguarda estabelecimento da sessão
   - **Navega para URL específica** (ex: `/extension/healthcheck`)

6. **Verificação Pós-Navegação** 🔍
   - Verifica se foi redirecionado para `/login`
   - Se sim:
     - Re-injeta cookies novamente
     - Aguarda propagação
     - Recarrega a página original
     - Verifica se autenticação foi bem-sucedida

7. **Resultado Final** ✅
   - Usuário autenticado automaticamente
   - Sem necessidade de login manual

## Cookie Format

Os cookies seguem o formato Playwright:

```javascript
{
  name: "cookie_name",
  value: "cookie_value",
  domain: "app.gbpcheck.com",
  path: "/",
  expires: 1790001219,  // Unix timestamp, -1 para session cookie
  httpOnly: true,       // Se o cookie é httpOnly
  secure: false,        // Se requer HTTPS
  sameSite: "None"      // "Strict", "Lax", ou "None"
}
```

## Security Considerations

### HttpOnly Cookies
- `remember_token` e `session` são HttpOnly
- Não podem ser acessados via JavaScript
- Proteção contra XSS

### Domain Scope
- `.gbpcheck.com` - Cookies disponíveis em todos os subdomínios
- `app.gbpcheck.com` - Cookies específicos do app

### Expiration
- Cookies de longa duração (2026) para autenticação persistente
- Session cookie expira quando o navegador fecha

## Logging

### Success Logs - Fluxo Completo
```
🍪 Injetando cookies do GBP Check para login automático...
✅ Cookies do GBP Check injetados com sucesso
   - cookieCount: 5
   - domains: ['app.gbpcheck.com', '.gbpcheck.com']
🔍 Verificação de cookies injetados:
   - totalCookies: 5
   - gbpCheckCookies: 5
   - cookieNames: ['crisp-client%2Fsession%2F...', 'remember_token', 'session', ...]

🔍 URL do GBP Check detectada - verificando cookies antes da navegação...
✅ Cookies re-injetados antes da navegação para GBP Check

🔐 Navegando primeiro para domínio base do GBP Check para estabelecer sessão...
✅ Domínio base carregado - cookies estabelecidos

✅ Navegação concluída - URL atual: https://app.gbpcheck.com/extension/healthcheck
```

### Logs de Recuperação (se redirecionado para login)
```
⚠️ Redirecionado para página de login - tentando re-autenticar...
🔄 Cookies re-injetados, recarregando página...
🔄 Página recarregada - URL atual: https://app.gbpcheck.com/extension/healthcheck
✅ Re-autenticação bem-sucedida!
```

### Error Logs
```
❌ Erro ao injetar cookies do GBP Check:
   - error: [error message]
   - stack: [stack trace]

❌ Ainda redirecionado para login após re-injeção de cookies
```

## Testing

### Manual Test
1. Inicie o servidor: `npm start`
2. Faça uma requisição POST para `/automate` com URL do GBP Check
3. Observe os logs para confirmar injeção de cookies
4. Verifique se o navegador já está autenticado ao acessar app.gbpcheck.com

### Verification
```bash
# Verificar logs do servidor
tail -f data/app.log | grep "cookie"
```

## Troubleshooting

### Cookies não funcionando
1. **Verificar domínio**: Certifique-se de que está navegando para `app.gbpcheck.com`
2. **Verificar expiração**: Cookies podem ter expirado
3. **Verificar logs**: Procure por erros na injeção
4. **Limpar contexto**: Delete `data/edge-profile` e reinicie

### Session expirada
- O cookie `session` é session-based e expira quando o navegador fecha
- O `remember_token` deve manter a autenticação entre sessões
- Se ambos expirarem, será necessário atualizar os cookies

## Cookie Update Process

Para atualizar os cookies quando expirarem:

1. Faça login manual no app.gbpcheck.com
2. Exporte os cookies usando extensão do navegador
3. Atualize o array `gbpCheckCookies` no método `injectGBPCheckCookies`
4. Reinicie o servidor

### Ferramentas Recomendadas
- **EditThisCookie** (Chrome Extension)
- **Cookie-Editor** (Firefox/Chrome Extension)
- **Browser DevTools** → Application → Cookies

## Benefits

✅ **Login Automático**: Usuário já autenticado ao iniciar
✅ **Sem Interação Manual**: Não precisa fazer login a cada execução
✅ **Persistência**: Cookies mantidos entre execuções
✅ **Compatibilidade**: Funciona com CDP e Persistent Context
✅ **Logging Completo**: Fácil debug e monitoramento

## Notes

- Os cookies são injetados **antes** da criação da página
- Funciona tanto em modo headless quanto visível
- Compatível com o sistema de fila de automação
- Não interfere com outras funcionalidades existentes

