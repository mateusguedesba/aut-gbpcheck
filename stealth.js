/**
 * Módulo de configurações stealth para evasão de detecção de automação
 * Contém todas as funcionalidades relacionadas a anti-detecção e comportamento humano
 */

class StealthManager {
  constructor(logger = console) {
    this.config = this.generateStealthConfig();
    this.logger = logger;
  }

  /**
   * Gera configuração stealth dinâmica com user agents, viewports e idiomas aleatórios
   */
  generateStealthConfig() {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36 Edg/118.0.0.0'
    ];

    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1920, height: 1200 },
      { width: 2560, height: 1440 },
      { width: 1920, height: 1080 }
    ];

    const languages = ['pt-BR,pt;q=0.9,en;q=0.8', 'en-US,en;q=0.9', 'pt-BR,pt;q=0.8,en-US;q=0.7,en;q=0.6'];

    return {
      userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
      viewport: viewports[Math.floor(Math.random() * viewports.length)],
      language: languages[Math.floor(Math.random() * languages.length)]
    };
  }

  /**
   * Aplica configurações stealth avançadas na página
   */
  async applyStealthConfiguration(page) {
    try {
      this.logger.info('🥷 Aplicando configurações stealth avançadas...');

      // 1. Mascarar propriedades do navigator
      await page.addInitScript(() => {
        // Remover propriedades de automação
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });

        // Mascarar plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });

        // Mascarar languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['pt-BR', 'pt', 'en-US', 'en'],
        });

        // Mascarar permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );

        // Mascarar WebGL
        const getParameter = WebGLRenderingContext.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
          if (parameter === 37445) {
            return 'Intel Inc.';
          }
          if (parameter === 37446) {
            return 'Intel(R) Iris(R) Xe Graphics';
          }
          return getParameter(parameter);
        };
      });

      // 2. Configurar headers HTTP naturais
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': this.config.language,
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      });

      // 3. Configurar User-Agent
      await page.setUserAgent(this.config.userAgent);

      // 4. Configurar viewport
      await page.setViewportSize(this.config.viewport);

      this.logger.info(`🎭 Stealth configurado: ${this.config.userAgent.split(' ')[0]}...`);
      this.logger.info(`📐 Viewport: ${this.config.viewport.width}x${this.config.viewport.height}`);
      this.logger.info(`🌐 Idioma: ${this.config.language}`);

      return true;
    } catch (error) {
      this.logger.error('❌ Erro ao aplicar configurações stealth:', error.message);
      return false;
    }
  }

  /**
   * Simula comportamento humano com delays aleatórios
   */
  async humanDelay(min = 1000, max = 3000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    this.logger.info(`⏱️ Delay humano: ${delay}ms`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Simula movimento natural do mouse
   */
  async simulateHumanMouseMovement(page) {
    try {
      const viewport = page.viewportSize();
      const randomX = Math.floor(Math.random() * viewport.width);
      const randomY = Math.floor(Math.random() * viewport.height);

      await page.mouse.move(randomX, randomY, { steps: 10 });
      await this.humanDelay(500, 1500);

      this.logger.info(`🖱️ Mouse movido para: ${randomX}, ${randomY}`);
    } catch (error) {
      this.logger.warn('⚠️ Erro ao simular movimento do mouse:', error.message);
    }
  }

  /**
   * Retorna argumentos stealth para o browser
   * Removidos argumentos duplicados e conflitantes com extensões
   */
  getStealthBrowserArgs() {
    return [
      // Argumentos stealth principais - anti-detecção
      '--disable-blink-features=AutomationControlled',
      '--disable-features=TranslateUI,AutomationControlled',
      '--exclude-switches=enable-automation',
      '--enable-automation=false',

      // Segurança e sandbox (necessários para extensões funcionarem)
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--no-zygote',

      // Performance e background
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-networking',

      // Recursos desnecessários que podem revelar automação
      '--disable-field-trial-config',
      '--disable-hang-monitor',
      '--disable-prompt-on-repost',
      '--disable-sync',
      '--metrics-recording-only',
      '--no-report-upload',
      '--safebrowsing-disable-auto-update',
      '--disable-client-side-phishing-detection',
      '--disable-component-update',
      '--disable-domain-reliability',

      // Audio e mídia
      '--mute-audio',
      '--autoplay-policy=user-gesture-required',

      // Interface e experiência
      '--no-default-browser-check',
      '--no-first-run',
      '--no-pings',
      '--password-store=basic',

      // GPU e renderização (compatível com extensões)
      '--ignore-gpu-blacklist',
      '--use-gl=swiftshader',
      '--use-mock-keychain',
    ];
  }

  /**
   * Retorna argumentos específicos para melhor compatibilidade com extensões
   */
  getExtensionFriendlyArgs() {
    return [
      // Argumentos que garantem que extensões funcionem corretamente
      '--disable-web-security', // Permite que extensões façam requests cross-origin
      '--disable-features=VizDisplayCompositor', // Melhora compatibilidade com capturas de tela
      '--disable-infobars', // Remove barras de informação que podem interferir
      '--allow-running-insecure-content', // Permite conteúdo misto se necessário
      '--disable-site-isolation-trials', // Melhora comunicação entre frames
    ];
  }

  /**
   * Simula scroll natural na página
   */
  async simulateNaturalScroll(page) {
    try {
      await page.evaluate(() => {
        window.scrollTo(0, Math.floor(Math.random() * 500));
      });
      this.logger.info('📜 Scroll simulado para comportamento natural');
    } catch (scrollError) {
      this.logger.warn('⚠️ Erro ao simular scroll:', scrollError.message);
    }
  }

  /**
   * Simula interação humana antes de clicar em elemento
   */
  async simulateHumanInteraction(element) {
    try {
      // Scroll para o elemento se necessário
      await element.scrollIntoViewIfNeeded();
      await this.humanDelay(500, 1000);

      // Simular hover antes do clique
      await element.hover();
      await this.humanDelay(500, 1500);

      return true;
    } catch (error) {
      this.logger.warn('⚠️ Erro ao simular interação humana:', error.message);
      return false;
    }
  }

  /**
   * Retorna a configuração atual
   */
  getConfig() {
    return this.config;
  }

  /**
   * Regenera a configuração stealth
   */
  regenerateConfig() {
    this.config = this.generateStealthConfig();
    return this.config;
  }
}

module.exports = StealthManager;
