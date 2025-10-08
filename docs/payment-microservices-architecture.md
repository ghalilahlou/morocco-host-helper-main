# Architecture Microservices pour le Paiement Sécurisé au Maroc

## 🏗️ Vue d'ensemble de l'Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT (React Frontend)                          │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY (Kong/Nginx)                          │
│  • Rate Limiting • Authentication • Request Routing • Load Balancing           │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
┌─────────────────────────┐ ┌─────────────────────────┐ ┌─────────────────────────┐
│    PAYMENT SERVICE      │ │   FRAUD DETECTION       │ │   NOTIFICATION SERVICE │
│  • Payment Processing  │ │   SERVICE               │ │  • Email/SMS Alerts   │
│  • Card Validation     │ │  • Risk Assessment      │ │  • Payment Status     │
│  • Transaction Mgmt    │ │  • ML Fraud Detection   │ │  • Receipt Generation  │
│  • Refund Handling     │ │  • Device Fingerprint   │ │                        │
└─────────────────────────┘ └─────────────────────────┘ └─────────────────────────┘
                    │                   │                   │
                    └───────────────────┼───────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        PAYMENT GATEWAY SERVICE                                 │
│  • PSP Integration (CIH, Attijariwafa, BMCE)  • International Cards (Visa/MC) │
│  • 3D Secure Authentication                   • Webhook Management             │
│  • Currency Conversion (MAD/EUR/USD)          • PCI DSS Compliance            │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
┌─────────────────────────┐ ┌─────────────────────────┐ ┌─────────────────────────┐
│    DATABASE LAYER       │ │     CACHE LAYER          │ │    MESSAGE QUEUE        │
│  • PostgreSQL (Main)    │ │  • Redis (Sessions)     │ │  • RabbitMQ/Apache Kafka │
│  • Redis (Cache)        │ │  • Redis (Rate Limiting) │ │  • Event Streaming      │
│  • Backup & Replication│ │  • Redis (Fraud Cache)   │ │  • Dead Letter Queue    │
└─────────────────────────┘ └─────────────────────────┘ └─────────────────────────┘
```

## 🔧 Services Détaillés

### 1. **Payment Service** (Service Principal)
- **Technologies** : Node.js + TypeScript + Express
- **Responsabilités** :
  - Traitement des paiements
  - Validation des cartes
  - Gestion des transactions
  - Gestion des remboursements
  - Intégration avec les PSP marocains

### 2. **Payment Gateway Service** (Passerelle de Paiement)
- **Technologies** : Node.js + TypeScript
- **Intégrations** :
  - **CIH Bank** (Cartes nationales)
  - **Attijariwafa Bank** (Cartes internationales)
  - **BMCE Bank** (Cartes d'entreprise)
  - **Stripe** (Cartes internationales)
  - **PayPal** (Paiements internationaux)

### 3. **Fraud Detection Service** (Détection de Fraude)
- **Technologies** : Python + FastAPI + ML
- **Fonctionnalités** :
  - Analyse comportementale
  - Détection d'anomalies
  - Scoring de risque
  - Blacklist management
  - Device fingerprinting

### 4. **Notification Service** (Service de Notifications)
- **Technologies** : Node.js + TypeScript
- **Canaux** :
  - Email (Resend/SendGrid)
  - SMS (Twilio/Orange)
  - Push notifications
  - Webhooks

### 5. **API Gateway** (Point d'Entrée)
- **Technologies** : Kong/Nginx + Lua
- **Fonctionnalités** :
  - Rate limiting
  - Authentication/Authorization
  - Request routing
  - Load balancing
  - Monitoring

## 🗄️ Schéma de Base de Données

### Tables Principales

```sql
-- Table des paiements
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'MAD',
    status VARCHAR(20) NOT NULL, -- pending, processing, completed, failed, refunded
    payment_method VARCHAR(20) NOT NULL, -- card, bank_transfer, wallet
    gateway_provider VARCHAR(50), -- cih, attijariwafa, stripe, paypal
    gateway_transaction_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des tentatives de paiement
CREATE TABLE payment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id),
    attempt_number INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    error_code VARCHAR(50),
    error_message TEXT,
    gateway_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des remboursements
CREATE TABLE refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id),
    amount DECIMAL(10,2) NOT NULL,
    reason VARCHAR(100),
    status VARCHAR(20) NOT NULL,
    gateway_refund_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table de détection de fraude
CREATE TABLE fraud_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id),
    risk_score DECIMAL(3,2), -- 0.00 to 1.00
    risk_level VARCHAR(10), -- low, medium, high, critical
    checks_performed JSONB,
    decision VARCHAR(10), -- approve, decline, review
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🔒 Sécurité et Conformité

### 1. **PCI DSS Compliance**
- Tokenisation des cartes
- Chiffrement AES-256
- Audit logs complets
- Segmentation réseau

### 2. **Sécurité Marocaine**
- Conformité Bank Al-Maghrib
- Chiffrement local
- Audit trail obligatoire
- Backup sécurisé

### 3. **Mesures de Sécurité**
- Rate limiting par IP
- Détection d'anomalies
- Monitoring en temps réel
- Alertes automatiques

## 🚀 Déploiement et Infrastructure

### 1. **Conteneurisation**
- Docker pour chaque service
- Docker Compose pour l'environnement local
- Kubernetes pour la production

### 2. **Monitoring**
- Prometheus + Grafana
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Health checks automatiques

### 3. **Backup et Récupération**
- Backup automatique quotidien
- Récupération point-in-time
- Tests de récupération mensuels

## 📊 Flux de Paiement

### 1. **Paiement Standard**
```
Client → API Gateway → Payment Service → Payment Gateway → PSP → Bank
```

### 2. **Détection de Fraude**
```
Payment Service → Fraud Detection Service → Risk Assessment → Decision
```

### 3. **Notifications**
```
Payment Status → Notification Service → Email/SMS → Client
```

## 🔧 Configuration des Services

### Variables d'Environnement
```env
# Payment Service
PAYMENT_SERVICE_PORT=3001
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Payment Gateway
CIH_API_KEY=...
ATTIJARIWAFA_API_KEY=...
STRIPE_SECRET_KEY=...

# Fraud Detection
FRAUD_SERVICE_PORT=3002
ML_MODEL_PATH=/models/fraud_detection.pkl

# Notification Service
NOTIFICATION_SERVICE_PORT=3003
RESEND_API_KEY=...
TWILIO_ACCOUNT_SID=...
```

## 📈 Monitoring et Alertes

### 1. **Métriques Clés**
- Taux de succès des paiements
- Temps de réponse moyen
- Taux de fraude détectée
- Volume de transactions

### 2. **Alertes Automatiques**
- Échecs de paiement > 5%
- Temps de réponse > 5s
- Tentatives de fraude détectées
- Services indisponibles

Cette architecture vous permettra d'intégrer un système de paiement sécurisé et conforme aux réglementations marocaines tout en supportant les cartes internationales.
