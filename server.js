const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');
const path = require('path');
const fs = require('fs');
const StealthManager = require('./stealth');


const app = express();

// Criar diretório de screenshots
const screenshotsDir = path.join(__dirname, 'data', 'screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Configurar logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(__dirname, 'data', 'app.log') })
  ]
});

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Servir arquivos estáticos (screenshots)
app.use('/screenshots', express.static(screenshotsDir));

// GBP Check specific configuration
const GBP_CONFIG = {
  SELECTORS: {
    START_BUTTONS: [
      '.start-main-check-btn',
      'button.start-main-check-btn',
      '.main-btn.start-main-check-btn',
      'button.main-btn.start-main-check-btn',
      'button:has-text("Pré Análise")',
      'button:has-text("Pre Análise")',
      'button:has-text("Start Check")',
      'button:has-text("Iniciar")',
      'button[type="submit"]',
      'input[type="submit"]',
      '.btn',
      'button'
    ],
    MAPS_TO_SEARCH_BUTTON: [
      'a.main-btn[href*="local.google.com/place"]:has-text("Ver na Pesquisa")',
      'a.main-btn[href*="google.com"][target="_blank"]:has-text("Ver na Pesquisa")',
      'a[href*="local.google.com/place"]',
      'a:has-text("Ver na Pesquisa")',
      '.main-btn:has-text("Ver na Pesquisa")'
    ],
    GBP_REVIEWS_BUTTON: [
      // Seletores mais específicos para links clicáveis de avaliações
      '[aria-label="Resultados em destaque"] a[href*="search"][href*="tbm=lcl"]',
      '[aria-label="Resultados em destaque"] a[href*="search"]',
      '[aria-label="Resultados em destaque"] .CYJS5e a[href]',
      'a.pPgDke.WWVCY[href*="search"]',
      '.CYJS5e a[href*="search"]',

      // Seletores específicos para quando vem do Maps
      '[aria-label="Resultados em destaque"] a[href*="maps.google.com"]',
      '[aria-label="Resultados em destaque"] a[href*="place"]',
      '.CYJS5e a[href*="maps.google.com"]',
      '.CYJS5e a[href*="place"]',

      // Fallbacks com verificação de href
      'a[href*="search"][href*="tbm=lcl"]',
      'a[href*="search"]:has(.bmh4p)',
      'a[href*="search"]',
      'a[href*="maps.google.com"]',
      'a[href*="place"]'
    ],


  },
  URL_PATTERNS: {
    GOOGLE_MAPS: [
      /maps\.app\.goo\.gl/i,
      /maps\.google\.com/i,
      /www\.google\.com\/maps/i,
      /google\.com\/maps/i,
      /maps\.app\.goo\.gl\/.*\?g_st=ipc/i
    ],
    GOOGLE_SEARCH: [
      /www\.google\.com\/search/i,
      /google\.com\/search/i,
      /local\.google\.com\/place/i
    ],
    COMPLETION_PRIMARY: /app\.gbpcheck\.com\/extension\/healthcheck/i,
    COMPLETION_SECONDARY: [
      /app\.gbpcheck\.com\/.*\/complete/i,
      /app\.gbpcheck\.com\/.*\/result/i,
      /app\.gbpcheck\.com\/.*\/finished/i,
      /app\.gbpcheck\.com\/.*\/done/i,
      /app\.gbpcheck\.com\/.*\/success/i
    ],
    COMPLETION_GENERIC: [
      /\/complete$/i,
      /\/result$/i,
      /\/finished$/i,
      /\/done$/i,
      /\/success$/i,
      /\/thank.*you/i,
      /\/confirmation/i,
      /\/final/i
    ]
  },
  TIMEOUTS: {
    BUTTON_SEARCH: 5000,
    COMPLETION_WAIT: 600000,
    PAGE_LOAD: 30000,
    PASSIVE_MONITORING: 5000,
    MAPS_LOADING: 10000,
    MAPS_TO_SEARCH_BUTTON: 5000,
    GBP_PROFILE_CHECK: 5000,
    REVIEWS_BUTTON_SEARCH: 5000,
    REVIEWS_PAGE_LOAD: 5000
  },
  MESSAGES: {
    BUTTON_NOT_FOUND: 'Botão de início do GBP Check não encontrado',
    COMPLETION_DETECTED: 'Análise do GBP Check concluída com sucesso',
    TIMEOUT_REACHED: 'Timeout atingido aguardando conclusão do GBP Check',
    PASSIVE_MODE: 'Modo passivo ativado - GBP Check Extension assumindo controle',
    MAPS_DETECTED: 'Google Maps detectado - redirecionando para página de pesquisa',
    MAPS_REDIRECT_SUCCESS: 'Redirecionamento do Maps para Pesquisa realizado com sucesso',
    MAPS_REDIRECT_FAILED: 'Falha ao redirecionar do Maps para Pesquisa',
    GBP_TOP_MODE_DETECTED: 'GBP carregado no topo - clicando em Avaliações para modo padrão',
    GBP_REVIEWS_CLICKED: 'Botão Avaliações clicado - GBP carregado no padrão ideal',
    GBP_REVIEWS_NOT_FOUND: 'Botão Avaliações não encontrado no perfil GBP',
    AUTO_CLOSE_INITIATED: 'URL de conclusão detectada - iniciando fechamento automático',
    AUTO_CLOSE_COMPLETED: 'Fechamento automático concluído com sucesso',
    AUTO_CLOSE_ALL_PAGES: 'Fechando todas as abas relacionadas à automação',
    AUTO_CLOSE_DELAYED: 'Fechamento automático será executado após resposta',
    NEW_WINDOW_CREATED: 'Nova janela independente criada para automação',
    WINDOW_CLOSED: 'Janela da automação fechada completamente'
  }
};

// Structured Logger Class
class StructuredLogger {
  constructor(sessionId, context = {}) {
    this.sessionId = sessionId || this.generateSessionId();
    this.context = { ...context };
    this.startTime = Date.now();
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  setContext(key, value) {
    this.context[key] = value;
  }

  updateContext(newContext) {
    this.context = { ...this.context, ...newContext };
  }

  getElapsedTime() {
    return Date.now() - this.startTime;
  }

  info(message, data = {}) {
    logger.info(message, {
      sessionId: this.sessionId,
      context: this.context,
      elapsedTime: this.getElapsedTime(),
      timestamp: new Date().toISOString(),
      ...data
    });
  }

  warn(message, data = {}) {
    logger.warn(message, {
      sessionId: this.sessionId,
      context: this.context,
      elapsedTime: this.getElapsedTime(),
      timestamp: new Date().toISOString(),
      ...data
    });
  }

  error(message, error = null, data = {}) {
    const errorData = {
      sessionId: this.sessionId,
      context: this.context,
      elapsedTime: this.getElapsedTime(),
      timestamp: new Date().toISOString(),
      ...data
    };

    if (error) {
      errorData.error = {
        message: error.message,
        stack: error.stack,
        name: error.name
      };
    }

    logger.error(message, errorData);
  }
}

class PlaywrightAutomation {
  constructor(sessionId = null, name = null) {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.stealthManager = new StealthManager(logger);
    this.structuredLogger = new StructuredLogger(sessionId, {
      component: 'PlaywrightAutomation',
      state: 'initialized'
    });
    this.gbpModeFixed = false; // Rastrear se o modo GBP foi corrigido
    this.initialPageCount = 0; // Rastrear número inicial de abas
    this.cameFromMaps = false; // Rastrear se a automação veio do Google Maps
    this.automationPages = new Set(); // Rastrear todas as páginas da automação
    this.isNewWindow = false; // Rastrear se criou nova janela
    this.interceptedData = []; // Armazenar dados interceptados da API
    this.name = name; // Nome do solicitante da automação
  }







  /**
   * Injeta cookies do GBP Check para login automático
   */
  async injectGBPCheckCookies(context) {
    try {
      logger.info('🍪 Injetando cookies do GBP Check para login automático...');

      const gbpCheckCookies = [
        {
          name: "crisp-client%2Fsession%2F8b563f5e-41d9-4585-82c6-9d0e6f5fcaa7",
          value: "session_327a9105-d019-4e70-b64e-951723be9a9e",
          domain: ".gbpcheck.com",
          path: "/",
          expires: 1775266829,
          httpOnly: false,
          secure: false,
          sameSite: "Lax"
        },
        {
          name: "crisp-client%2Fsession%2F8b563f5e-41d9-4585-82c6-9d0e6f5fcaa7%2F15fdf7da5ac76f57ed3755be79111a4d45c20a4ca100e0f60dc6738f076633c0",
          value: "session_327a9105-d019-4e70-b64e-951723be9a9e",
          domain: ".gbpcheck.com",
          path: "/",
          expires: 1775266829,
          httpOnly: false,
          secure: false,
          sameSite: "Lax"
        },
        {
          name: "remember_token",
          value: "111824614471070379269|33c15e0dd1686a8caaf747f9b9a0d365f75b85f2dc1e6e9e140ba56db401b17c4de6bf61bbe7ca8ebf77df5c1e7ecee2e17c66f4a0c1ac68b930a2bd33107d48",
          domain: "app.gbpcheck.com",
          path: "/",
          expires: 1790001219,
          httpOnly: true,
          secure: false,
          sameSite: "Lax"
        },
        {
          name: "crisp-client%2Fsocket%2F8b563f5e-41d9-4585-82c6-9d0e6f5fcaa7",
          value: "1",
          domain: "app.gbpcheck.com",
          path: "/",
          expires: 1759671629,
          httpOnly: false,
          secure: false,
          sameSite: "Lax"
        },
        {
          name: "session",
          value: ".eJy9Vltv4jgU_isoz4XauZAEaaVNKKEwQCHQdotWihzbCW5DHOKES0fz39cO0M5Wo523RUKKz_3ynWN_16KkpGKj9aqypjdaxIjW09zEchKIDKjbbkINBA3T0IENEew6xLFBYiYIW043QYatxwmFloN0ZMaGjk3g4sTGMcTUMLtdYNqJaWLalZYwgGaid3UdmiDR7cTo0gRaXYx0ksSuFSdO13YphjHWZCC1oOU5Ggiho5tdaJo2BDYwbFfvulIE4YrtaZRxjCrGc6H1vv_4oBYZyiVBHjGv82r0e0NaD8pPQijxssyvBcupECt-hyoUI0GVvtYIyHoJj2xZzkRVIqXqlRRJ_nL-KdBXXsuTpPrhJ3WijEpaWKPWXb2raYvQVh8dGRI_CcmEMlYpXa9Ef9cAUBtVdYw-ReZcVCjrc9KE1QXQsnTwyV7WcfZp5IllqOWjnFBWoryiZ1fnLAhTpUPZKE-4FJWc-JJ5WOc5y9P-huK3TGZ65uKM0Us1HQO6NnBMx3RhOwYp5ZTYZV1Wr8l-78YgLl7NXbK3ME8g6KCiEJ2U8zSjqrOYy0DyqoP59sPqkuKSKj9BMIic128DtHwmi1Qfm6J6nqye1kqSb4uMVtSTMZ8EkwXdMqkCFKcu-PaOiabfqjSy2G9aL6-z7FfckBJKt5R8SMgeqlrIftNzroRJEJ1maKvOQyoqXrY85V7y6BaxTJLThowU9c9U0S4Z0aNMT0hzqlPCq2WdP0P9ZJa_SOSDG9I9o4evygkrRTXKZQ1VtMtKIkMhyrwxtQtzwlPWYL-l2hSU7Kalw9a4zls60M0WBD3d7kG9NZyuNDkwTPi0Qo_SYGOfiVXJUPZxlnOU1iilF7DFpaZoorpOiKJLYeXK1oEFLdN2gAXcru7IoxSWVcnnG57TWb2NlVENOq4DgSN_ip9fybatUjgPriY95vikziVNaFlSMpXVDXi5Qsdze4qSY-n_C0bBmZOwjEqnFX8sVZs2VVWI3u1ttjF-DcJbdOv1U4fjyXodrZ58fxAP--353Pd9LKJD15mQ4fH9fSfsykrfwX32Nn7C031_UU_-EBAorzJOtUlX_I2qBODtLbB2T4zQ-cqZB1Y_fRl5oecNvcfl7BC0J-6oXA_AFNf5ZvwGH-LV03ydTCYWfvGf-8RfvtxNx8-xQbGem7vo-fiWH_b1cbhe7MO2017klVmRoZpliemi2SrXLA-HwyVLVDBxTq-uNrcqZyYHvXMp0M3vFIqsFp3rQuhsUS678lulDy_nGZHx0Sq6zi2R61qiM-I5pg28xIYfZsHg_F2VrKCjfM8ZlvOJeZqz9wZZ0kqFjs3akTeRvG4cEwAAgXlmXGa0Gc6WJ4SMlksQK-alGyekux0EvMUi8u8WL20R4r_ociwYu9dH3PdTIx_jMvAe-PARjM3wQMrNw2A3Dsq9jQ91fdqPugNj_u1hPA0dM6Lz9_EgnKDu9vR4HDv-62FNknIPN6N4ze_AbtXGYro-sIN7Op34a8rD9zwcvUyfZgM_f_Lujeh-F1jDGWGvs8WMGVwPuPtMl_z-MDBiVr6_3Y1DsBaODoMIxk6Ch9HCSR5EGOr-u12kKZJ4-uah6dILB8tgcT_8S58yvCWVAdI2qYtZMVyKujjUxgHowL2WYnAsWNnsuX8vCGC0HnClFoTVLAirZ8LrgmgUH0v2E8K46rT-tf3nYt9oCgGjQs2AbXd02IGm-ncvnBmvGrQq01iUSXTtEYDURC5CViwfBRZxqfyKbag7NnHleyMmpo0NHFva51KSWvNVu7lhJZDqjER1QeQCj66gjX5aC_LKbFb7XUCL3fboFDSYvBEUfAPpyWP92LUn_YBcooxYcyN-vy6TqFDbJKr_t3XSBEGY-HIHNc8Bg39cRL9_JjUS_3ld_fjxDxRvTJc.aN_STA.FjK5zuGP0h4IHU3azbU0MMVVJMI",
          domain: "app.gbpcheck.com",
          path: "/",
          expires: -1, // Session cookie
          httpOnly: true,
          secure: false,
          sameSite: "Lax"
        }
      ];

      // Adicionar cookies ao contexto
      await context.addCookies(gbpCheckCookies);

      logger.info('✅ Cookies do GBP Check injetados com sucesso', {
        cookieCount: gbpCheckCookies.length,
        domains: ['app.gbpcheck.com', '.gbpcheck.com']
      });

      // Verificar se os cookies foram realmente adicionados
      try {
        const cookies = await context.cookies();
        const gbpCookies = cookies.filter(c => c.domain.includes('gbpcheck.com'));
        logger.info('🔍 Verificação de cookies injetados:', {
          totalCookies: cookies.length,
          gbpCheckCookies: gbpCookies.length,
          cookieNames: gbpCookies.map(c => c.name)
        });
      } catch (verifyError) {
        logger.warn('⚠️ Não foi possível verificar cookies:', verifyError.message);
      }

      return true;
    } catch (error) {
      logger.error('❌ Erro ao injetar cookies do GBP Check:', {
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * Localiza o executável do Google Chrome no sistema
   * Suporta Windows, Linux e macOS
   */
  findChromeExecutable() {
    const platform = process.platform;
    let possiblePaths = [];

    if (platform === 'win32') {
      // Windows
      possiblePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
        path.join(process.env.PROGRAMFILES || '', 'Google\\Chrome\\Application\\chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google\\Chrome\\Application\\chrome.exe')
      ];
    } else if (platform === 'linux') {
      // Linux
      possiblePaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium'
      ];
    } else if (platform === 'darwin') {
      // macOS
      possiblePaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        path.join(process.env.HOME || '', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
      ];
    }

    // Verificar se CHROME_EXECUTABLE_PATH está definido
    if (process.env.CHROME_EXECUTABLE_PATH) {
      possiblePaths.unshift(process.env.CHROME_EXECUTABLE_PATH);
    }

    for (const chromePath of possiblePaths) {
      if (fs.existsSync(chromePath)) {
        logger.info(`🔍 Chrome encontrado em: ${chromePath}`);
        return chromePath;
      }
    }

    logger.warn('⚠️ Google Chrome não encontrado no sistema');
    return null;
  }

  /**
   * Verifica se o Chrome está sendo executado
   */
  async checkChromeRunning() {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      const platform = process.platform;
      let command = '';
      let processName = '';

      if (platform === 'win32') {
        command = 'tasklist /FI "IMAGENAME eq chrome.exe" /FO CSV 2>nul || echo ""';
        processName = 'chrome.exe';
      } else if (platform === 'linux') {
        command = 'ps aux | grep -i chrome | grep -v grep || echo ""';
        processName = 'chrome';
      } else if (platform === 'darwin') {
        command = 'ps aux | grep -i "Google Chrome" | grep -v grep || echo ""';
        processName = 'Google Chrome';
      }

      const { stdout } = await execAsync(command);
      const chromeProcesses = stdout.split('\n').filter(line => line.includes(processName)).length;

      if (chromeProcesses > 0) {
        logger.warn(`⚠️ ${chromeProcesses} processo(s) Chrome detectado(s) em execução`);
        logger.info('💡 Dica: Feche o Chrome manualmente para evitar conflitos de perfil');
        return true;
      }

      return false;
    } catch (error) {
      logger.warn('Não foi possível verificar processos Chrome:', error.message);
      return false;
    }
  }


  async setupBrowser(headless = true) {
    try {
      this.structuredLogger.setContext('method', 'setupBrowser');
      this.structuredLogger.setContext('headless', headless);
      this.structuredLogger.info('Configurando navegador para GBP Check', {
        headless,
        persistentSession: true
      });

      let chromium;
      try {
        const playwright = require('playwright');
        chromium = playwright.chromium;
        logger.info('📦 Playwright carregado com sucesso');
      } catch (playwrightError) {
        logger.error('❌ Erro ao carregar Playwright:', playwrightError.message);
        throw new Error(`Falha ao carregar Playwright: ${playwrightError.message}`);
      }

      // Tentar encontrar Chrome instalado no sistema
      const chromePath = this.findChromeExecutable();
      let browserExecutable = null;
      let browserName = '';

      if (chromePath) {
        browserExecutable = chromePath;
        browserName = 'Google Chrome';
        logger.info(`✅ Usando Google Chrome: ${chromePath}`);
      } else {
        // Fallback para Chromium do Playwright
        browserName = 'Playwright Chromium';
        logger.info('⚠️ Chrome não encontrado, usando Chromium do Playwright como fallback');
        logger.info('💡 Para usar Chrome, instale-o ou defina CHROME_EXECUTABLE_PATH');
      }

      // Definir diretório de dados persistente
      const persistentDataDir = path.join(__dirname, 'data', 'browser-profile');

      // Criar diretório se não existir
      if (!fs.existsSync(persistentDataDir)) {
        fs.mkdirSync(persistentDataDir, { recursive: true });
        logger.info(`📁 Criado diretório de perfil persistente: ${persistentDataDir}`);
      }

      logger.info(`🔄 Tentando conectar a instância existente via CDP... (headless: ${headless})`);

      // Primeiro, tentar conectar a uma instância existente
      try {
        logger.info('🔗 Tentando conectar via CDP...');
        this.browser = await chromium.connectOverCDP('http://localhost:9222');
        logger.info('✅ Conexão CDP estabelecida');

        // Criar um novo contexto (nova janela) em vez de apenas uma nova aba
        const downloadsPath = path.join(__dirname, 'data', 'downloads');
        if (!fs.existsSync(downloadsPath)) {
          fs.mkdirSync(downloadsPath, { recursive: true });
          logger.info(`📁 Diretório de downloads criado: ${downloadsPath}`);
        }

        logger.info('🪟 Criando novo contexto...');
        this.context = await this.browser.newContext({
          viewport: this.stealthManager.getConfig().viewport,
          userAgent: this.stealthManager.getConfig().userAgent,
          locale: 'pt-BR',
          timezoneId: 'America/Sao_Paulo',
          acceptDownloads: true,
          extraHTTPHeaders: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache'
          },
          // Configurações adicionais para downloads
          httpCredentials: undefined,
          ignoreHTTPSErrors: false,
          bypassCSP: false
        });

        // Injetar cookies do GBP Check antes de criar a página
        logger.info('🍪 Injetando cookies do GBP Check...');
        await this.injectGBPCheckCookies(this.context);
        logger.info('✅ Cookies injetados');

        logger.info('📄 Criando nova página...');
        this.page = await this.context.newPage();
        logger.info('✅ Nova página criada');

        // Aplicar configurações stealth na nova janela
        logger.info('🥷 Aplicando configurações stealth...');
        await this.stealthManager.applyStealthConfiguration(this.page);
        logger.info('✅ Configurações stealth aplicadas');

        // Configurar interceptação de API
        logger.info('🕵️ Configurando interceptação de API...');
        await this.setupAPIInterception(this.page);
        logger.info('✅ Interceptação de API configurada');

        // Configurar downloads na nova janela
        logger.info('📥 Configurando downloads...');
        await this.setupDownloadConfiguration(this.page);
        logger.info('✅ Downloads configurados');

        // Marcar que criou nova janela
        this.isNewWindow = true;

        logger.info('✅ Conectado a instância existente - nova janela criada');
        logger.info(`👁️ Modo de exibição: ${headless ? 'OCULTO (headless)' : 'VISÍVEL (com interface)'}`);
        logger.info('🪟 Nova janela independente criada com perfil completo');
        return true;
      } catch (connectError) {
        logger.info('❌ Falha na conexão CDP:', connectError.message);
        logger.info('🔄 Criando contexto persistente...');
      }

      // Se não conseguiu conectar, usar contexto persistente
      logger.info(`🚀 Iniciando ${browserName} com contexto persistente: ${persistentDataDir}`);
      logger.info(`👁️ Configuração de visibilidade: headless = ${headless}`);

      // Caminho para a extensão GBP Check
      const extensionPath = path.join(__dirname, 'chrome-extension');

      // Verificar se a extensão existe
      if (!fs.existsSync(extensionPath)) {
        logger.error(`❌ Extensão GBP Check não encontrada em: ${extensionPath}`);
        throw new Error(`Extensão GBP Check não encontrada em: ${extensionPath}`);
      }

      logger.info(`🔌 Carregando extensão GBP Check de: ${extensionPath}`);

      // Criar diretório de downloads
      const downloadsPath = path.join(__dirname, 'data', 'downloads');
      if (!fs.existsSync(downloadsPath)) {
        fs.mkdirSync(downloadsPath, { recursive: true });
        logger.info(`📁 Diretório de downloads criado: ${downloadsPath}`);
      }

      logger.info('⚙️ Preparando opções de lançamento...');
      const launchOptions = {
        headless: headless,
        viewport: this.stealthManager.getConfig().viewport,
        acceptDownloads: true,
        downloadsPath: downloadsPath,
        args: [
          // Debugging e desenvolvimento
          '--remote-debugging-port=9222',

          // Carregar extensão GBP Check (DEVE vir antes dos argumentos stealth)
          `--load-extension=${extensionPath}`,
          `--disable-extensions-except=${extensionPath}`,

          // Argumentos para sempre maximizar a janela
          '--start-maximized',
          '--window-size=1920,1080',
          '--window-position=0,0',

          // Argumentos específicos para compatibilidade com extensões
          ...this.stealthManager.getExtensionFriendlyArgs(),

          // Argumentos específicos para downloads
          '--allow-file-access-from-files',
          '--enable-local-file-accesses',
          '--disable-pdf-extension', // Permite download direto de PDFs
          '--disable-plugins-discovery',
          '--disable-extensions-file-access-check',
          '--disable-print-preview',

          // Argumentos para melhorar conectividade de rede
          '--enable-features=NetworkService,NetworkServiceLogging',
          '--disable-features=VizDisplayCompositor',
          '--no-proxy-server',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-background-networking',
          '--aggressive-cache-discard',
          '--enable-tcp-fast-open',
          '--max-connections-per-host=10',

          // Argumentos stealth do módulo (já inclui --no-first-run e --no-default-browser-check)
          ...this.stealthManager.getStealthBrowserArgs()
        ],
        // Preservar extensões e ignorar argumentos que podem revelar automação
        ignoreDefaultArgs: [
          '--disable-extensions',
          '--enable-automation',
          '--disable-default-apps',
          '--disable-component-extensions-with-background-pages',
        ]
      };

      // Adicionar executablePath apenas se Chrome foi encontrado
      if (browserExecutable) {
        launchOptions.executablePath = browserExecutable;
      }

      // Se não for headless, adicionar argumentos adicionais para garantir visibilidade
      if (!headless) {
        launchOptions.args.push(
          '--force-device-scale-factor=1'
        );
        this.structuredLogger.info('Argumentos de visibilidade adicionados para modo não-headless', {
          headless: false,
          maximized: true,
          additionalArgs: ['--force-device-scale-factor=1']
        });
      } else {
        this.structuredLogger.info('Navegador configurado para modo headless maximizado', {
          headless: true,
          maximized: true
        });
      }

      // Log dos argumentos para debug
      logger.info('🔧 Argumentos do browser configurados:');
      logger.info(`   📦 Extensão: ${extensionPath}`);
      logger.info(`   🥷 Stealth args: ${this.stealthManager.getStealthBrowserArgs().length} argumentos`);
      logger.info(`   🔌 Extension-friendly args: ${this.stealthManager.getExtensionFriendlyArgs().length} argumentos`);
      logger.info(`   📐 Window: ${launchOptions.args.find(arg => arg.includes('window-size'))}`);
      logger.info(`   🗺️ Maps patterns: ${GBP_CONFIG.URL_PATTERNS.GOOGLE_MAPS.length} padrões`);
      logger.info(`   🔍 Search patterns: ${GBP_CONFIG.URL_PATTERNS.GOOGLE_SEARCH.length} padrões`);
      logger.info(`   📥 Downloads: ${downloadsPath}`);

      if (process.env.DEBUG_BROWSER_ARGS) {
        logger.info(`🔧 Opções completas de lançamento: ${JSON.stringify(launchOptions, null, 2)}`);
      }

      logger.info('🚀 Executando launchPersistentContext...');
      this.context = await chromium.launchPersistentContext(persistentDataDir, launchOptions);
      logger.info('✅ launchPersistentContext executado com sucesso');

      // Verificar se a extensão foi carregada
      logger.info('🔍 Verificando se a extensão foi carregada...');

      this.browser = this.context.browser();

      // Injetar cookies do GBP Check no contexto persistente
      logger.info('🍪 Injetando cookies do GBP Check...');
      await this.injectGBPCheckCookies(this.context);
      logger.info('✅ Cookies injetados');

      // Usar página existente ou criar nova
      const pages = this.context.pages();
      if (pages.length > 0) {
        this.page = pages[0];
        logger.info('📄 Reutilizando página existente do contexto persistente');
      } else {
        this.page = await this.context.newPage();
        logger.info('📄 Nova página criada no contexto persistente');
      }

      // Aplicar configurações stealth avançadas
      logger.info('🥷 Aplicando configurações stealth...');
      await this.stealthManager.applyStealthConfiguration(this.page);
      logger.info('✅ Configurações stealth aplicadas');

      // Configurar interceptação de API
      logger.info('🕵️ Configurando interceptação de API...');
      await this.setupAPIInterception(this.page);
      logger.info('✅ Interceptação de API configurada');

      // Configurar downloads na página
      logger.info('📥 Configurando downloads...');
      await this.setupDownloadConfiguration(this.page);
      logger.info('✅ Downloads configurados');

      // Verificar estado da janela e garantir maximização
      try {
        const viewport = this.page.viewportSize();
        this.structuredLogger.info(`Viewport configurado`, {
          width: viewport?.width,
          height: viewport?.height,
          maximized: true
        });

        // Garantir que a janela esteja maximizada e visível
        if (!headless) {
          await this.page.bringToFront();

          // Tentar maximizar a janela via JavaScript se possível
          try {
            await this.page.evaluate(() => {
              if (window.screen && window.screen.availWidth && window.screen.availHeight) {
                window.resizeTo(window.screen.availWidth, window.screen.availHeight);
                window.moveTo(0, 0);
              }
            });
            this.structuredLogger.info('Janela maximizada via JavaScript', {
              method: 'window.resizeTo',
              position: '0,0'
            });
          } catch (jsError) {
            this.structuredLogger.warn('Não foi possível maximizar via JavaScript', {
              error: jsError.message
            });
          }

          this.structuredLogger.info('Janela trazida para frente e maximizada');
        } else {
          this.structuredLogger.info('Modo headless - janela maximizada internamente');
        }
      } catch (viewportError) {
        logger.warn('⚠️ Erro ao verificar viewport:', viewportError.message);
      }

      this.structuredLogger.info(`${browserName} iniciado com persistência completa de sessão`, {
        browser: browserName,
        sessionPersistence: true,
        dataPreserved: ['cookies', 'sessões', 'histórico', 'configurações'],
        windowState: 'maximized',
        mode: headless ? 'headless' : 'visible'
      });
      this.structuredLogger.info(`Estado final: ${headless ? 'MODO HEADLESS MAXIMIZADO (oculto)' : 'MODO VISÍVEL MAXIMIZADO (interface ativa)'}`);
      return true;

    } catch (error) {
      logger.error('❌ Erro ao configurar navegador com persistência:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        headless: headless,
        chromePath: this.findChromeExecutable(),
        persistentDataDir: path.join(__dirname, 'data', 'browser-profile')
      });

      // Tentar limpeza em caso de erro
      try {
        if (this.page && !this.page.isClosed()) await this.page.close();
        if (this.context) await this.context.close();
        if (this.browser) await this.browser.close();
      } catch (cleanupError) {
        logger.error('Erro na limpeza:', cleanupError.message);
      }

      return false;
    }
  }

  async navigateToUrl(url) {
    try {
      this.structuredLogger.setContext('method', 'navigateToUrl');
      this.structuredLogger.setContext('url', url);
      this.structuredLogger.info(`Navegando para URL GBP Check`, { targetUrl: url });

      // Rastrear número inicial de páginas e a página atual
      this.initialPageCount = this.context.pages().length;
      this.automationPages.add(this.page);
      this.structuredLogger.info('Rastreamento de páginas iniciado', {
        initialPageCount: this.initialPageCount,
        currentPageUrl: this.page.url()
      });

      // Se for URL do GBP Check, garantir que os cookies estão presentes antes de navegar
      if (url.includes('gbpcheck.com')) {
        logger.info('🔍 URL do GBP Check detectada - verificando cookies antes da navegação...');

        // Re-injetar cookies para garantir que estão presentes
        try {
          await this.injectGBPCheckCookies(this.context);
          logger.info('✅ Cookies re-injetados antes da navegação para GBP Check');
        } catch (cookieError) {
          logger.warn('⚠️ Erro ao re-injetar cookies:', cookieError.message);
        }
      }

      // Testar conectividade básica primeiro
      await this.testConnectivity();

      // Verificar se é URL do Google Share e pode precisar de tratamento especial
      if (url.includes('share.google')) {
        this.structuredLogger.info('🔗 URL do Google Share detectada - pode redirecionar', {
          originalUrl: url
        });
      }

      // Simular comportamento humano antes da navegação
      await this.stealthManager.humanDelay(1000, 2000);
      await this.stealthManager.simulateHumanMouseMovement(this.page);

      // Tentar trazer janela para frente antes da navegação
      try {
        await this.page.bringToFront();
        logger.info('🔝 Janela trazida para frente antes da navegação');
      } catch (bringError) {
        logger.warn('⚠️ Não foi possível trazer janela para frente:', bringError.message);
      }

      // Verificar se a página ainda está acessível
      try {
        const currentUrl = this.page.url();
        this.structuredLogger.info('📄 Página atual antes da navegação', {
          currentUrl,
          isClosed: this.page.isClosed()
        });
      } catch (pageError) {
        this.structuredLogger.warn('⚠️ Erro ao verificar página atual', {
          error: pageError.message
        });
      }

      // Navegação com retry e diferentes estratégias
      try {
        // Se for URL do GBP Check, navegar primeiro para a página base para estabelecer cookies
        if (url.includes('gbpcheck.com') && !url.endsWith('gbpcheck.com') && !url.endsWith('gbpcheck.com/')) {
          logger.info('🔐 Navegando primeiro para domínio base do GBP Check para estabelecer sessão...');
          try {
            await this.page.goto('https://app.gbpcheck.com', {
              waitUntil: 'domcontentloaded',
              timeout: 15000
            });
            logger.info('✅ Domínio base carregado - cookies estabelecidos');
            await this.stealthManager.humanDelay(1000, 2000);
          } catch (baseError) {
            logger.warn('⚠️ Erro ao carregar domínio base, continuando...', baseError.message);
          }
        }

        await this.navigateWithRetry(url);
      } catch (primaryError) {
        this.structuredLogger.warn('❌ Falha na URL primária - tentando alternativas', {
          primaryUrl: url,
          error: primaryError.message
        });

        // Se é URL do Google Share, tentar expandir primeiro
        if (url.includes('share.google')) {
          await this.tryAlternativeUrls(url);
        } else {
          throw primaryError;
        }
      }

      // Delay pós-navegação para simular leitura humana
      await this.stealthManager.humanDelay(2000, 4000);

      // Verificar se a página carregou corretamente
      const currentUrl = this.page.url();
      logger.info(`✅ Navegação concluída - URL atual: ${currentUrl}`);

      // Se foi redirecionado para login, tentar re-injetar cookies e recarregar
      if (currentUrl.includes('/login') && url.includes('gbpcheck.com')) {
        logger.warn('⚠️ Redirecionado para página de login - tentando re-autenticar...');

        try {
          // Re-injetar cookies
          await this.injectGBPCheckCookies(this.context);
          logger.info('🔄 Cookies re-injetados, recarregando página...');

          // Aguardar um pouco
          await this.stealthManager.humanDelay(1000, 2000);

          // Recarregar a página original
          await this.page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });

          const newUrl = this.page.url();
          logger.info(`🔄 Página recarregada - URL atual: ${newUrl}`);

          if (newUrl.includes('/login')) {
            logger.error('❌ Ainda redirecionado para login após re-injeção de cookies');
          } else {
            logger.info('✅ Re-autenticação bem-sucedida!');
          }
        } catch (reAuthError) {
          logger.error('❌ Erro ao tentar re-autenticar:', reAuthError.message);
        }
      }

      // Simular scroll para baixo (comportamento humano)
      await this.stealthManager.simulateNaturalScroll(this.page);

      // Tentar trazer janela para frente novamente após navegação
      try {
        await this.page.bringToFront();
        logger.info('🔝 Janela trazida para frente após navegação');
      } catch (bringError) {
        logger.warn('⚠️ Não foi possível trazer janela para frente após navegação:', bringError.message);
      }

      return true;
    } catch (error) {
      const errorDetails = {
        error: error.message,
        errorType: error.name,
        targetUrl: url,
        currentUrl: this.page ? this.page.url() : 'unknown',
        timeout: error.message.includes('Timeout') || error.message.includes('timeout'),
        networkError: error.message.includes('net::') || error.message.includes('ERR_'),
        connectionRefused: error.message.includes('CONNECTION_REFUSED'),
        dnsError: error.message.includes('NAME_NOT_RESOLVED'),
        pageIsClosed: this.page ? this.page.isClosed() : true
      };

      this.structuredLogger.error('❌ Erro na navegação', errorDetails);

      // Tentar diagnóstico adicional
      if (errorDetails.timeout) {
        this.structuredLogger.error('🕐 Timeout na navegação - possível problema de conectividade ou página lenta');
      } else if (errorDetails.networkError) {
        this.structuredLogger.error('🌐 Erro de rede - verificar conectividade');
      } else if (errorDetails.pageIsClosed) {
        this.structuredLogger.error('📄 Página foi fechada durante navegação');
      }

      // Re-lançar o erro com mais contexto
      throw new Error(`Falha na navegação para ${url}: ${error.message}`);
    }
  }





  getPageInfo() {
    return {
      url: this.page ? this.page.url() : '',
      title: '',
      timestamp: new Date().toISOString()
    };
  }



  /**
   * Configura interceptação de requisições da API GBP Check
   */
  async setupAPIInterception(page) {
    try {
      logger.info('🕵️ Configurando interceptação de API...');

      // Interceptar requisições HTTP
      await page.route('**/api/healthcheck/external/**', async (route, request) => {
        const url = request.url();
        const method = request.method();
        const headers = request.headers();
        const postData = request.postData();

        // Log da requisição interceptada
        logger.info('📡 Requisição API interceptada:', {
          url: url.substring(0, 100) + '...',
          method: method,
          hasPostData: !!postData
        });

        // Tentar parsear os dados POST
        let parsedData = null;
        if (postData) {
          try {
            // Verificar se é JSON
            if (headers['content-type']?.includes('application/json')) {
              parsedData = JSON.parse(postData);
            } else if (headers['content-type']?.includes('application/x-www-form-urlencoded')) {
              // Parsear form data
              const params = new URLSearchParams(postData);
              parsedData = Object.fromEntries(params);
            } else {
              // Dados raw
              parsedData = { raw_data: postData };
            }
          } catch (parseError) {
            logger.warn('⚠️ Erro ao parsear dados POST:', parseError.message);
            parsedData = { raw_data: postData, parse_error: parseError.message };
          }
        }

        // Armazenar dados interceptados
        const interceptedRequest = {
          timestamp: new Date().toISOString(),
          url: url,
          method: method,
          headers: headers,
          data: parsedData,
          user_agent: headers['user-agent'],
          referer: headers['referer']
        };

        this.interceptedData.push(interceptedRequest);

        logger.info('✅ Dados da API capturados:', {
          dataSize: postData ? postData.length : 0,
          totalIntercepted: this.interceptedData.length
        });

        // Continuar com a requisição normal (não interferir no fluxo)
        await route.continue();
      });

      // Interceptar também outras APIs relacionadas
      await page.route('**/api.gbpcheck.com/**', async (route, request) => {
        const url = request.url();
        const method = request.method();
        const postData = request.postData();

        if (postData && url.includes('healthcheck')) {
          logger.info('📡 API GBP Check interceptada:', {
            url: url.substring(0, 80) + '...',
            method: method
          });

          let parsedData = null;
          try {
            parsedData = JSON.parse(postData);
          } catch {
            parsedData = { raw_data: postData };
          }

          this.interceptedData.push({
            timestamp: new Date().toISOString(),
            url: url,
            method: method,
            data: parsedData,
            headers: request.headers()
          });
        }

        await route.continue();
      });

      logger.info('✅ Interceptação de API configurada');
      return true;
    } catch (error) {
      logger.error('❌ Erro ao configurar interceptação de API:', error.message);
      return false;
    }
  }

  /**
   * Configura downloads na página
   */
  async setupDownloadConfiguration(page) {
    try {
      logger.info('📥 Configurando downloads na página...');

      // Configurar listener para downloads
      const downloadsPath = path.join(__dirname, 'data', 'downloads');

      page.on('download', async (download) => {
        try {
          const suggestedFilename = download.suggestedFilename();
          const url = download.url();

          logger.info('📥 Download iniciado:', {
            filename: suggestedFilename,
            url: url.substring(0, 100) + '...'
          });

          // Gerar nome de arquivo adequado
          let filename = suggestedFilename;
          if (!filename || filename === 'download') {
            // Extrair nome da URL
            const urlParts = url.split('/');
            const urlFilename = urlParts[urlParts.length - 1];

            if (urlFilename && urlFilename.includes('.')) {
              filename = urlFilename.split('?')[0]; // Remove query parameters
            } else {
              // Detectar tipo de arquivo pelo Content-Type ou URL
              if (url.toLowerCase().includes('.pdf') || url.toLowerCase().includes('pdf')) {
                filename = `document_${Date.now()}.pdf`;
              } else if (url.toLowerCase().includes('.xlsx') || url.toLowerCase().includes('excel')) {
                filename = `spreadsheet_${Date.now()}.xlsx`;
              } else if (url.toLowerCase().includes('.docx') || url.toLowerCase().includes('word')) {
                filename = `document_${Date.now()}.docx`;
              } else {
                filename = `download_${Date.now()}.bin`;
              }
            }
          }

          // Garantir que o nome do arquivo é válido
          filename = filename.replace(/[<>:"/\\|?*]/g, '_');

          const filePath = path.join(downloadsPath, filename);

          // Salvar o arquivo
          await download.saveAs(filePath);

          logger.info('✅ Download concluído:', {
            filename: filename,
            path: filePath,
            size: fs.existsSync(filePath) ? fs.statSync(filePath).size : 'unknown'
          });

        } catch (downloadError) {
          logger.error('❌ Erro durante download:', downloadError.message);
        }
      });

      // Configurar headers específicos para downloads
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      });

      // Configurar comportamento de download via JavaScript
      await page.addInitScript(() => {
        // Sobrescrever comportamento padrão de PDFs
        Object.defineProperty(navigator, 'pdfViewerEnabled', {
          get: () => false,
        });

        // Interceptar cliques em links de download
        document.addEventListener('click', function(event) {
          const target = event.target.closest('a');
          if (target && target.href) {
            const href = target.href.toLowerCase();
            if (href.includes('.pdf') || href.includes('.xlsx') || href.includes('.docx') ||
                href.includes('download') || target.hasAttribute('download')) {
              // Permitir que o browser handle o download naturalmente
              console.log('Download link detectado:', target.href);
            }
          }
        }, true);

        // Forçar download para window.open com arquivos
        const originalOpen = window.open;
        window.open = function(url, target, features) {
          if (url && (url.toLowerCase().includes('.pdf') ||
                     url.toLowerCase().includes('.xlsx') ||
                     url.toLowerCase().includes('.docx') ||
                     url.toLowerCase().includes('download'))) {
            // Criar link de download
            const link = document.createElement('a');
            link.href = url;
            link.download = ''; // Deixar o browser decidir o nome
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return null;
          }
          return originalOpen.call(this, url, target, features);
        };
      });

      logger.info('✅ Configuração de downloads aplicada com listener de eventos');
      return true;
    } catch (error) {
      logger.error('❌ Erro ao configurar downloads:', error.message);
      return false;
    }
  }

  /**
   * Lista downloads realizados
   */
  getDownloads() {
    try {
      const downloadsPath = path.join(__dirname, 'data', 'downloads');
      if (!fs.existsSync(downloadsPath)) {
        return [];
      }

      const files = fs.readdirSync(downloadsPath);
      return files.map(file => {
        const filePath = path.join(downloadsPath, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          extension: path.extname(file),
          type: this.getFileType(file)
        };
      });
    } catch (error) {
      logger.error('❌ Erro ao listar downloads:', error.message);
      return [];
    }
  }

  /**
   * Determina o tipo de arquivo baseado na extensão
   */
  getFileType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const types = {
      '.pdf': 'PDF Document',
      '.xlsx': 'Excel Spreadsheet',
      '.xls': 'Excel Spreadsheet (Legacy)',
      '.docx': 'Word Document',
      '.doc': 'Word Document (Legacy)',
      '.pptx': 'PowerPoint Presentation',
      '.txt': 'Text File',
      '.csv': 'CSV File',
      '.zip': 'ZIP Archive',
      '.rar': 'RAR Archive'
    };
    return types[ext] || 'Unknown File';
  }

  /**
   * Retorna dados interceptados da API da extensão
   */
  getInterceptedAPIData() {
    return {
      total_requests: this.interceptedData.length,
      requests: this.interceptedData.map(request => ({
        timestamp: request.timestamp,
        url: request.url,
        method: request.method,
        data_size: request.data ? JSON.stringify(request.data).length : 0,
        has_data: !!request.data,
        user_agent: request.user_agent,
        referer: request.referer
      })),
      detailed_data: this.interceptedData
    };
  }

  /**
   * Extrai dados específicos da extensão GBP Check
   */
  extractGBPCheckData() {
    const gbpData = {
      health_check_data: [],
      user_info: {},
      place_data: {},
      analysis_results: []
    };

    this.interceptedData.forEach(request => {
      if (request.data) {
        // Extrair dados de health check
        if (request.data.method === 'health_check' || request.url.includes('healthcheck')) {
          gbpData.health_check_data.push({
            timestamp: request.timestamp,
            method: request.data.method,
            reference_k: request.data.reference_k,
            email: request.data.email,
            data_preview: request.data.data ? request.data.data.substring(0, 200) + '...' : null,
            add_data: request.data.add_data
          });
        }

        // Extrair informações do usuário
        if (request.data.email) {
          gbpData.user_info.email = request.data.email;
        }

        // Extrair dados do local
        if (request.data.place_id || request.data.reference_k) {
          gbpData.place_data.reference_key = request.data.reference_k;
          gbpData.place_data.place_id = request.data.place_id;
        }
      }
    });

    return gbpData;
  }

  /**
   * Clica em um botão específico após a conclusão da automação
   */
  async clickButtonAfterCompletion(selector) {
    try {
      logger.info('🖱️ Tentando clicar no botão após conclusão', {
        selector: selector
      });

      // Verificar se a página ainda está acessível
      if (!this.page || this.page.isClosed()) {
        logger.warn('⚠️ Página não está acessível para clicar no botão');
        return false;
      }

      // Aguardar um pouco para garantir que a página está carregada
      await this.page.waitForTimeout(2000);

      // Tentar encontrar o botão
      try {
        await this.page.waitForSelector(selector, { timeout: 10000 });
        logger.info('✅ Botão encontrado');
      } catch (waitError) {
        logger.warn('⚠️ Botão não encontrado no timeout especificado', {
          selector: selector,
          error: waitError.message
        });
        return false;
      }

      // Clicar no botão
      try {
        await this.page.click(selector);
        logger.info('✅ Botão clicado com sucesso', {
          selector: selector
        });

        // Aguardar um pouco após o clique
        await this.page.waitForTimeout(1000);

        return true;
      } catch (clickError) {
        logger.error('❌ Erro ao clicar no botão', {
          selector: selector,
          error: clickError.message
        });
        return false;
      }

    } catch (error) {
      logger.error('❌ Erro ao tentar clicar no botão após conclusão', {
        selector: selector,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Envia webhook com dados de conclusão da automação
   */
  async sendCompletionWebhook(webhookUrl, completionData) {
    try {
      logger.info('📡 Enviando webhook com dados de conclusão', {
        webhookUrl: webhookUrl.substring(0, 50) + '...',
        dataSize: JSON.stringify(completionData).length
      });

      // Importar axios ou usar fetch nativo do Node.js
      const https = require('https');
      const http = require('http');
      const url = require('url');

      const parsedUrl = url.parse(webhookUrl);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const postData = JSON.stringify(completionData);

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'GBP-Check-Automation/1.0'
        },
        timeout: 30000 // 30 segundos de timeout
      };

      return new Promise((resolve, reject) => {
        const req = protocol.request(options, (res) => {
          let responseData = '';

          res.on('data', (chunk) => {
            responseData += chunk;
          });

          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              logger.info('✅ Webhook enviado com sucesso', {
                statusCode: res.statusCode,
                responseSize: responseData.length
              });
              resolve(true);
            } else {
              logger.warn('⚠️ Webhook retornou status não-sucesso', {
                statusCode: res.statusCode,
                response: responseData.substring(0, 200)
              });
              resolve(false);
            }
          });
        });

        req.on('error', (error) => {
          logger.error('❌ Erro ao enviar webhook', {
            error: error.message,
            webhookUrl: webhookUrl.substring(0, 50) + '...'
          });
          reject(error);
        });

        req.on('timeout', () => {
          logger.error('❌ Timeout ao enviar webhook');
          req.destroy();
          reject(new Error('Webhook request timeout'));
        });

        // Enviar dados
        req.write(postData);
        req.end();
      });

    } catch (error) {
      logger.error('❌ Erro ao preparar envio de webhook', {
        error: error.message,
        webhookUrl: webhookUrl.substring(0, 50) + '...'
      });
      return false;
    }
  }

  async cleanup() {
    try {
      logger.info('🧹 Limpeza do navegador (preservando sessão persistente)...');

      // Fechar apenas a página atual, mantendo o contexto ativo
      if (this.page && !this.page.isClosed()) {
        await this.page.close();
        logger.info('📄 Página atual fechada');
      }

      // Se for contexto persistente, não fechar completamente para preservar sessão
      if (this.context) {
        logger.info('💾 Contexto persistente mantido para preservar sessão');
        // Não fechar o contexto para manter cookies e sessões
      } else if (this.browser) {
        // Se for browser normal (conectado via CDP), fechar apenas a conexão
        await this.browser.close();
        logger.info('🔗 Conexão CDP fechada');
      }

      logger.info('✅ Limpeza concluída - sessão preservada');
    } catch (error) {
      logger.error('❌ Erro na limpeza:', error.message);
    }
  }

  /**
   * Complete cleanup - closes browser completely for queue processing
   * This ensures no browser processes remain running between queue jobs
   */
  async completeCleanup() {
    try {
      logger.info('🧹 Limpeza completa do browser iniciada...');

      // Close all pages first
      if (this.page && !this.page.isClosed()) {
        try {
          await this.page.close();
          logger.info('📄 Página principal fechada');
        } catch (pageError) {
          logger.warn('Erro ao fechar página principal:', pageError.message);
        }
      }

      // Close all tracked automation pages
      for (const page of this.automationPages) {
        try {
          if (page && !page.isClosed()) {
            await page.close();
            logger.info('📄 Página de automação fechada');
          }
        } catch (pageError) {
          logger.warn('Erro ao fechar página de automação:', pageError.message);
        }
      }

      // Close context completely
      if (this.context && !this.context._closed) {
        try {
          await this.context.close();
          logger.info('🔒 Contexto do browser fechado');
        } catch (contextError) {
          logger.warn('Erro ao fechar contexto:', contextError.message);
        }
      }

      // Close browser completely
      if (this.browser && !this.browser._closed) {
        try {
          await this.browser.close();
          logger.info('🔒 Browser fechado completamente');
        } catch (browserError) {
          logger.warn('Erro ao fechar browser:', browserError.message);
        }
      }

      // Clear references
      this.page = null;
      this.context = null;
      this.browser = null;
      this.automationPages.clear();

      logger.info('✅ Limpeza completa concluída - todos os recursos liberados');
    } catch (error) {
      logger.error('❌ Erro na limpeza completa:', error.message);
    }
  }

  /**
   * Fecha automaticamente todas as abas relacionadas à automação quando a conclusão é detectada
   */
  async performAutoClose() {
    this.structuredLogger.setContext('method', 'performAutoClose');
    this.structuredLogger.setContext('state', 'auto_closing');

    try {
      // Verificar se ainda temos acesso à página atual
      let currentUrl = 'unknown';
      try {
        currentUrl = this.page && !this.page.isClosed() ? this.page.url() : 'page_already_closed';
      } catch (urlError) {
        currentUrl = 'page_access_error';
      }

      this.structuredLogger.info(GBP_CONFIG.MESSAGES.AUTO_CLOSE_INITIATED, {
        currentUrl: currentUrl,
        trackedPages: this.automationPages.size,
        isNewWindow: this.isNewWindow,
        willCloseWindow: true,
        timestamp: new Date().toISOString()
      });

      // Aguardar um pouco apenas se a página ainda estiver acessível
      if (this.page && !this.page.isClosed()) {
        try {
          await this.page.waitForTimeout(2000);
        } catch (timeoutError) {
          this.structuredLogger.warn('Página fechada durante timeout inicial', {
            error: timeoutError.message
          });
        }
      }

      // Fechar todas as páginas rastreadas da automação
      let closedPages = 0;
      let alreadyClosedPages = 0;

      for (const page of this.automationPages) {
        try {
          if (page && !page.isClosed()) {
            let pageUrl = 'unknown';
            try {
              pageUrl = page.url();
            } catch (urlError) {
              pageUrl = 'url_access_error';
            }

            await page.close();
            closedPages++;
            this.structuredLogger.info('Página da automação fechada', {
              pageUrl: pageUrl.length > 80 ? pageUrl.substring(0, 80) + '...' : pageUrl,
              closedCount: closedPages
            });
          } else {
            alreadyClosedPages++;
            this.structuredLogger.info('Página já estava fechada', {
              alreadyClosedCount: alreadyClosedPages
            });
          }
        } catch (pageCloseError) {
          this.structuredLogger.warn('Erro ao fechar página específica', {
            error: pageCloseError.message,
            errorType: pageCloseError.name
          });
          // Continuar tentando fechar outras páginas
        }
      }

      // Se não conseguiu fechar nenhuma página rastreada, tentar fechar todas as páginas do contexto
      if (closedPages === 0 && this.context && !this.context._closed) {
        this.structuredLogger.info('Tentando fechar todas as páginas do contexto como fallback');
        try {
          const allPages = this.context.pages();
          for (const page of allPages) {
            try {
              if (page && !page.isClosed()) {
                await page.close();
                closedPages++;
                this.structuredLogger.info('Página do contexto fechada (fallback)', {
                  closedCount: closedPages
                });
              }
            } catch (fallbackError) {
              this.structuredLogger.warn('Erro no fechamento fallback', {
                error: fallbackError.message
              });
            }
          }
        } catch (contextError) {
          this.structuredLogger.warn('Erro ao acessar páginas do contexto', {
            error: contextError.message
          });
        }
      }

      // Verificar se há outras abas abertas (não relacionadas à automação)
      let remainingPages = [];
      try {
        if (this.context && !this.context._closed) {
          remainingPages = this.context.pages();
        }
      } catch (contextError) {
        this.structuredLogger.warn('Erro ao verificar páginas restantes', {
          error: contextError.message
        });
      }

      this.structuredLogger.info('Status após fechamento das páginas da automação', {
        pagesClosedByAutomation: closedPages,
        alreadyClosedPages: alreadyClosedPages,
        remainingPages: remainingPages.length,
        totalTrackedPages: this.automationPages.size
      });

      // Sempre fechar a janela inteira (contexto) da automação
      try {
        if (this.context && !this.context._closed) {
          await this.context.close();
          this.structuredLogger.info('Janela da automação fechada completamente', {
            contextClosed: true,
            windowClosed: true,
            pagesInWindow: remainingPages.length
          });
        } else if (this.browser && !this.browser._closed) {
          await this.browser.close();
          this.structuredLogger.info('Browser fechado', {
            browserClosed: true
          });
        } else {
          this.structuredLogger.info('Contexto/Browser já estava fechado', {
            contextClosed: this.context?._closed || false,
            browserClosed: this.browser?._closed || false
          });
        }
      } catch (closeError) {
        this.structuredLogger.warn('Erro ao fechar contexto/browser', {
          error: closeError.message,
          errorType: closeError.name
        });
      }

      const autoCloseSuccess = closedPages > 0 || alreadyClosedPages > 0;

      this.structuredLogger.info(GBP_CONFIG.MESSAGES.AUTO_CLOSE_COMPLETED, {
        autoCloseSuccess: autoCloseSuccess,
        pagesClosedByAutomation: closedPages,
        pagesAlreadyClosed: alreadyClosedPages,
        windowClosed: true,
        isNewWindow: this.isNewWindow,
        timestamp: new Date().toISOString()
      });

      return autoCloseSuccess;

    } catch (error) {
      this.structuredLogger.error('Erro durante fechamento automático', error, {
        currentUrl: this.page?.url() || 'unknown',
        trackedPages: this.automationPages.size
      });
      return false;
    }
  }

  /**
   * Detecta se a URL atual é do Google Maps e precisa ser redirecionada
   */
  isGoogleMapsUrl(url) {
    return GBP_CONFIG.URL_PATTERNS.GOOGLE_MAPS.some(pattern => pattern.test(url));
  }

  /**
   * Detecta se a URL atual é do Google Search (destino correto)
   */
  isGoogleSearchUrl(url) {
    return GBP_CONFIG.URL_PATTERNS.GOOGLE_SEARCH.some(pattern => pattern.test(url));
  }

  /**
   * Executa correção do modo GBP topo clicando no botão "Avaliações"
   * O botão navega na mesma página (não abre nova aba)
   */
  async executeGBPTopModeCorrection(reviewsButton, foundSelector, currentUrl, retryAttempt) {
    try {
      this.structuredLogger.info('🎯 Executando correção do modo topo', {
        retryAttempt,
        foundSelector,
        method: 'Click and wait for same-page navigation'
      });

      // Verificar se o elemento ainda está visível e clicável
      const isClickable = await reviewsButton.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0 &&
                         window.getComputedStyle(el).visibility !== 'hidden' &&
                         window.getComputedStyle(el).display !== 'none';
        const isInViewport = rect.top >= 0 && rect.left >= 0 &&
                            rect.bottom <= window.innerHeight &&
                            rect.right <= window.innerWidth;
        return { isVisible, isInViewport, rect: { width: rect.width, height: rect.height } };
      });

      this.structuredLogger.info('🔍 Verificação de clicabilidade do botão', isClickable);

      if (!isClickable.isVisible) {
        throw new Error('Botão não está visível para clique');
      }

      // Rolar para o elemento se necessário
      if (!isClickable.isInViewport) {
        this.structuredLogger.info('📜 Rolando para o botão');
        await reviewsButton.scrollIntoViewIfNeeded();
        await this.page.waitForTimeout(1000);
      }

      // Simular interação humana
      await this.stealthManager.simulateHumanInteraction(reviewsButton);

      // Clicar e aguardar navegação na MESMA página (não abre nova aba)
      this.structuredLogger.info('🖱️ Clicando no botão "Avaliações" e aguardando navegação');

      await Promise.all([
        this.page.waitForNavigation({
          waitUntil: 'domcontentloaded',
          timeout: 10000
        }).catch(err => {
          this.structuredLogger.warn('⚠️ Timeout aguardando navegação', {
            error: err.message
          });
        }),
        reviewsButton.click()
      ]);

      // Aguardar estabilização da página
      await this.page.waitForLoadState('domcontentloaded');
      await this.page.waitForTimeout(2000);


      const newUrl = this.page.url();
      const urlChanged = newUrl !== currentUrl;

      this.structuredLogger.info('📊 Resultado da execução', {
        previousUrl: currentUrl.substring(0, 80) + '...',
        newUrl: newUrl.substring(0, 80) + '...',
        urlChanged: urlChanged
      });

      // Verificar se realmente houve mudança de URL (navegação)
      if (!urlChanged) {
        this.structuredLogger.warn('⚠️ URL não mudou após clique - navegação pode ter falhado', {
          url: currentUrl.substring(0, 80) + '...'
        });
        return false;
      }

      // Verificar se a nova URL não é mais o modo topo e se chegamos na página correta
      const pageAnalysis = await this.page.evaluate(() => {
        const featuredResults = document.querySelector('[aria-label="Resultados em destaque"]');
        const stillTopMode = !!featuredResults;

        // Verificar se estamos numa página de resultados de busca (não modo topo)
        const isSearchResults = document.querySelector('#search') ||
                               document.querySelector('.g') ||
                               document.querySelector('[data-ved]');

        // Verificar se há elementos típicos da página de avaliações/negócios
        const hasBusinessInfo = document.querySelector('[data-attrid="kc:/location/location:address"]') ||
                               document.querySelector('[data-attrid="kc:/business/business:phone_number"]') ||
                               document.querySelector('.review-item') ||
                               document.querySelector('[aria-label*="estrela"]');

        return {
          stillTopMode,
          isSearchResults,
          hasBusinessInfo,
          url: window.location.href
        };
      });

      if (pageAnalysis.stillTopMode) {
        this.structuredLogger.warn('⚠️ Ainda está no modo topo após clique', {
          newUrl: newUrl.substring(0, 80) + '...'
        });
        return false;
      }

      // Verificar se chegamos numa página válida de resultados
      if (!pageAnalysis.isSearchResults && !pageAnalysis.hasBusinessInfo) {
        this.structuredLogger.warn('⚠️ Não chegou numa página de resultados válida', {
          newUrl: newUrl.substring(0, 80) + '...',
          isSearchResults: pageAnalysis.isSearchResults,
          hasBusinessInfo: pageAnalysis.hasBusinessInfo
        });
        return false;
      }

      this.structuredLogger.info('✅ Correção GBP executada com sucesso', {
        previousUrl: currentUrl.substring(0, 80) + '...',
        newUrl: newUrl.substring(0, 80) + '...',
        urlChanged: true,
        noLongerTopMode: true
      });

      return true;

    } catch (error) {
      this.structuredLogger.warn('❌ Correção do modo topo falhou', {
        error: error.message,
        retryAttempt
      });
      return false;
    }
  }

  /**
   * Seleciona a melhor página para monitoramento baseada em relevância
   */
  async selectBestPageForMonitoring(pages) {
    const pageScores = [];

    for (const page of pages) {
      try {
        if (page.isClosed()) {
          continue;
        }

        const url = page.url();
        let score = 0;
        let reason = [];

        // Pontuação baseada na URL
        if (GBP_CONFIG.URL_PATTERNS.COMPLETION_PRIMARY.test(url)) {
          score += 1000; // Máxima prioridade - página de conclusão
          reason.push('URL de conclusão');
        } else if (url.includes('app.gbpcheck.com')) {
          score += 500; // Alta prioridade - domínio GBP Check
          reason.push('Domínio GBP Check');
        } else if (url.includes('google.com') && !url.includes('about:blank')) {
          score += 100; // Prioridade média - Google com conteúdo
          reason.push('Google com conteúdo');
        } else if (url === 'about:blank') {
          score -= 100; // Penalidade - página vazia
          reason.push('Página vazia (penalidade)');
        }

        // Verificar se a página tem conteúdo relevante
        try {
          const hasGBPContent = await page.evaluate(() => {
            // Procurar por indicadores de conteúdo GBP
            const gbpIndicators = [
              '[data-attrid*="business"]',
              '.review-dialog-list',
              '[jsaction*="review"]',
              '.bmh4p',
              '[aria-label*="avaliações"]',
              '[aria-label*="estrelas"]'
            ];

            return gbpIndicators.some(selector =>
              document.querySelector(selector) !== null
            );
          });

          if (hasGBPContent) {
            score += 200;
            reason.push('Conteúdo GBP detectado');
          }
        } catch (contentError) {
          // Ignorar erros de avaliação de conteúdo
        }

        // Verificar se é a página atual (pequeno bônus para estabilidade)
        if (page === this.page) {
          score += 10;
          reason.push('Página atual');
        }

        pageScores.push({
          page,
          url,
          score,
          reason: reason.join(', ')
        });

        this.structuredLogger.info(`📊 Página avaliada`, {
          url: url.substring(0, 80) + (url.length > 80 ? '...' : ''),
          score,
          reason: reason.join(', ')
        });

      } catch (pageError) {
        this.structuredLogger.warn('Erro ao avaliar página', {
          error: pageError.message
        });
        continue;
      }
    }

    // Ordenar por pontuação (maior primeiro)
    pageScores.sort((a, b) => b.score - a.score);

    if (pageScores.length > 0) {
      const bestPage = pageScores[0];
      this.structuredLogger.info('🏆 Melhor página selecionada', {
        url: bestPage.url.substring(0, 80) + (bestPage.url.length > 80 ? '...' : ''),
        score: bestPage.score,
        reason: bestPage.reason
      });

      return bestPage.page;
    }

    return null;
  }



  /**
   * Tenta URLs alternativas quando a principal falha
   */
  async tryAlternativeUrls(originalUrl) {
    const alternatives = [
      'https://www.google.com/search?q=site:google.com+maps',
      'https://www.google.com.br/search?q=google+maps',
      'https://maps.google.com',
      'https://www.google.com'
    ];

    this.structuredLogger.info('🔄 Tentando URLs alternativas', {
      originalUrl,
      alternatives: alternatives.length
    });

    for (let i = 0; i < alternatives.length; i++) {
      const altUrl = alternatives[i];

      try {
        this.structuredLogger.info(`🌐 Tentativa ${i + 1}: ${altUrl}`);

        await this.page.goto(altUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });

        this.structuredLogger.info('✅ URL alternativa funcionou', {
          alternativeUrl: altUrl,
          attempt: i + 1
        });

        return; // Sucesso

      } catch (altError) {
        this.structuredLogger.warn(`❌ URL alternativa ${i + 1} falhou`, {
          url: altUrl,
          error: altError.message
        });

        if (i === alternatives.length - 1) {
          throw new Error(`Todas as URLs alternativas falharam. Último erro: ${altError.message}`);
        }
      }
    }
  }

  /**
   * Navega com retry e diferentes estratégias
   */
  async navigateWithRetry(url) {
    const strategies = [
      {
        name: 'Estratégia 1: DOMContentLoaded rápido',
        options: { waitUntil: 'domcontentloaded', timeout: 30000 }
      },
      {
        name: 'Estratégia 2: Load completo',
        options: { waitUntil: 'load', timeout: 45000 }
      },
      {
        name: 'Estratégia 3: NetworkIdle',
        options: { waitUntil: 'networkidle', timeout: 60000 }
      },
      {
        name: 'Estratégia 4: Commit apenas',
        options: { waitUntil: 'commit', timeout: 20000 }
      }
    ];

    for (let i = 0; i < strategies.length; i++) {
      const strategy = strategies[i];

      try {
        this.structuredLogger.info(`🌐 ${strategy.name}`, {
          targetUrl: url,
          timeout: strategy.options.timeout,
          waitUntil: strategy.options.waitUntil,
          attempt: i + 1,
          totalStrategies: strategies.length
        });

        await this.page.goto(url, strategy.options);

        this.structuredLogger.info('✅ Navegação bem-sucedida', {
          strategy: strategy.name,
          attempt: i + 1
        });

        return; // Sucesso, sair do loop

      } catch (strategyError) {
        this.structuredLogger.warn(`❌ ${strategy.name} falhou`, {
          error: strategyError.message,
          attempt: i + 1,
          willRetry: i < strategies.length - 1
        });

        if (i === strategies.length - 1) {
          // Última tentativa falhou
          throw strategyError;
        }

        // Aguardar antes da próxima tentativa
        await this.page.waitForTimeout(2000);
      }
    }
  }

  /**
   * Testa conectividade básica antes da navegação
   */
  async testConnectivity() {
    try {
      this.structuredLogger.info('🌐 Testando conectividade básica');

      // Tentar navegar para uma página simples primeiro
      await this.page.goto('https://www.google.com', {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      this.structuredLogger.info('✅ Conectividade básica confirmada');

      // Aguardar um pouco
      await this.page.waitForTimeout(1000);

    } catch (connectivityError) {
      this.structuredLogger.warn('⚠️ Problema de conectividade detectado', {
        error: connectivityError.message
      });

      // Tentar uma abordagem alternativa - navegar para about:blank primeiro
      try {
        await this.page.goto('about:blank');
        this.structuredLogger.info('📄 Navegação para about:blank bem-sucedida');
      } catch (blankError) {
        this.structuredLogger.error('❌ Falha crítica de navegação', {
          error: blankError.message
        });
        throw new Error('Falha crítica de conectividade');
      }
    }
  }

  /**
   * Verifica se o GBP está carregado no modo topo usando aria-label="Resultados em destaque"
   */
  async handleGBPTopModeCorrection(retryAttempt = 0, cameFromMaps = false) {
    this.structuredLogger.setContext('method', 'handleGBPTopModeCorrection');
    this.structuredLogger.setContext('state', 'gbp_mode_check');

    try {
      const currentUrl = this.page.url();

      // Verificar se estamos numa página de busca do Google
      if (!this.isGoogleSearchUrl(currentUrl)) {
        this.structuredLogger.info('Não é página de busca do Google - pulando verificação GBP', {
          currentUrl
        });
        return false;
      }

      this.structuredLogger.info('🔍 Verificando se GBP está no modo topo', {
        currentUrl,
        indicator: 'aria-label="Resultados em destaque"',
        retryAttempt,
        cameFromMaps,
        context: cameFromMaps ? 'Redirecionado do Google Maps' : 'Acesso direto à busca'
      });

      // Aguardar carregamento da página (mais tempo se veio do Maps)
      const waitTime = cameFromMaps ? 4000 : 2000;
      this.structuredLogger.info(`⏳ Aguardando carregamento da página (${waitTime}ms)`, {
        reason: cameFromMaps ? 'Redirecionamento do Maps pode demorar mais' : 'Carregamento normal'
      });
      await this.page.waitForTimeout(waitTime);

      // Verificar se GBP está no modo topo procurando pelo botão "Avaliações"
      const gbpTopModeAnalysis = await this.page.evaluate(() => {
        // Procurar pelo elemento com aria-label="Resultados em destaque"
        const featuredResults = document.querySelector('[aria-label="Resultados em destaque"]');

        if (!featuredResults) {
          return { isTopMode: false, reason: 'Elemento "Resultados em destaque" não encontrado' };
        }

        // Procurar por links clicáveis (busca, maps, ou place)
        const searchLinks = featuredResults.querySelectorAll('a[href*="search"], a[href*="maps.google.com"], a[href*="place"]');

        if (searchLinks.length === 0) {
          return { isTopMode: false, reason: 'Nenhum link de busca/maps encontrado dentro de "Resultados em destaque"' };
        }

        // Verificar se algum dos links contém "Avaliações" ou é um link relevante
        let reviewsLink = null;
        let reviewsText = '';

        for (const link of searchLinks) {
          const linkText = link.textContent || link.innerText || '';
          const hasReviewsText = linkText.toLowerCase().includes('avaliações') ||
                                linkText.toLowerCase().includes('avaliacoes') ||
                                linkText.toLowerCase().includes('reviews') ||
                                linkText.toLowerCase().includes('ver mais');

          // Aceitar links que contenham texto de avaliações OU sejam links do Maps/Place
          const isRelevantLink = hasReviewsText ||
                                link.href.includes('maps.google.com') ||
                                link.href.includes('place') ||
                                link.href.includes('tbm=lcl');

          if (isRelevantLink && link.href) {
            reviewsLink = link;
            reviewsText = linkText.trim();
            break;
          }
        }

        if (!reviewsLink) {
          return {
            isTopMode: false,
            reason: 'Links de busca encontrados mas nenhum contém "Avaliações"',
            linksFound: searchLinks.length,
            linkTexts: Array.from(searchLinks).map(l => l.textContent?.trim()).slice(0, 3)
          };
        }

        return {
          isTopMode: true,
          reason: 'Modo topo detectado - link "Avaliações" clicável encontrado',
          reviewsButtonText: reviewsText,
          hasClickableLink: true,
          linkHref: reviewsLink.href.substring(0, 100) + '...',
          totalSearchLinks: searchLinks.length
        };
      });

      this.structuredLogger.info('📊 Resultado da verificação GBP', {
        isTopMode: gbpTopModeAnalysis.isTopMode,
        reason: gbpTopModeAnalysis.reason,
        reviewsButtonText: gbpTopModeAnalysis.reviewsButtonText,
        hasClickableLink: gbpTopModeAnalysis.hasClickableLink,
        linkHref: gbpTopModeAnalysis.linkHref,
        currentUrl: currentUrl.substring(0, 80) + '...'
      });

      if (!gbpTopModeAnalysis.isTopMode) {
        this.structuredLogger.info('✅ GBP não está no modo topo', {
          reason: gbpTopModeAnalysis.reason,
          currentUrl: currentUrl.substring(0, 80) + '...'
        });
        return false;
      }

      // Procurar pelo botão "Avaliações" que aparece no modo topo
      this.structuredLogger.info('🗺️ GBP está no modo topo - procurando botão "Avaliações" clicável', {
        currentUrl: currentUrl.substring(0, 80) + '...',
        targetElement: '[aria-label="Resultados em destaque"]'
      });

      let reviewsButton = null;
      let foundSelector = null;

      // Tentar seletores específicos para o botão "Avaliações" no modo topo
      for (const selector of GBP_CONFIG.SELECTORS.GBP_REVIEWS_BUTTON) {
        try {
          this.structuredLogger.info(`🔍 Tentando seletor: ${selector}`);

          // Procurar o elemento
          const element = await this.page.waitForSelector(selector, {
            timeout: GBP_CONFIG.TIMEOUTS.REVIEWS_BUTTON_SEARCH,
            state: 'visible'
          });

          if (element && await element.isVisible()) {
            // Verificação mais rigorosa do elemento
            const elementInfo = await element.evaluate((el) => {
              // Verificar se é um link clicável
              const isLink = el.tagName.toLowerCase() === 'a';
              const hasHref = el.href && el.href.length > 0;

              // Obter texto do elemento e elementos filhos
              const elementText = el.textContent || '';
              const innerText = el.innerText || '';

              // Verificar se contém "Avaliações" no texto
              const hasReviewsText = elementText.toLowerCase().includes('avaliações') ||
                                   elementText.toLowerCase().includes('avaliacoes') ||
                                   innerText.toLowerCase().includes('avaliações') ||
                                   innerText.toLowerCase().includes('avaliacoes');

              // Verificar se o href contém parâmetros de busca ou maps
              const hasSearchParams = hasHref && (
                el.href.includes('search') ||
                el.href.includes('tbm=lcl') ||
                el.href.includes('maps.google.com') ||
                el.href.includes('place') ||
                el.href.includes('maps')
              );

              return {
                isLink,
                hasHref,
                href: hasHref ? el.href : null,
                elementText: elementText.trim(),
                innerText: innerText.trim(),
                hasReviewsText,
                hasSearchParams,
                tagName: el.tagName.toLowerCase(),
                className: el.className
              };
            });

            this.structuredLogger.info('🔍 Análise detalhada do elemento encontrado', {
              selector,
              ...elementInfo
            });

            // Verificar se é um link clicável válido (mais flexível quando vem do Maps)
            const isValidLink = elementInfo.isLink && elementInfo.hasHref &&
              (elementInfo.hasReviewsText || elementInfo.hasSearchParams || cameFromMaps);

            if (isValidLink) {
              reviewsButton = element;
              foundSelector = selector;
              this.structuredLogger.info('✅ Botão "Avaliações" encontrado e verificado', {
                selector,
                buttonText: elementInfo.elementText,
                href: elementInfo.href?.substring(0, 100) + '...',
                visible: true,
                cameFromMaps,
                validationCriteria: {
                  hasReviewsText: elementInfo.hasReviewsText,
                  hasSearchParams: elementInfo.hasSearchParams,
                  flexibleForMaps: cameFromMaps
                }
              });
              break;
            } else {
              this.structuredLogger.warn(`⚠️ Elemento encontrado mas não atende critérios`, {
                selector,
                isLink: elementInfo.isLink,
                hasHref: elementInfo.hasHref,
                hasReviewsText: elementInfo.hasReviewsText,
                hasSearchParams: elementInfo.hasSearchParams,
                elementText: elementInfo.elementText || 'sem texto',
                cameFromMaps
              });
            }
          }
        } catch (e) {
          this.structuredLogger.warn(`❌ Seletor falhou: ${selector}`, {
            error: e.message
          });
          continue;
        }
      }

      if (!reviewsButton) {
        this.structuredLogger.warn('❌ Botão "Avaliações" não encontrado no modo topo', {
          selectorsUsed: GBP_CONFIG.SELECTORS.GBP_REVIEWS_BUTTON.length,
          currentUrl: currentUrl.substring(0, 80) + '...',
          reason: 'Nenhum seletor encontrou um botão "Avaliações" clicável'
        });
        return false;
      }

      // Adicionar delay antes da tentativa se for retry
      if (retryAttempt > 0) {
        this.structuredLogger.info('⏳ Aguardando antes de tentar novamente', {
          retryAttempt,
          delaySeconds: '2-3 segundos'
        });
        await this.stealthManager.humanDelay(2000, 3000);
      }

      // Executar correção (sempre usa a mesma estratégia de navegação na mesma página)
      const success = await this.executeGBPTopModeCorrection(reviewsButton, foundSelector, currentUrl, retryAttempt);

      if (success) {
        this.gbpModeFixed = true;
        this.structuredLogger.info('✅ Modo GBP corrigido com sucesso', {
          retryAttempt,
          totalAttempts: retryAttempt + 1
        });
        return true;
      }

      // Se falhou, verificar estado final
      const finalUrl = this.page.url();
      const stillInTopMode = await this.page.evaluate(() => {
        const featuredResults = document.querySelector('[aria-label="Resultados em destaque"]');
        return !!featuredResults;
      });

      this.structuredLogger.warn('❌ Correção GBP falhou nesta tentativa', {
        currentUrl: finalUrl.substring(0, 80) + '...',
        stillInTopMode: stillInTopMode,
        retryAttempt,
        willRetry: retryAttempt < 2 // Indica se haverá nova tentativa
      });

      return false;

    } catch (error) {
      this.structuredLogger.warn('Erro ao corrigir modo de visualização do GBP', {
        error: error.message,
        currentUrl: this.page.url()
      });
      return false;
    }
  }

  /**
   * Redireciona do Google Maps para a página de pesquisa usando o botão da extensão
   */
  async handleGoogleMapsRedirect() {
    this.structuredLogger.setContext('method', 'handleGoogleMapsRedirect');
    this.structuredLogger.setContext('state', 'maps_redirect');

    try {
      const currentUrl = this.page.url();
      this.structuredLogger.info(GBP_CONFIG.MESSAGES.MAPS_DETECTED, {
        currentUrl,
        redirecting: true
      });

      // Aguardar carregamento do Google Maps (10 segundos)
      this.structuredLogger.info('Aguardando carregamento completo do Google Maps', {
        waitTime: GBP_CONFIG.TIMEOUTS.MAPS_LOADING
      });

      await this.page.waitForTimeout(GBP_CONFIG.TIMEOUTS.MAPS_LOADING);

      // Aguardar que a extensão carregue e adicione o botão
      await this.page.waitForLoadState('domcontentloaded');
      await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
        // Ignorar timeout de networkidle - Maps pode ter requests contínuos
      });

      // Procurar pelo botão "Ver na Pesquisa" da extensão
      let redirectButton = null;
      for (const selector of GBP_CONFIG.SELECTORS.MAPS_TO_SEARCH_BUTTON) {
        try {
          this.structuredLogger.info(`Procurando botão "Ver na Pesquisa"`, {
            selector,
            timeout: GBP_CONFIG.TIMEOUTS.MAPS_TO_SEARCH_BUTTON
          });

          redirectButton = await this.page.waitForSelector(selector, {
            timeout: GBP_CONFIG.TIMEOUTS.MAPS_TO_SEARCH_BUTTON,
            state: 'visible'
          });

          if (redirectButton && await redirectButton.isVisible()) {
            this.structuredLogger.info('Botão "Ver na Pesquisa" encontrado', {
              selector,
              visible: true
            });
            break;
          }
        } catch (e) {
          this.structuredLogger.warn(`Seletor não encontrou botão`, {
            selector,
            error: e.message
          });
          continue;
        }
      }

      if (!redirectButton) {
        this.structuredLogger.error('Botão "Ver na Pesquisa" não encontrado', {
          selectorsUsed: GBP_CONFIG.SELECTORS.MAPS_TO_SEARCH_BUTTON,
          currentUrl
        });
        return false;
      }

      // Simular interação humana antes do clique
      await this.stealthManager.simulateHumanInteraction(redirectButton);

      // Obter URL de destino antes do clique
      const targetUrl = await redirectButton.getAttribute('href');
      this.structuredLogger.info('Clicando no botão "Ver na Pesquisa"', {
        targetUrl,
        currentUrl
      });

      // Clicar no botão (abrirá nova aba)
      await redirectButton.click();

      // Aguardar nova aba abrir
      await this.page.waitForTimeout(3000);

      // Verificar se nova aba foi aberta
      const pages = this.context.pages();
      if (pages.length > 1) {
        // Usar a nova aba (última)
        this.page = pages[pages.length - 1];
        await this.page.bringToFront();

        // Rastrear a nova página criada
        this.automationPages.add(this.page);

        const newUrl = this.page.url();
        this.structuredLogger.info(GBP_CONFIG.MESSAGES.MAPS_REDIRECT_SUCCESS, {
          previousUrl: currentUrl,
          newUrl,
          totalPages: pages.length,
          trackedPages: this.automationPages.size
        });

        // Aguardar carregamento da nova página
        await this.page.waitForLoadState('domcontentloaded');

        // Marcar que veio do Maps para ajustar comportamento posterior
        this.cameFromMaps = true;
        this.structuredLogger.info('🗺️ Flag cameFromMaps definida - comportamento ajustado para origem Maps');

        return true;
      } else {
        this.structuredLogger.warn('Nova aba não foi aberta após clique', {
          totalPages: pages.length
        });
        return false;
      }

    } catch (error) {
      this.structuredLogger.error(GBP_CONFIG.MESSAGES.MAPS_REDIRECT_FAILED, error, {
        currentUrl: this.page.url()
      });
      return false;
    }
  }

  async findAndClickButton(selectors = null, maxRetries = 5) {
    this.structuredLogger.setContext('method', 'findAndClickButton');
    this.structuredLogger.setContext('state', 'searching_button');

    if (!selectors) {
      selectors = GBP_CONFIG.SELECTORS.START_BUTTONS;
      this.structuredLogger.info('Usando seletores padrão do GBP Check', {
        selectorCount: selectors.length
      });
    } else {
      this.structuredLogger.info('Usando seletores personalizados fornecidos', {
        selectorCount: selectors.length,
        customSelectors: selectors
      });
    }

    // ✅ REMOVIDO: Verificação inicial do modo GBP movida para APÓS Maps redirect no fluxo principal
    // A verificação agora acontece no momento correto, após a página estar completamente carregada

    this.structuredLogger.info('🔍 Iniciando busca de botão com sistema de alternância', {
      maxRetries,
      strategy: 'Alternar entre busca de botão e verificação de modo GBP a cada 2-3 tentativas falhadas'
    });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.structuredLogger.info(`Tentativa ${attempt}/${maxRetries} - Procurando botão GBP Check`, {
          attempt,
          maxRetries,
          currentUrl: this.page.url()
        });

        // Simular comportamento humano antes de procurar botão
        await this.stealthManager.humanDelay(1500, 3000);
        await this.stealthManager.simulateHumanMouseMovement(this.page);

        // Aguardar página carregar completamente
        try {
          await this.page.waitForLoadState('domcontentloaded', { timeout: 15000 });
          await this.page.waitForLoadState('networkidle', { timeout: 10000 });
        } catch (loadError) {
          logger.warn(`⚠️ Timeout aguardando carregamento: ${loadError.message}`);
        }

        // Tentar cada seletor
        for (const selector of selectors) {
          try {
            this.structuredLogger.info(`Tentando seletor GBP Check`, {
              selector,
              attempt,
              timeout: GBP_CONFIG.TIMEOUTS.BUTTON_SEARCH
            });

            // Aguardar elemento aparecer com timeout configurado
            const element = await this.page.waitForSelector(selector, {
              timeout: GBP_CONFIG.TIMEOUTS.BUTTON_SEARCH,
              state: 'visible'
            });

            if (element && await element.isVisible()) {
              // Simular interação humana antes do clique
              await this.stealthManager.simulateHumanInteraction(element);

              // Clique com comportamento humano
              await element.click();
              this.structuredLogger.setContext('state', 'button_clicked');
              this.structuredLogger.info(`Botão GBP Check clicado com sucesso`, {
                selector,
                clickedAt: new Date().toISOString()
              });
              this.structuredLogger.info(GBP_CONFIG.MESSAGES.PASSIVE_MODE, {
                mode: 'passive',
                chromeExtensionControl: true
              });

              // Delay mínimo pós-clique apenas para confirmar o clique
              await this.stealthManager.humanDelay(1000, 2000);

              // Verificar se o clique teve efeito (mudança de URL ou novo elemento)
              const currentUrl = this.page.url();
              this.structuredLogger.info(`URL após clique do botão GBP Check`, {
                currentUrl,
                previousUrl: this.structuredLogger.context.url || 'unknown'
              });
              this.structuredLogger.setContext('state', 'entering_passive_mode');

              return true;
            }
          } catch (e) {
            this.structuredLogger.warn(`Seletor GBP Check não funcionou`, {
              selector,
              error: e.message,
              attempt
            });
            continue;
          }
        }

        // Se chegou aqui, nenhum seletor funcionou nesta tentativa
        if (attempt < maxRetries) {
          logger.warn(`⚠️ Tentativa ${attempt} falhou, aguardando antes da próxima...`);

          // ALTERNÂNCIA INTELIGENTE: A cada 2-3 tentativas falhadas, verificar modo GBP
          if (attempt % 3 === 0 || (attempt % 2 === 0 && attempt > 2)) {
            this.structuredLogger.info('🔄 Alternando para verificação do modo GBP', {
              failedAttempts: attempt,
              reason: 'Múltiplas tentativas de botão falharam - verificando se ainda está no modo topo'
            });

            // Verificar se ainda está no modo topo ou se precisa correção
            const gbpCorrected = await this.handleGBPTopModeCorrection(Math.floor(attempt / 2), this.cameFromMaps);

            if (gbpCorrected) {
              this.structuredLogger.info('✅ Modo GBP corrigido durante retry - aguardando estabilização');
              await this.stealthManager.humanDelay(5000, 7000);

              // Verificar se realmente saiu do modo topo
              const stillTopMode = await this.page.evaluate(() => {
                return !!document.querySelector('[aria-label="Resultados em destaque"]');
              });

              if (stillTopMode) {
                this.structuredLogger.warn('⚠️ Ainda no modo topo após correção - continuando busca normal');
              } else {
                this.structuredLogger.info('✅ Confirmado: saiu do modo topo - tentando botão imediatamente');
                // Após correção bem-sucedida, tentar novamente imediatamente
                continue;
              }
            } else {
              this.structuredLogger.warn('❌ Correção do modo GBP falhou - continuando busca de botão');
            }
          }

          await this.stealthManager.humanDelay(3000, 6000);

          // Tentar scroll e refresh da página
          try {
            await this.page.evaluate(() => {
              window.scrollTo(0, 0);
              setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 1000);
            });
            await this.stealthManager.humanDelay(2000, 3000);
          } catch (scrollError) {
            logger.warn(`⚠️ Erro ao fazer scroll: ${scrollError.message}`);
          }
        }

      } catch (error) {
        logger.error(`❌ Erro na tentativa ${attempt}: ${error.message}`);
        if (attempt < maxRetries) {
          await this.stealthManager.humanDelay(5000, 8000);
        }
      }
    }

    // Todas as tentativas falharam

    this.structuredLogger.error(GBP_CONFIG.MESSAGES.BUTTON_NOT_FOUND, null, {
      maxRetries,
      selectorsUsed: selectors,
      finalUrl: this.page.url(),
      gbpCorrectionAttempted: gbpCorrected
    });
    return false;
  }

  async waitForCompletionPassive(waitTime = 600) {
    // MONITORAMENTO COMPLETAMENTE PASSIVO
    // ✅ PERMITIDO: Verificar URLs, logs, mudanças de página
    // ❌ PROIBIDO: Cliques, fechamento de popups, interações, mudanças de aba

    this.structuredLogger.setContext('method', 'waitForCompletionPassive');
    this.structuredLogger.setContext('state', 'passive_monitoring');

    try {
      this.structuredLogger.info(`Iniciando monitoramento passivo GBP Check`, {
        maxWaitTime: waitTime,
        targetUrl: 'app.gbpcheck.com/extension/healthcheck',
        checkInterval: '5 segundos',
        mode: 'url_only_detection_with_auto_close',
        patterns: {
          primary: GBP_CONFIG.URL_PATTERNS.COMPLETION_PRIMARY.source,
          secondary: GBP_CONFIG.URL_PATTERNS.COMPLETION_SECONDARY.length,
          generic: GBP_CONFIG.URL_PATTERNS.COMPLETION_GENERIC.length
        }
      });

      const startTime = Date.now();
      let lastUrl = this.page.url();
      this.structuredLogger.setContext('initialUrl', lastUrl);

      while (Date.now() - startTime < waitTime * 1000) {
        try {
          // APENAS verificar se página ainda existe - SEM recuperação ativa
          if (this.page.isClosed()) {
            this.structuredLogger.warn('Página fechada durante monitoramento passivo', {
              elapsedTime: Date.now() - startTime
            });
            const pages = this.context.pages();
            if (pages.length > 0) {
              this.page = pages[pages.length - 1];
              this.structuredLogger.info('Usando página mais recente disponível', {
                totalPages: pages.length
              });
            } else {
              this.structuredLogger.error('Nenhuma página disponível para monitoramento');
              break;
            }
          }

          // Monitoramento passivo - SEM ações, apenas observação

          // Verificação de múltiplas abas - procurar URL de conclusão em qualquer aba
          const pages = this.context.pages();
          if (pages.length > 1) {
            this.structuredLogger.info(`📑 ${pages.length} abas detectadas - verificando URLs`, {
              reason: 'Procurando URL de conclusão em todas as abas'
            });

            // Procurar URL de conclusão em qualquer aba
            for (const page of pages) {
              try {
                if (page.isClosed()) continue;

                const pageUrl = page.url();
                if (GBP_CONFIG.URL_PATTERNS.COMPLETION_PRIMARY.test(pageUrl)) {
                  this.structuredLogger.info('🎯 URL de conclusão encontrada em outra aba', {
                    completionUrl: pageUrl,
                    currentMonitoredUrl: currentUrl,
                    switchingToCompletionPage: true
                  });

                  // Mudar para a página de conclusão
                  this.page = page;

                  return {
                    completed: true,
                    method: 'primary_url_other_tab',
                    url: pageUrl,
                    auto_close_pending: true
                  };
                }
              } catch (pageError) {
                // Ignorar páginas inacessíveis
                continue;
              }
            }
          }

          // Monitoramento passivo - SEM aguardar carregamento (pode interferir)

          // APENAS verificar mudanças na URL - SEM ações
          const currentUrl = this.page.url();
          if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            this.structuredLogger.info(`URL mudou durante monitoramento passivo`, {
              previousUrl: lastUrl,
              currentUrl,
              elapsedTime: Date.now() - startTime
            });
            this.structuredLogger.setContext('currentUrl', currentUrl);
          }

          // Log de monitoramento a cada verificação (mais discreto)
          const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
          const elapsedSeconds = Math.floor(((Date.now() - startTime) % 60000) / 1000);

          // Log com informações de múltiplas abas
          const allPages = this.context.pages();
          const isCompletionUrl = GBP_CONFIG.URL_PATTERNS.COMPLETION_PRIMARY.test(currentUrl);

          // Verificar URLs de todas as abas para o log
          const allUrls = [];
          let hasCompletionUrlInAnyTab = false;

          for (const page of allPages) {
            try {
              if (!page.isClosed()) {
                const url = page.url();
                const isCurrentPage = page === this.page;
                const isCompletion = GBP_CONFIG.URL_PATTERNS.COMPLETION_PRIMARY.test(url);

                if (isCompletion) hasCompletionUrlInAnyTab = true;

                allUrls.push({
                  url: url.substring(0, 50) + (url.length > 50 ? '...' : ''),
                  current: isCurrentPage,
                  completion: isCompletion
                });
              }
            } catch (e) {
              allUrls.push({ url: 'inaccessible', current: false, completion: false });
            }
          }

          this.structuredLogger.info('🔍 Monitoramento passivo ativo', {
            currentUrl: currentUrl.length > 80 ? currentUrl.substring(0, 80) + '...' : currentUrl,
            elapsed: `${elapsedMinutes}m ${elapsedSeconds}s`,
            nextCheck: '5s',
            targetPattern: 'app.gbpcheck.com/extension/healthcheck',
            totalTabs: allPages.length,
            hasCompletionUrl: hasCompletionUrlInAnyTab,
            tabs: allUrls
          });

          // ✅ VERIFICAÇÃO PRIMÁRIA - URL DE CONCLUSÃO (COM FECHAMENTO AUTOMÁTICO)
          if (GBP_CONFIG.URL_PATTERNS.COMPLETION_PRIMARY.test(currentUrl)) {
            this.structuredLogger.info(GBP_CONFIG.MESSAGES.COMPLETION_DETECTED, {
              detectionMethod: 'primary_url_pattern',
              completionUrl: currentUrl,
              elapsedTime: Date.now() - startTime,
              autoCloseTriggered: true
            });

            this.structuredLogger.info(GBP_CONFIG.MESSAGES.AUTO_CLOSE_DELAYED, {
              reason: 'Aguardando resposta ser enviada antes de fechar browser',
              completionUrl: currentUrl
            });

            // NÃO executar fechamento automático aqui - será feito após a resposta
            return {
              completed: true,
              method: 'primary_url',
              url: currentUrl,
              auto_close_pending: true // Flag para indicar que fechamento deve ser feito depois
            };
          }

          // Verificação de padrões secundários

          // ✅ VERIFICAÇÃO SECUNDÁRIA - OUTROS PADRÕES GBP CHECK
          for (const pattern of GBP_CONFIG.URL_PATTERNS.COMPLETION_SECONDARY) {
            if (pattern.test(currentUrl)) {
              this.structuredLogger.info(GBP_CONFIG.MESSAGES.COMPLETION_DETECTED, {
                detectionMethod: 'secondary_url_pattern',
                pattern: pattern.source,
                completionUrl: currentUrl,
                elapsedTime: Date.now() - startTime
              });
              return { completed: true, method: 'secondary_url', url: currentUrl };
            }
          }

          // ✅ VERIFICAÇÃO GENÉRICA - PADRÕES DE CONCLUSÃO GERAIS (FALLBACK)
          try {
            for (const pattern of GBP_CONFIG.URL_PATTERNS.COMPLETION_GENERIC) {
              if (pattern.test(currentUrl)) {
                this.structuredLogger.info('Conclusão detectada por padrão genérico de URL', {
                  detectionMethod: 'generic_url_pattern',
                  pattern: pattern.source,
                  completionUrl: currentUrl,
                  elapsedTime: Date.now() - startTime
                });
                return { completed: true, method: 'generic_url', url: currentUrl };
              }
            }
          } catch (genericError) {
            this.structuredLogger.warn('Erro na verificação genérica de padrões', {
              error: genericError.message,
              currentUrl,
              elapsedTime: Date.now() - startTime
            });
          }

          // Delay PASSIVO - sem comportamento humano simulado
          await this.page.waitForTimeout(GBP_CONFIG.TIMEOUTS.PASSIVE_MONITORING);

        } catch (error) {
          this.structuredLogger.warn('Erro durante monitoramento passivo', {
            error: error.message,
            elapsedTime: Date.now() - startTime
          });
          // SEM recuperação ativa - apenas continuar
          await this.page.waitForTimeout(3000);
        }
      }

      this.structuredLogger.info(GBP_CONFIG.MESSAGES.TIMEOUT_REACHED, {
        totalWaitTime: waitTime,
        elapsedTime: Date.now() - startTime,
        finalUrl: this.page.url()
      });
      return { completed: false, method: 'timeout', url: this.page.url() };

    } catch (error) {
      this.structuredLogger.error('Erro crítico na espera passiva', error, {
        elapsedTime: Date.now() - startTime
      });
      return { completed: false, method: 'error', error: error.message };
    }
  }


  
  async takeScreenshot() {
    try {
      const pages = this.context.pages();
      const finalPage = pages.length > 0 ? pages[pages.length - 1] : this.page;
      
      if (finalPage && !finalPage.isClosed()) {
        const screenshotBuffer = await finalPage.screenshot({ 
          fullPage: true,
          type: 'png'
        });
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `screenshot-${timestamp}.png`;
        const filePath = path.join(screenshotsDir, fileName);
        
        fs.writeFileSync(filePath, screenshotBuffer);
        logger.info(`Screenshot salvo: ${fileName}`);
        
        return `/screenshots/${fileName}`;
      }
      
      return null;
      
    } catch (error) {
      logger.warn(`Erro ao capturar screenshot: ${error.message}`);
      return null;
    }
  }
  
  getPageInfo() {
    try {
      const pages = this.context.pages();
      const finalPage = pages.length > 0 ? pages[pages.length - 1] : this.page;
      
      if (finalPage && !finalPage.isClosed()) {
        return {
          url: finalPage.url(),
          title: '', // Remover await aqui pois não é função async
          timestamp: new Date().toISOString()
        };
      }
      
      return { timestamp: new Date().toISOString() };
      
    } catch (error) {
      logger.error(`Erro ao obter info da página: ${error.message}`);
      return { timestamp: new Date().toISOString() };
    }
  }

}

// Automation Queue System
class AutomationQueue {
  constructor(maxSize = 10) {
    this.maxSize = maxSize;
    this.queue = [];
    this.currentJob = null;
    this.isProcessing = false;
    this.completedJobs = [];
    this.maxCompletedHistory = 50;
    this.averageCompletionTime = 120000; // 2 minutes default
    this.completionTimes = [];
    this.maxCompletionSamples = 10;
  }

  /**
   * Add a new job to the queue
   */
  add(sessionId, url, params) {
    // Check if queue is full
    if (this.queue.length >= this.maxSize) {
      logger.warn('Queue is full, rejecting new request', {
        queueSize: this.queue.length,
        maxSize: this.maxSize,
        sessionId: sessionId
      });
      return {
        success: false,
        error: 'Queue is full',
        queueSize: this.queue.length,
        maxSize: this.maxSize
      };
    }

    const job = {
      sessionId: sessionId,
      url: url,
      params: params,
      status: 'queued',
      addedAt: Date.now(),
      startedAt: null,
      completedAt: null,
      position: this.queue.length + 1
    };

    this.queue.push(job);

    logger.info('Job added to queue', {
      sessionId: sessionId,
      position: job.position,
      queueSize: this.queue.length,
      currentlyProcessing: this.currentJob ? this.currentJob.sessionId : null
    });

    // Start processing if not already processing
    if (!this.isProcessing) {
      this.processNext();
    }

    return {
      success: true,
      position: job.position,
      queueSize: this.queue.length,
      estimatedWaitSeconds: this.calculateEstimatedWait(job.position)
    };
  }

  /**
   * Calculate estimated wait time based on position and average completion time
   */
  calculateEstimatedWait(position) {
    if (position === 1 && !this.currentJob) {
      return 0; // Will start immediately
    }

    // If there's a current job, add its estimated remaining time
    let estimatedWait = 0;
    if (this.currentJob) {
      const elapsed = Date.now() - this.currentJob.startedAt;
      const remaining = Math.max(0, this.averageCompletionTime - elapsed);
      estimatedWait += remaining;
    }

    // Add estimated time for jobs ahead in queue
    const jobsAhead = this.currentJob ? position - 1 : position;
    estimatedWait += (jobsAhead * this.averageCompletionTime);

    return Math.round(estimatedWait / 1000); // Return in seconds
  }

  /**
   * Update average completion time based on recent completions
   */
  updateAverageCompletionTime(completionTime) {
    this.completionTimes.push(completionTime);

    // Keep only recent samples
    if (this.completionTimes.length > this.maxCompletionSamples) {
      this.completionTimes.shift();
    }

    // Calculate average
    const sum = this.completionTimes.reduce((a, b) => a + b, 0);
    this.averageCompletionTime = Math.round(sum / this.completionTimes.length);

    logger.info('Updated average completion time', {
      averageMs: this.averageCompletionTime,
      averageSeconds: Math.round(this.averageCompletionTime / 1000),
      samples: this.completionTimes.length
    });
  }

  /**
   * Process the next job in the queue
   */
  async processNext() {
    if (this.isProcessing) {
      logger.warn('Already processing a job, skipping processNext');
      return;
    }

    if (this.queue.length === 0) {
      logger.info('Queue is empty, nothing to process');
      this.isProcessing = false;
      this.currentJob = null;
      return;
    }

    // Get next job
    const job = this.queue.shift();
    this.currentJob = job;
    this.isProcessing = true;

    job.status = 'processing';
    job.startedAt = Date.now();

    logger.info('Starting job from queue', {
      sessionId: job.sessionId,
      url: job.url,
      queuedFor: job.startedAt - job.addedAt,
      remainingInQueue: this.queue.length
    });

    try {
      // Execute the automation
      await runAutomationInBackground(
        job.sessionId,
        job.url,
        job.params.wait_time,
        job.params.button_selectors,
        job.params.headless,
        job.params.sessionLogger,
        job.params.startTime,
        job.params.name
      );

      // Mark as completed
      job.status = 'completed';
      job.completedAt = Date.now();
      const completionTime = job.completedAt - job.startedAt;

      // Update average completion time
      this.updateAverageCompletionTime(completionTime);

      logger.info('Job completed successfully', {
        sessionId: job.sessionId,
        duration: completionTime,
        averageCompletionTime: this.averageCompletionTime
      });

    } catch (error) {
      job.status = 'failed';
      job.completedAt = Date.now();
      job.error = error.message;

      logger.error('Job failed', {
        sessionId: job.sessionId,
        error: error.message,
        duration: job.completedAt - job.startedAt
      });
    }

    // Move to completed history
    this.completedJobs.unshift(job);
    if (this.completedJobs.length > this.maxCompletedHistory) {
      this.completedJobs.pop();
    }

    // Mark as not processing and process next
    this.isProcessing = false;
    this.currentJob = null;

    // Process next job if available
    if (this.queue.length > 0) {
      logger.info('Processing next job in queue', {
        remainingJobs: this.queue.length
      });
      setImmediate(() => this.processNext());
    } else {
      logger.info('Queue is now empty');
    }
  }

  /**
   * Get current queue status
   */
  getStatus() {
    return {
      isProcessing: this.isProcessing,
      currentJob: this.currentJob ? {
        sessionId: this.currentJob.sessionId,
        url: this.currentJob.url,
        status: this.currentJob.status,
        startedAt: this.currentJob.startedAt,
        elapsedSeconds: Math.round((Date.now() - this.currentJob.startedAt) / 1000)
      } : null,
      queueSize: this.queue.length,
      maxSize: this.maxSize,
      queuedJobs: this.queue.map((job, index) => ({
        sessionId: job.sessionId,
        url: job.url,
        position: index + 1,
        status: job.status,
        addedAt: job.addedAt,
        waitingSeconds: Math.round((Date.now() - job.addedAt) / 1000),
        estimatedWaitSeconds: this.calculateEstimatedWait(index + 1)
      })),
      recentCompletedJobs: this.completedJobs.slice(0, 10).map(job => ({
        sessionId: job.sessionId,
        status: job.status,
        duration: job.completedAt - job.startedAt,
        completedAt: job.completedAt
      })),
      averageCompletionTimeSeconds: Math.round(this.averageCompletionTime / 1000)
    };
  }

  /**
   * Get job position in queue
   */
  getJobPosition(sessionId) {
    if (this.currentJob && this.currentJob.sessionId === sessionId) {
      return {
        status: 'processing',
        position: 0,
        estimatedWaitSeconds: 0
      };
    }

    const index = this.queue.findIndex(job => job.sessionId === sessionId);
    if (index === -1) {
      // Check completed jobs
      const completed = this.completedJobs.find(job => job.sessionId === sessionId);
      if (completed) {
        return {
          status: completed.status,
          position: -1,
          estimatedWaitSeconds: 0
        };
      }
      return null;
    }

    return {
      status: 'queued',
      position: index + 1,
      estimatedWaitSeconds: this.calculateEstimatedWait(index + 1)
    };
  }

  /**
   * Remove a job from queue (if not yet processing)
   */
  remove(sessionId) {
    const index = this.queue.findIndex(job => job.sessionId === sessionId);
    if (index === -1) {
      return false;
    }

    const job = this.queue.splice(index, 1)[0];
    logger.info('Job removed from queue', {
      sessionId: sessionId,
      wasAtPosition: index + 1
    });

    return true;
  }
}

// Create global queue instance
const automationQueue = new AutomationQueue(10); // Max 10 jobs in queue

// Health check
app.get('/health', (_, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Playwright Automation Service'
  });
});

// Endpoint para visualizar dados interceptados da última sessão
let lastAutomationInstance = null;
let automationSessions = new Map(); // Armazenar sessões ativas

// Queue status endpoint
app.get('/queue-status', (_, res) => {
  try {
    const status = automationQueue.getStatus();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      queue: status
    });
  } catch (error) {
    logger.error('Error getting queue status', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get specific job position in queue
app.get('/queue-position/:sessionId', (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const position = automationQueue.getJobPosition(sessionId);

    if (!position) {
      return res.status(404).json({
        success: false,
        error: 'Job not found in queue or history'
      });
    }

    res.json({
      success: true,
      sessionId: sessionId,
      ...position
    });
  } catch (error) {
    logger.error('Error getting job position', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api-data', (_, res) => {
  try {
    if (!lastAutomationInstance) {
      return res.json({
        success: false,
        message: 'Nenhuma sessão de automação encontrada',
        data: null
      });
    }

    const interceptedData = lastAutomationInstance.getInterceptedAPIData();
    const gbpData = lastAutomationInstance.extractGBPCheckData();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        total_requests: interceptedData.total_requests,
        health_check_requests: gbpData.health_check_data.length,
        user_email: gbpData.user_info.email || 'not_found',
        reference_key: gbpData.place_data.reference_key || 'not_found'
      },
      gbp_check_data: gbpData,
      raw_requests: interceptedData.requests,
      detailed_data: interceptedData.detailed_data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Erro ao obter dados interceptados'
    });
  }
});

// Endpoint para verificar status de sessão específica
app.get('/status/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;

  try {
    const session = automationSessions.get(sessionId);

    if (!session) {
      return res.json({
        success: false,
        message: 'Sessão não encontrada',
        sessionId: sessionId
      });
    }

    res.json({
      success: true,
      sessionId: sessionId,
      status: session.status,
      startTime: session.startTime,
      lastUpdate: session.lastUpdate,
      elapsedTime: Date.now() - session.startTime,
      data: session.data || null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Erro ao verificar status da sessão'
    });
  }
});



// Endpoint principal de automação
app.post('/automate', async (req, res) => {
  const startTime = Date.now();
  const sessionId = `automation_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const sessionLogger = new StructuredLogger(sessionId, { endpoint: '/automate' });

  try {
    // Extrair parâmetros do request body
    const requestData = req.body || {};
    const url = requestData.url;
    const wait_time = requestData.wait_time || 300;
    const button_selectors = requestData.button_selectors || [];
    const headless = requestData.headless !== undefined ? requestData.headless : false;
    const name = requestData.name || null;

    // Validação básica
    if (!url) {
      sessionLogger.error('URL obrigatória não fornecida na requisição');
      return res.status(400).json({ error: 'URL é obrigatória' });
    }

    // Validar campo name se fornecido
    if (name !== null && typeof name !== 'string') {
      sessionLogger.error('Campo "name" deve ser uma string', {
        receivedType: typeof name,
        receivedValue: name
      });
      return res.status(400).json({
        error: 'Campo "name" inválido',
        details: 'O campo "name" deve ser uma string',
        receivedType: typeof name
      });
    }

    // Limpar URL removendo caracteres inválidos
    const cleanedUrl = url.trim().replace(/[\t\n\r]/g, '');

    // Validar se a URL é válida
    try {
      new URL(cleanedUrl);
    } catch (urlError) {
      sessionLogger.error('URL inválida fornecida', {
        originalUrl: url,
        cleanedUrl: cleanedUrl,
        error: urlError.message
      });
      return res.status(400).json({
        error: 'URL inválida',
        details: urlError.message,
        receivedUrl: url
      });
    }

    sessionLogger.info(`Automação GBP Check solicitada`, {
      sessionId: sessionId,
      targetUrl: cleanedUrl,
      waitTime: wait_time,
      headless: headless,
      name: name
    });

    // Registrar sessão para polling de status
    automationSessions.set(sessionId, {
      status: 'queued',
      startTime: Date.now(),
      lastUpdate: Date.now(),
      data: null
    });

    // ADD TO QUEUE
    const queueResult = automationQueue.add(sessionId, cleanedUrl, {
      wait_time: wait_time,
      button_selectors: button_selectors,
      headless: headless,
      sessionLogger: sessionLogger,
      startTime: startTime,
      name: name
    });

    // Check if queue is full
    if (!queueResult.success) {
      sessionLogger.error('Queue is full, rejecting request', {
        queueSize: queueResult.queueSize,
        maxSize: queueResult.maxSize
      });

      // Remove from sessions
      automationSessions.delete(sessionId);

      return res.status(503).json({
        success: false,
        error: 'Queue is full',
        message: 'O sistema está processando o número máximo de requisições. Tente novamente em alguns minutos.',
        queue_size: queueResult.queueSize,
        max_queue_size: queueResult.maxSize
      });
    }

    // RETORNAR RESPOSTA IMEDIATAMENTE COM INFO DA FILA
    const responseMessage = queueResult.position === 1 && !automationQueue.currentJob
      ? 'Automação iniciada imediatamente'
      : 'Automação adicionada à fila';

    const responseStatus = queueResult.position === 1 && !automationQueue.currentJob
      ? 'processing'
      : 'queued';

    res.status(200).json({
      success: true,
      session_id: sessionId,
      message: responseMessage,
      status: responseStatus,
      queue_position: queueResult.position,
      queue_size: queueResult.queueSize,
      estimated_wait_seconds: queueResult.estimatedWaitSeconds
    });

    sessionLogger.info('✅ Resposta 200 enviada - job adicionado à fila', {
      queuePosition: queueResult.position,
      estimatedWait: queueResult.estimatedWaitSeconds
    });

  } catch (error) {
    sessionLogger.error('Erro ao iniciar automação', error);

    // Se ainda não enviou resposta, enviar erro
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: 'Erro ao iniciar automação',
        details: error.message
      });
    }
  }
});

// Função para executar automação em background
async function runAutomationInBackground(sessionId, url, wait_time, button_selectors, headless, sessionLogger, startTime, name = null) {
  let automation = null;
  let sessionData = null;

  try {
    sessionLogger.setContext('targetUrl', url);
    sessionLogger.setContext('waitTime', wait_time);
    sessionLogger.setContext('headless', headless);
    if (name) {
      sessionLogger.setContext('name', name);
    }
    sessionLogger.info(`Executando automação GBP Check em background`, {
      targetUrl: url,
      customSelectors: button_selectors.length > 0,
      selectorCount: button_selectors.length,
      completionUrl: 'app.gbpcheck.com/extension/healthcheck (com fechamento automático)',
      checkInterval: '5 segundos',
      windowManagement: 'Nova janela independente será criada e fechada automaticamente',
      name: name
    });

    automation = new PlaywrightAutomation(sessionId, name);
    lastAutomationInstance = automation;

    // Atualizar status da sessão
    sessionData = automationSessions.get(sessionId);
    if (sessionData) {
      sessionData.status = 'running';
      sessionData.lastUpdate = Date.now();
    }

    // Configurar browser
    sessionLogger.setContext('state', 'setting_up_browser');
    if (!(await automation.setupBrowser(headless))) {
      throw new Error('Falha ao configurar browser');
    }

    // Navegar para URL
    sessionLogger.setContext('state', 'navigating');
    await automation.navigateToUrl(url);

    // Verificar se é URL do Google Maps e redirecionar se necessário
    const currentUrl = automation.page.url();
    if (automation.isGoogleMapsUrl(currentUrl)) {
      sessionLogger.setContext('state', 'maps_redirect');
      sessionLogger.info('Google Maps detectado - iniciando redirecionamento', {
        mapsUrl: currentUrl,
        redirecting: true
      });

      // Marcar que a automação começou no Maps
      automation.cameFromMaps = true;

      const redirectSuccess = await automation.handleGoogleMapsRedirect();
      if (redirectSuccess) {
        const newUrl = automation.page.url();
        sessionLogger.info('Redirecionamento do Maps concluído com sucesso', {
          previousUrl: currentUrl,
          newUrl,
          isSearchPage: automation.isGoogleSearchUrl(newUrl)
        });

        // ✅ AGUARDAR 10 SEGUNDOS APÓS REDIRECT PARA PÁGINA CARREGAR COMPLETAMENTE
        sessionLogger.info('⏳ Aguardando 10 segundos para página de pesquisa carregar após redirect do Maps...');
        await new Promise(resolve => setTimeout(resolve, 10000));

        // Aguardar estados de carregamento
        try {
          await automation.page.waitForLoadState('domcontentloaded', { timeout: 5000 });
          await automation.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
            sessionLogger.info('⚠️ Timeout aguardando networkidle - continuando');
          });
        } catch (loadError) {
          sessionLogger.warn('⚠️ Timeout aguardando carregamento da página:', loadError.message);
        }

        sessionLogger.info('✅ Página de pesquisa carregada após redirect do Maps');

        // ✅ VERIFICAR "MODO TOPO" APÓS MAPS REDIRECT COMPLETAR
        sessionLogger.info('🔍 Verificando se GBP está no "modo topo" após redirect do Maps');
        const gbpCorrected = await automation.handleGBPTopModeCorrection(0, true);

        if (gbpCorrected) {
          sessionLogger.info('✅ Modo GBP corrigido após redirect do Maps - aguardando estabilização');
          await automation.stealthManager.humanDelay(5000, 7000);
        } else {
          sessionLogger.info('ℹ️ GBP não está no modo topo ou correção não foi necessária');
        }

      } else {
        sessionLogger.warn('Falha no redirecionamento do Maps - continuando com URL atual', {
          currentUrl: automation.page.url()
        });
      }
    } else {
      sessionLogger.info('URL não é do Google Maps - prosseguindo normalmente', {
        currentUrl,
        isSearchPage: automation.isGoogleSearchUrl(currentUrl)
      });

      // ✅ VERIFICAR "MODO TOPO" PARA URLs DIRETAS (NÃO-MAPS)
      if (automation.isGoogleSearchUrl(currentUrl)) {
        sessionLogger.info('🔍 Verificando se GBP está no "modo topo" (URL direta de pesquisa)');

        // Aguardar página carregar completamente antes de verificar
        try {
          await automation.page.waitForLoadState('domcontentloaded', { timeout: 5000 });
          await automation.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
            sessionLogger.info('⚠️ Timeout aguardando networkidle - continuando');
          });
        } catch (loadError) {
          sessionLogger.warn('⚠️ Timeout aguardando carregamento:', loadError.message);
        }

        const gbpCorrected = await automation.handleGBPTopModeCorrection(0, false);

        if (gbpCorrected) {
          sessionLogger.info('✅ Modo GBP corrigido - aguardando estabilização');
          await automation.stealthManager.humanDelay(5000, 7000);
        } else {
          sessionLogger.info('ℹ️ GBP não está no modo topo ou correção não foi necessária');
        }
      }
    }

    // Aguardar 15 segundos para a extensão carregar e adicionar o botão
    sessionLogger.info('Aguardando 15 segundos para extensão carregar...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    sessionLogger.info('Delay de extensão concluído, procurando botão...');

    // Verificar se há elementos da extensão na página
    try {
      const extensionElements = await automation.page.$$('.start-main-check-btn, .main-btn, #gbp-check-main-container');
      sessionLogger.info(`🔍 Encontrados ${extensionElements.length} elementos da extensão na página`);

      if (extensionElements.length === 0) {
        sessionLogger.warn('⚠️ Nenhum elemento da extensão encontrado - extensão pode não ter carregado corretamente');
      }
    } catch (checkError) {
      sessionLogger.warn('⚠️ Erro ao verificar elementos da extensão:', checkError.message);
    }

    // Encontrar e clicar botão (sempre tentar, mesmo sem seletores específicos)
    sessionLogger.setContext('state', 'searching_button');
    const selectors = button_selectors.length > 0 ? button_selectors : null;
    let buttonClicked = false;

    if (selectors && selectors.length > 0) {
      sessionLogger.info('Usando seletores personalizados para GBP Check');
      buttonClicked = await automation.findAndClickButton(selectors);
    } else {
      sessionLogger.info('Usando seletores padrão do GBP Check');
      buttonClicked = await automation.findAndClickButton();
    }

    if (!buttonClicked) {
      sessionLogger.warn('Nenhum botão foi clicado, continuando com monitoramento passivo');
    }

    // Aguardar conclusão em modo PASSIVO (sem interferir com Chrome Extension)
    sessionLogger.setContext('state', 'passive_monitoring');
    sessionLogger.info('Iniciando monitoramento passivo GBP Check', {
      focusUrl: 'app.gbpcheck.com/extension/healthcheck',
      detectionMethod: 'url_only_with_auto_close'
    });
    const completionResult = await automation.waitForCompletionPassive(wait_time);
    const completed = completionResult.completed;

    // Atualizar status da sessão
    sessionData = automationSessions.get(sessionId);
    if (sessionData) {
      sessionData.status = completed ? 'completed' : 'timeout';
      sessionData.lastUpdate = Date.now();
    }

    sessionLogger.setContext('state', 'finalizing');
    if (completed) {
      sessionLogger.info('Automação GBP Check concluída com sucesso', {
        detectionMethod: completionResult.method,
        completionUrl: completionResult.url
      });

      // NOVAS AÇÕES APÓS CONCLUSÃO
      try {
        // 1. Clicar no botão especificado
        sessionLogger.info('🖱️ Clicando no botão após conclusão...');
        const buttonSelector = '#actions-main-header-button-dropdown > a:nth-child(3) > i';
        const buttonClickSuccess = await automation.clickButtonAfterCompletion(buttonSelector);

        if (buttonClickSuccess) {
          sessionLogger.info('✅ Botão clicado com sucesso após conclusão');
        } else {
          sessionLogger.warn('⚠️ Não foi possível clicar no botão após conclusão');
        }
      } catch (buttonError) {
        sessionLogger.error('❌ Erro ao clicar no botão após conclusão', buttonError);
      }
    } else {
      sessionLogger.warn('Automação GBP Check finalizada por timeout', {
        reason: completionResult.method,
        finalUrl: completionResult.url
      });
    }

    // Capturar resultado final
    const screenshotUrl = await automation.takeScreenshot();
    const pageInfo = automation.getPageInfo();
    const downloads = automation.getDownloads();
    const interceptedAPIData = automation.getInterceptedAPIData();
    const gbpCheckData = automation.extractGBPCheckData();

    const finalUrl = pageInfo.url || completionResult.url || url;
    const wasGoogleMaps = automation.isGoogleMapsUrl(url);
    const isNowGoogleSearch = automation.isGoogleSearchUrl(finalUrl);

    const responseData = {
      success: true,
      session_id: sessionId,
      message: completed ? 'Automação GBP Check concluída com sucesso' : 'Automação GBP Check finalizada (timeout atingido)',
      data: {
        name: automation.name,
        initial_url: url,
        final_url: finalUrl,
        title: pageInfo.title || '',
        screenshot_url: screenshotUrl,
        wait_time_used: wait_time,
        timestamp: pageInfo.timestamp,
        browser_mode: headless ? 'headless' : 'visible',
        button_clicked: buttonClicked,
        process_completed: completed,
        completion_method: completionResult.method,
        completion_detected: GBP_CONFIG.URL_PATTERNS.COMPLETION_PRIMARY.test(finalUrl) || false,
        gbp_check_specific: true,
        maps_redirect: {
          was_maps_url: wasGoogleMaps,
          is_search_url: isNowGoogleSearch,
          redirect_performed: wasGoogleMaps && isNowGoogleSearch
        },
        gbp_mode_correction: {
          was_corrected: automation.gbpModeFixed,
          description: automation.gbpModeFixed ? 'GBP estava no modo topo - corrigido clicando em Avaliações' : 'GBP já estava no modo correto'
        },
        auto_close: {
          was_triggered: completionResult.auto_close_pending || completionResult.auto_closed !== undefined,
          success: completionResult.auto_closed || false,
          pending: completionResult.auto_close_pending || false,
          pages_tracked: automation.automationPages.size,
          window_closed: completionResult.auto_closed || false,
          is_new_window: automation.isNewWindow,
          description: completionResult.auto_close_pending ?
            `Fechamento automático será executado após resposta (${automation.automationPages.size} abas)` :
            completionResult.auto_closed ?
            `Janela da automação fechada completamente (${automation.automationPages.size} abas)` :
            'Fechamento automático não executado'
        },
        downloads: {
          count: downloads.length,
          files: downloads.map(d => ({
            filename: d.filename,
            size: d.size,
            created: d.created
          })),
          downloads_path: downloads.length > 0 ? 'data/downloads/' : null
        },
        api_data: {
          intercepted_requests: interceptedAPIData.total_requests,
          gbp_check_data: gbpCheckData,
          raw_api_calls: interceptedAPIData.requests,
          detailed_data: process.env.DEBUG_API_DATA ? interceptedAPIData.detailed_data : undefined
        }
      }
    };

    sessionLogger.info('Automação GBP Check finalizada', responseData.data);

    // Atualizar sessão com dados completos
    sessionData = automationSessions.get(sessionId);
    if (sessionData) {
      sessionData.data = responseData;
      sessionData.lastUpdate = Date.now();
    }

    // 2. Enviar webhook com dados de conclusão
    if (completed) {
      try {
        sessionLogger.info('📡 Enviando webhook com dados de conclusão...');
        const webhookUrl = 'https://ample-n8n.i9msbj.easypanel.host/webhook/f024ef22-70b6-4374-829e-e1ba5c22474d';
        const webhookSuccess = await automation.sendCompletionWebhook(webhookUrl, responseData);

        if (webhookSuccess) {
          sessionLogger.info('✅ Webhook enviado com sucesso');
          responseData.data.webhook_sent = true;
        } else {
          sessionLogger.warn('⚠️ Falha ao enviar webhook');
          responseData.data.webhook_sent = false;
        }
      } catch (webhookError) {
        sessionLogger.error('❌ Erro ao enviar webhook', webhookError);
        responseData.data.webhook_sent = false;
        responseData.data.webhook_error = webhookError.message;
      }
    }

    sessionLogger.info('✅ Automação em background concluída', {
      sessionId: sessionId,
      completed: completed,
      elapsedTime: Date.now() - startTime
    });

    // Executar fechamento automático
    if (completionResult.auto_close_pending) {
      // Verificar se fechamento automático está habilitado
      const autoCloseEnabled = process.env.DISABLE_AUTO_CLOSE !== 'true';

      if (!autoCloseEnabled) {
        sessionLogger.info('🔒 Fechamento automático desabilitado via DISABLE_AUTO_CLOSE');
        return;
      }

      sessionLogger.info('🔒 Executando fechamento automático');

      try {
        // Verificar se a automação ainda está válida
        if (!automation || !automation.context) {
          sessionLogger.warn('Contexto de automação não disponível para fechamento');
          return;
        }

        const autoCloseSuccess = await automation.performAutoClose();
        sessionLogger.info('✅ Fechamento automático concluído', {
          success: autoCloseSuccess,
          totalElapsedTime: Date.now() - startTime
        });
      } catch (closeError) {
        sessionLogger.warn('❌ Erro no fechamento automático', {
          error: closeError.message,
          errorType: closeError.name || 'unknown'
        });
      }
    }

  } catch (error) {
    // Determinar se o erro é devido ao navegador sendo fechado manualmente
    const isBrowserClosedError = error.message && (
      error.message.includes('Target closed') ||
      error.message.includes('Session closed') ||
      error.message.includes('Browser has been closed') ||
      error.message.includes('Connection closed') ||
      error.message.includes('Protocol error')
    );

    const errorContext = {
      currentState: sessionLogger.context.state || 'unknown',
      targetUrl: url || 'not_provided',
      errorType: isBrowserClosedError ? 'browser_closed_manually' : 'automation_error',
      isBrowserClosed: isBrowserClosedError
    };

    if (isBrowserClosedError) {
      sessionLogger.warn('Navegador foi fechado manualmente durante a automação em background', errorContext);
    } else {
      sessionLogger.error('Erro crítico na automação GBP Check em background', error, errorContext);
    }

    // Screenshot de erro (apenas se o navegador ainda estiver disponível)
    let errorScreenshotUrl = null;
    if (!isBrowserClosedError && automation && automation.page) {
      try {
        // Verificar se a página ainda está acessível antes de tentar screenshot
        if (!automation.page.isClosed()) {
          const errorScreenshot = await automation.page.screenshot({
            type: 'png',
            timeout: 5000
          });
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const fileName = `error-screenshot-${timestamp}.png`;
          const filePath = path.join(screenshotsDir, fileName);
          fs.writeFileSync(filePath, errorScreenshot);
          errorScreenshotUrl = `/screenshots/${fileName}`;
          sessionLogger.info('Screenshot de erro capturado', { fileName });
        }
      } catch (screenshotError) {
        sessionLogger.warn('Falha ao capturar screenshot de erro', {
          error: screenshotError.message,
          reason: 'page_inaccessible'
        });
      }
    }

    // Atualizar sessão com erro
    sessionData = automationSessions.get(sessionId);
    if (sessionData) {
      sessionData.status = 'error';
      sessionData.error = error.message;
      sessionData.error_type = errorContext.errorType;
      sessionData.screenshot_url = errorScreenshotUrl;
      sessionData.lastUpdate = Date.now();
    }

    sessionLogger.error('Automação em background falhou', {
      sessionId: sessionId,
      error: error.message,
      errorType: errorContext.errorType
    });

    // Log final da sessão
    sessionLogger.info('Sessão de automação em background finalizada com erro', {
      sessionId,
      finalState: sessionLogger.context.state || 'unknown',
      elapsedTime: sessionLogger.getElapsedTime()
    });

  } finally {
    // ALWAYS perform complete cleanup to ensure browser is fully closed
    // This is critical for queue processing - each job must start with a fresh browser
    if (automation) {
      try {
        sessionLogger.info('🔒 Executando limpeza completa do browser...');
        await automation.completeCleanup();
        sessionLogger.info('✅ Limpeza completa concluída - browser totalmente fechado');
      } catch (cleanupError) {
        sessionLogger.error('❌ Erro durante limpeza completa (crítico para fila)', {
          error: cleanupError.message,
          stack: cleanupError.stack
        });

        // Force cleanup even if error occurred
        try {
          if (automation.context) await automation.context.close();
          if (automation.browser) await automation.browser.close();
        } catch (forceError) {
          sessionLogger.error('❌ Erro no fechamento forçado', {
            error: forceError.message
          });
        }
      }
    }

    sessionLogger.info('🏁 Sessão de automação finalizada - recursos liberados', {
      sessionId,
      totalElapsedTime: sessionLogger.getElapsedTime()
    });
  }
}

// Endpoint de diagnóstico
app.get('/diagnose', async (_, res) => {
  try {
    const diagnosis = {
      timestamp: new Date().toISOString(),
      node_version: process.version,
      platform: process.platform,
      directories: {
        screenshots: fs.existsSync(screenshotsDir),
        browser_data: fs.existsSync(path.join(__dirname, 'data', 'browser-data')),
        browser_profile: fs.existsSync(path.join(__dirname, 'data', 'browser-profile'))
      }
    };

    // Testar detecção do Chrome
    const automation = new PlaywrightAutomation();
    const chromePath = automation.findChromeExecutable();

    // Verificar se Playwright Chromium está disponível
    let playwrightChromiumAvailable = false;
    try {
      const playwright = require('playwright');
      playwrightChromiumAvailable = true;
    } catch (e) {
      playwrightChromiumAvailable = false;
    }

    diagnosis.browser_detection = {
      chrome: {
        executable_path: chromePath,
        executable_exists: chromePath ? fs.existsSync(chromePath) : false,
        status: chromePath ? 'Chrome encontrado (primário)' : 'Chrome não encontrado'
      },
      playwright_chromium: {
        available: playwrightChromiumAvailable,
        status: playwrightChromiumAvailable ? 'Chromium disponível (fallback)' : 'Chromium não disponível'
      },
      selected_browser: chromePath ? 'Google Chrome' : (playwrightChromiumAvailable ? 'Playwright Chromium' : 'Nenhum'),
      browser_profile_dir: path.join(__dirname, 'data', 'browser-profile')
    };

    res.json({
      success: true,
      message: 'Diagnóstico do sistema',
      data: diagnosis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Listar screenshots
app.get('/screenshots', (_, res) => {
  try {
    const files = fs.readdirSync(screenshotsDir)
      .filter(file => file.endsWith('.png'))
      .map(file => {
        const stats = fs.statSync(path.join(screenshotsDir, file));
        return {
          name: file,
          url: `/screenshots/${file}`,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
      .sort((a, b) => b.modified - a.modified);

    res.json({
      success: true,
      count: files.length,
      files: files
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cleanup screenshots
app.delete('/screenshots/cleanup', (_, res) => {
  try {
    const files = fs.readdirSync(screenshotsDir).filter(file => file.endsWith('.png'));
    let deletedCount = 0;

    files.forEach(file => {
      const filePath = path.join(screenshotsDir, file);
      const stats = fs.statSync(filePath);
      const ageInHours = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60);

      if (ageInHours > 24) { // Delete files older than 24 hours
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    });

    res.json({
      success: true,
      message: `${deletedCount} screenshots antigos removidos`,
      deleted: deletedCount,
      remaining: files.length - deletedCount
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Servir screenshots estaticamente
app.use('/screenshots', express.static(screenshotsDir));

// Criar diretório de downloads se não existir
const downloadsDir = path.join(__dirname, 'data', 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// Listar downloads
app.get('/downloads', (_, res) => {
  try {
    const files = fs.readdirSync(downloadsDir)
      .map(file => {
        const stats = fs.statSync(path.join(downloadsDir, file));
        return {
          name: file,
          url: `/downloads/${file}`,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          type: path.extname(file).toLowerCase()
        };
      })
      .sort((a, b) => b.modified - a.modified);

    res.json({
      success: true,
      count: files.length,
      files: files
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cleanup downloads
app.delete('/downloads/cleanup', (_, res) => {
  try {
    const files = fs.readdirSync(downloadsDir);
    let deletedCount = 0;

    files.forEach(file => {
      const filePath = path.join(downloadsDir, file);
      fs.unlinkSync(filePath);
      deletedCount++;
    });

    res.json({
      success: true,
      message: `${deletedCount} downloads removidos`,
      deleted: deletedCount
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug de downloads - informações detalhadas
app.get('/downloads/debug', (_, res) => {
  try {
    const downloadsPath = path.join(__dirname, 'data', 'downloads');
    const exists = fs.existsSync(downloadsPath);

    let files = [];
    let totalSize = 0;

    if (exists) {
      files = fs.readdirSync(downloadsPath).map(file => {
        const filePath = path.join(downloadsPath, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;

        return {
          name: file,
          size: stats.size,
          sizeFormatted: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
          created: stats.birthtime,
          modified: stats.mtime,
          extension: path.extname(file),
          fullPath: filePath
        };
      });
    }

    res.json({
      success: true,
      downloadsPath: downloadsPath,
      pathExists: exists,
      fileCount: files.length,
      totalSize: totalSize,
      totalSizeFormatted: (totalSize / 1024 / 1024).toFixed(2) + ' MB',
      files: files,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Servir downloads estaticamente
app.use('/downloads', express.static(downloadsDir));

// Iniciar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`Servidor rodando na porta ${PORT}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  logger.info(`Automação: POST http://localhost:${PORT}/automate`);
  logger.info(`Screenshots: GET http://localhost:${PORT}/screenshots`);
  logger.info(`Downloads: GET http://localhost:${PORT}/downloads`);
  logger.info(`Downloads Debug: GET http://localhost:${PORT}/downloads/debug`);
  logger.info(`API Data: GET http://localhost:${PORT}/api-data`);
  logger.info(`Status: GET http://localhost:${PORT}/status/:sessionId`);
});
