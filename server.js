const express = require('express');
const { chromium } = require('playwright');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;

// Configurar logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: '/app/data/app.log' })
  ]
});

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Rota de health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Rota principal para automação
app.post('/automate', async (req, res) => {
  const { url, waitTime = 300000, extensionPath = '/chrome-extension' } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'URL é obrigatória' });
  }

  let browser = null;
  let context = null;
  let page = null;

  try {
    logger.info(`Iniciando automação para URL: ${url}`);

    // Configurar argumentos do Chrome com extensão
    const browserArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-default-apps'
    ];

    // Iniciar browser
    browser = await chromium.launch({
      headless: true, // Necessário para extensões funcionarem
      args: browserArgs,
      slowMo: 100
    });

    // Criar contexto
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    // Criar página
    page = await context.newPage();

    // Navegar para a URL
    logger.info(`Navegando para: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

    // Aguardar a página carregar completamente
    await page.waitForTimeout(5000);

    // Aguardar o botão da extensão aparecer
    logger.info('Aguardando botão da extensão...');
    
    // Seletores possíveis para o botão da extensão
    const possibleSelectors = [
      '[data-extension-button]',
      '.extension-button',
      '#extension-button',
      'button[class*="extension"]',
      'div[class*="extension"] button',
      '.chrome-extension-button'
    ];

    let buttonFound = false;
    let button = null;

    // Tentar encontrar o botão usando diferentes seletores
    for (const selector of possibleSelectors) {
      try {
        button = await page.waitForSelector(selector, { timeout: 10000 });
        if (button) {
          buttonFound = true;
          logger.info(`Botão encontrado com seletor: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue tentando outros seletores
        continue;
      }
    }

    // Se não encontrou com seletores específicos, tentar busca mais ampla
    if (!buttonFound) {
      logger.info('Tentando encontrar botão por texto...');
      try {
        // Procurar por botões que possam conter texto relacionado à extensão
        button = await page.locator('button').filter({ hasText: /start|iniciar|process|processar|execute|executar/i }).first();
        await button.waitFor({ timeout: 10000 });
        buttonFound = true;
        logger.info('Botão encontrado por texto');
      } catch (e) {
        logger.error('Não foi possível encontrar o botão da extensão');
      }
    }

    if (!buttonFound) {
      throw new Error('Botão da extensão não encontrado na página');
    }

    // Clicar no botão
    logger.info('Clicando no botão da extensão...');
    await button.click();

    // Aguardar o processo (5 minutos por padrão)
    logger.info(`Aguardando processo por ${waitTime / 1000} segundos...`);
    
    // Monitorar mudanças na página durante a espera
    const startTime = Date.now();
    let processComplete = false;
    
    while (Date.now() - startTime < waitTime && !processComplete) {
      try {
        // Verificar indicadores de que o processo terminou
        const completionIndicators = [
          '.process-complete',
          '.success',
          '.finished',
          '.done',
          '[data-status="complete"]',
          '[data-status="success"]'
        ];

        for (const indicator of completionIndicators) {
          const element = await page.locator(indicator).first();
          if (await element.isVisible().catch(() => false)) {
            processComplete = true;
            logger.info(`Processo concluído - indicador encontrado: ${indicator}`);
            break;
          }
        }

        if (!processComplete) {
          await page.waitForTimeout(5000); // Aguardar 5 segundos antes de verificar novamente
        }
      } catch (e) {
        // Continue aguardando
        await page.waitForTimeout(5000);
      }
    }

    // Capturar screenshot final
    const screenshot = await page.screenshot({ 
      fullPage: true,
      type: 'png'
    });

    // Obter informações finais da página
    const finalUrl = page.url();
    const title = await page.title();
    
    logger.info('Automação concluída com sucesso');

    res.json({
      success: true,
      message: 'Automação concluída com sucesso',
      data: {
        initialUrl: url,
        finalUrl: finalUrl,
        title: title,
        processTime: Date.now() - startTime,
        screenshot: screenshot.toString('base64'),
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error(`Erro na automação: ${error.message}`);
    
    // Capturar screenshot do erro se a página existir
    let errorScreenshot = null;
    if (page) {
      try {
        errorScreenshot = await page.screenshot({ type: 'png' });
      } catch (e) {
        // Ignore screenshot errors
      }
    }

    res.status(500).json({
      success: false,
      error: error.message,
      screenshot: errorScreenshot ? errorScreenshot.toString('base64') : null,
      timestamp: new Date().toISOString()
    });

  } finally {
    // Limpeza
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Servidor Playwright rodando na porta ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Recebido SIGTERM, encerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Recebido SIGINT, encerrando servidor...');
  process.exit(0);
});