import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config();

const app = express();
const port = process.env.SUPABASE_MCP_PORT || 3001;

// Middleware pour parser JSON
app.use(express.json());

// Vérifier les variables d'environnement
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('Erreur: SUPABASE_URL et SUPABASE_KEY doivent être définis dans les variables d\'environnement');
  process.exit(1);
}

// Initialiser le client Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

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

// Route pour récupérer tous les utilisateurs
app.get('/users', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*');

    if (error) {
      console.error('Erreur lors de la récupération des utilisateurs:', error);
      return res.status(400).json({ 
        error: 'Erreur lors de la récupération des utilisateurs', 
        details: error.message 
      });
    }

    res.json({
      success: true,
      data: data || [],
      count: data ? data.length : 0
    });
  } catch (err) {
    console.error('Erreur serveur:', err);
    res.status(500).json({ 
      error: 'Erreur interne du serveur', 
      details: err.message 
    });
  }
});

// Route pour ajouter un utilisateur
app.post('/users', async (req, res) => {
  try {
    const userData = req.body;

    // Validation basique
    if (!userData || Object.keys(userData).length === 0) {
      return res.status(400).json({ 
        error: 'Données utilisateur manquantes' 
      });
    }

    const { data, error } = await supabase
      .from('users')
      .insert([userData])
      .select();

    if (error) {
      console.error('Erreur lors de l\'ajout de l\'utilisateur:', error);
      return res.status(400).json({ 
        error: 'Erreur lors de l\'ajout de l\'utilisateur', 
        details: error.message 
      });
    }

    res.status(201).json({
      success: true,
      data: data[0],
      message: 'Utilisateur ajouté avec succès'
    });
  } catch (err) {
    console.error('Erreur serveur:', err);
    res.status(500).json({ 
      error: 'Erreur interne du serveur', 
      details: err.message 
    });
  }
});

// Route de health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'supabase-mcp',
    timestamp: new Date().toISOString()
  });
});

// Démarrer le serveur
app.listen(port, () => {
  console.log(`🚀 Serveur Supabase MCP démarré sur le port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`👥 Users endpoint: http://localhost:${port}/users`);
});

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du serveur Supabase MCP...');
  process.exit(0);
});

export default app;
