import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config();

const app = express();
const port = process.env.CLAUDE_MCP_PORT || 3002;

// Middleware pour parser JSON
app.use(express.json());

// Vérifier les variables d'environnement
if (!process.env.CLAUDE_API_KEY) {
  console.error('Erreur: CLAUDE_API_KEY doit être défini dans les variables d\'environnement');
  process.exit(1);
}

// Middleware CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Route pour interagir avec Claude
app.post('/ask', async (req, res) => {
  try {
    const { prompt, model = 'claude-3-sonnet-20240229', max_tokens = 1000 } = req.body;

    // Validation
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ 
        error: 'Le paramètre "prompt" est requis et doit être une chaîne de caractères' 
      });
    }

    // Préparer la requête pour l'API Claude
    const requestBody = {
      model,
      max_tokens,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };

    console.log(`📤 Envoi de la requête à Claude: ${prompt.substring(0, 100)}...`);

    // Appeler l'API Claude
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Erreur API Claude:', response.status, errorData);
      return res.status(response.status).json({ 
        error: 'Erreur lors de l\'appel à l\'API Claude', 
        details: errorData,
        status: response.status
      });
    }

    const data = await response.json();
    
    console.log(`📥 Réponse reçue de Claude`);

    res.json({
      success: true,
      data: {
        response: data.content[0]?.text || 'Aucune réponse générée',
        model: data.model,
        usage: data.usage,
        prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : '')
      }
    });

  } catch (err) {
    console.error('Erreur serveur:', err);
    res.status(500).json({ 
      error: 'Erreur interne du serveur', 
      details: err.message 
    });
  }
});

// Route pour obtenir les modèles disponibles (informatif)
app.get('/models', (req, res) => {
  res.json({
    success: true,
    models: [
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ],
    default: 'claude-3-sonnet-20240229'
  });
});

// Route de health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'claude-mcp',
    timestamp: new Date().toISOString(),
    api_key_configured: !!process.env.CLAUDE_API_KEY
  });
});

// Route d'information
app.get('/', (req, res) => {
  res.json({
    service: 'Claude MCP Server',
    version: '1.0.0',
    endpoints: {
      '/ask': 'POST - Envoyer un prompt à Claude',
      '/models': 'GET - Liste des modèles disponibles',
      '/health': 'GET - Status du serveur'
    },
    example: {
      endpoint: '/ask',
      method: 'POST',
      body: {
        prompt: 'Bonjour Claude, comment allez-vous ?',
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000
      }
    }
  });
});

// Démarrer le serveur
app.listen(port, () => {
  console.log(`🤖 Serveur Claude MCP démarré sur le port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`💬 Ask endpoint: http://localhost:${port}/ask`);
  console.log(`📋 Documentation: http://localhost:${port}/`);
});

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du serveur Claude MCP...');
  process.exit(0);
});

export default app;
