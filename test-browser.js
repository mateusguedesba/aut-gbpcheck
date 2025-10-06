const express = require('express');
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3002;

app.use(express.json());

let browserInstance = null;
let pageInstance = null;

// Função para encontrar executável do Edge
function findEdgeExecutable() {
  const possiblePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env.EDGE_EXECUTABLE_PATH
  ].filter(Boolean);

  for (const edgePath of possiblePaths) {
    if (fs.existsSync(edgePath)) {
      return edgePath;
    }
  }
  return null;
}

// Endpoint para abrir navegador
app.get('/open-browser', async (req, res) => {
  try {
    if (browserInstance) {
      return res.json({
        success: true,
        message: 'Navegador já está aberto',
        url: pageInstance ? pageInstance.url() : 'about:blank'
      });
    }

    const edgePath = findEdgeExecutable();
    if (!edgePath) {
      throw new Error('Microsoft Edge não encontrado');
    }

    const extensionPath = path.join(__dirname, 'chrome-extension');
    const persistentDataDir = path.join(__dirname, 'data', 'edge-profile');

    // Criar diretório se não existir
    if (!fs.existsSync(persistentDataDir)) {
      fs.mkdirSync(persistentDataDir, { recursive: true });
    }

    const launchOptions = {
      executablePath: edgePath,
      headless: false,
      args: [
        `--load-extension=${extensionPath}`,
        '--disable-extensions-except=' + extensionPath,
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-infobars',
        '--disable-dev-shm-usage',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    };

    console.log('🚀 Abrindo navegador Edge...');
    
    browserInstance = await chromium.launchPersistentContext(persistentDataDir, launchOptions);
    
    // Usar página existente ou criar nova
    const pages = browserInstance.pages();
    if (pages.length > 0) {
      pageInstance = pages[0];
    } else {
      pageInstance = await browserInstance.newPage();
    }

    await pageInstance.goto('about:blank');

    console.log('✅ Navegador aberto com sucesso');

    res.json({
      success: true,
      message: 'Navegador aberto com sucesso',
      instructions: [
        'O navegador Edge está aberto e permanecerá assim',
        'Extensão GBP Check carregada automaticamente',
        'Use /close-browser para fechar quando necessário',
        'Use /status para verificar estado atual'
      ]
    });

  } catch (error) {
    console.error('❌ Erro ao abrir navegador:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint para fechar navegador
app.get('/close-browser', async (req, res) => {
  try {
    if (!browserInstance) {
      return res.json({
        success: true,
        message: 'Navegador já estava fechado'
      });
    }

    await browserInstance.close();
    browserInstance = null;
    pageInstance = null;

    console.log('🔒 Navegador fechado');

    res.json({
      success: true,
      message: 'Navegador fechado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao fechar navegador:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint para verificar status
app.get('/status', async (req, res) => {
  try {
    const isOpen = browserInstance !== null;
    let currentUrl = 'N/A';
    
    if (isOpen && pageInstance) {
      try {
        currentUrl = pageInstance.url();
      } catch (e) {
        currentUrl = 'Erro ao obter URL';
      }
    }

    res.json({
      success: true,
      browser_open: isOpen,
      current_url: currentUrl,
      edge_path: findEdgeExecutable(),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint para navegar para URL específica
app.post('/navigate', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL é obrigatória'
      });
    }

    if (!browserInstance || !pageInstance) {
      return res.status(400).json({
        success: false,
        error: 'Navegador não está aberto. Use /open-browser primeiro'
      });
    }

    await pageInstance.goto(url, { waitUntil: 'domcontentloaded' });

    res.json({
      success: true,
      message: `Navegou para: ${url}`,
      current_url: pageInstance.url()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'Browser Test Service',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Cleanup ao fechar aplicação
process.on('SIGINT', async () => {
  console.log('\n🔄 Fechando aplicação...');
  if (browserInstance) {
    try {
      await browserInstance.close();
      console.log('🔒 Navegador fechado');
    } catch (e) {
      console.error('Erro ao fechar navegador:', e.message);
    }
  }
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🧪 Browser Test Service rodando na porta ${PORT}`);
  console.log(`📖 Endpoints disponíveis:`);
  console.log(`   GET  /open-browser  - Abre navegador Edge`);
  console.log(`   GET  /close-browser - Fecha navegador`);
  console.log(`   GET  /status        - Status do navegador`);
  console.log(`   POST /navigate      - Navega para URL {"url": "..."}`);
  console.log(`   GET  /health        - Health check`);
});
