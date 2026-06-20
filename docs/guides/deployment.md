# Deployment Guide

**Hướng dẫn triển khai / Deployment Guide**

Complete guide for deploying VietERP to development, staging, and production environments.

## Deployment Environments / Môi trường triển khai

| Environment     | Database                 | Cache              | Events                   | Auth              | Monitoring             |
| --------------- | ------------------------ | ------------------ | ------------------------ | ----------------- | ---------------------- |
| **Development** | PostgreSQL (Docker)      | Redis (Docker)     | NATS (Docker)            | Keycloak (Docker) | Basic logging          |
| **Staging**     | RDS/Cloud SQL            | Managed Redis      | Managed NATS             | Keycloak          | CloudWatch/Stackdriver |
| **Production**  | RDS/Cloud SQL (Multi-AZ) | Managed Redis (HA) | Managed NATS (Clustered) | Keycloak (HA)     | Full APM stack         |

## 1. Docker Compose / Docker Compose

### Development Setup / Thiết lập phát triển

Start local stack with Docker Compose:

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down

# Clean data (WARNING: removes volumes!)
docker compose down -v
```

### Production-like Docker Compose / Docker Compose giống sản xuất

Create `docker-compose.production.yml`:

```yaml
version: "3.8"

services:
  # Database with backups enabled
  postgres:
    image: postgres:16-alpine
    container_name: vierp-postgres-prod
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=en_US.UTF-8"
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: always
    networks:
      - vierp-network

  # Redis with persistence
  redis:
    image: redis:7-alpine
    container_name: vierp-redis-prod
    command: redis-server --appendonly yes --appendfsync everysec
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: always
    networks:
      - vierp-network

  # NATS with clustering
  nats:
    image: nats:2-alpine
    container_name: vierp-nats-prod
    command: >
      -c /etc/nats/nats.conf
      -js
      --sd /data
    ports:
      - "4222:4222"
      - "8222:8222"
    volumes:
      - ./config/nats.conf:/etc/nats/nats.conf:ro
      - nats_data:/data
    restart: always
    networks:
      - vierp-network

  # Keycloak
  keycloak:
    image: quay.io/keycloak/keycloak:24.0
    container_name: vierp-keycloak-prod
    environment:
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://postgres:5432/${DB_NAME}
      KC_DB_USERNAME: ${DB_USER}
      KC_DB_PASSWORD: ${DB_PASSWORD}
      KC_HOSTNAME: ${KEYCLOAK_HOSTNAME}
      KC_PROXY: edge
      KEYCLOAK_ADMIN: ${KEYCLOAK_ADMIN}
      KEYCLOAK_ADMIN_PASSWORD: ${KEYCLOAK_ADMIN_PASSWORD}
    command: start --optimized
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy
    restart: always
    networks:
      - vierp-network

  # Kong API Gateway
  kong:
    image: kong:3.6-ubuntu
    container_name: vierp-kong-prod
    environment:
      KONG_DATABASE: postgres
      KONG_PG_HOST: postgres
      KONG_PG_USER: ${DB_USER}
      KONG_PG_PASSWORD: ${DB_PASSWORD}
      KONG_PG_DATABASE: ${DB_NAME}
      KONG_PROXY_LISTEN: 0.0.0.0:8000
      KONG_ADMIN_LISTEN: 0.0.0.0:8001
      KONG_LOG_LEVEL: warn
      KONG_PLUGINS: bundled,rate-limiting,cors,jwt
    ports:
      - "8000:8000" # Proxy
      - "8001:8001" # Admin
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "kong", "health"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: always
    networks:
      - vierp-network

  # HRM Module (unified)
  hrm-unified:
    build:
      context: .
      dockerfile: apps/HRM-unified/Dockerfile
      args:
        NODE_ENV: production
    container_name: vierp-hrm-unified-prod
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      REDIS_URL: redis://redis:6379
      NATS_URL: nats://nats:4222
      KEYCLOAK_URL: http://keycloak:8080
      PORT: 3001
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis
      - nats
      - keycloak
    restart: always
    networks:
      - vierp-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Additional modules (CRM, MRP, Accounting, etc.)
  # ... similar pattern for each module

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  nats_data:
    driver: local

networks:
  vierp-network:
    driver: bridge
```

Start with production config:

```bash
docker compose -f docker-compose.production.yml up -d
```

## 2. Kubernetes with Helm / Kubernetes với Helm

### Prerequisites / Tiền điều kiện

- Kubernetes cluster (EKS, GKE, AKS, or self-managed)
- kubectl configured
- Helm 3.x installed

### Helm Chart Structure / Cấu trúc Helm Chart

```
infrastructure/helm/vierp/
├── Chart.yaml
├── values.yaml
├── values-staging.yaml
├── values-prod.yaml
├── templates/
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── postgres-statefulset.yaml
│   ├── redis-statefulset.yaml
│   ├── nats-statefulset.yaml
│   ├── keycloak-deployment.yaml
│   ├── hrm-deployment.yaml
│   ├── crm-deployment.yaml
│   ├── accounting-deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   └── hpa.yaml
└── README.md
```

### Install Helm Chart / Cài đặt Helm Chart

```bash
# Add Helm repository (optional)
helm repo add vierp https://helm.vierp.vn/
helm repo update

# Staging deployment
helm install vierp ./infrastructure/helm/vierp \
  -f infrastructure/helm/vierp/values-staging.yaml \
  --namespace vierp-staging \
  --create-namespace

# Production deployment
helm install vierp ./infrastructure/helm/vierp \
  -f infrastructure/helm/vierp/values-prod.yaml \
  --namespace vierp-prod \
  --create-namespace

# Upgrade deployment
helm upgrade vierp ./infrastructure/helm/vierp \
  -f infrastructure/helm/vierp/values-prod.yaml \
  --namespace vierp-prod
```

### Helm Values Example / Ví dụ giá trị Helm

```yaml
# values-prod.yaml
global:
  environment: production
  domain: erp.vierp.vn
  tls: true

postgres:
  enabled: true
  image: postgres:16-alpine
  replicas: 1
  persistence:
    size: 500Gi
    storageClass: gp2
  backup:
    enabled: true
    schedule: "0 2 * * *"
    retention: 30

redis:
  enabled: true
  image: redis:7-alpine
  replicas: 3
  persistence:
    size: 100Gi

keycloak:
  enabled: true
  replicas: 3
  image: quay.io/keycloak/keycloak:24.0
  hostname: auth.vierp.vn
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 1000m
      memory: 2Gi

modules:
  hrm-unified:
    enabled: true
    replicas: 3
    image: vierp/hrm-unified:1.0.0
    resources:
      requests:
        cpu: 250m
        memory: 512Mi
      limits:
        cpu: 500m
        memory: 1Gi
    autoscaling:
      enabled: true
      minReplicas: 3
      maxReplicas: 10
      targetCPUUtilizationPercentage: 70

  crm:
    enabled: true
    replicas: 3
    # ... similar config

  accounting:
    enabled: true
    replicas: 2
    # ... similar config

  ecommerce:
    enabled: true
    replicas: 3
    # ... similar config

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: erp.vierp.vn
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: vierp-tls
      hosts:
        - erp.vierp.vn

monitoring:
  enabled: true
  prometheus:
    enabled: true
  grafana:
    enabled: true
```

## 3. AWS Deployment / Triển khai AWS

### Architecture / Kiến trúc

```
┌─────────────────────────────────────────────────────────┐
│                    Route 53 (DNS)                       │
│                 (erp.vierp.vn → ALB)                    │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│          Application Load Balancer (ALB)                │
│       (SSL/TLS, path-based routing, rate limit)         │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  Elastic Container Service (ECS) on Fargate             │
│  ┌──────────┬──────────┬──────────┬──────────┐          │
│  │   HRM    │   CRM    │   MRP    │ Acctg    │          │
│  │ (3 tasks)│(3 tasks) │(3 tasks) │(2 tasks) │          │
│  └──────────┴──────────┴──────────┴──────────┘          │
└──────────────────────────┬──────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼────────┐ ┌──────▼─────────┐ ┌─────▼──────────┐
│   RDS Aurora   │ │ ElastiCache    │ │  Amazon MQ     │
│  (PostgreSQL)  │ │    (Redis)     │ │  (NATS/Events) │
│  Multi-AZ      │ │   Cluster      │ │                │
└────────────────┘ └────────────────┘ └────────────────┘
```

### CloudFormation Template / Mẫu CloudFormation

```yaml
# infrastructure/aws/vierp-stack.yaml
AWSTemplateFormatVersion: "2010-09-09"
Description: "VietERP Platform on AWS"

Parameters:
  Environment:
    Type: String
    Default: staging
    AllowedValues: [staging, production]

  DBMasterUsername:
    Type: String
    NoEcho: true

Resources:
  # VPC
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true

  # RDS Aurora PostgreSQL
  DBCluster:
    Type: AWS::RDS::DBCluster
    Properties:
      Engine: aurora-postgresql
      EngineVersion: "16.0"
      MasterUsername: !Ref DBMasterUsername
      MasterUserPassword: !Sub "{{resolve:secretsmanager:vierp-db-password}}"
      DatabaseName: vierp_prod
      StorageEncrypted: true
      BackupRetentionPeriod: 30
      PreferredBackupWindow: "02:00-03:00"
      PreferredMaintenanceWindow: "sun:03:00-sun:04:00"
      MultiAZ: true

  # ElastiCache Redis
  RedisCluster:
    Type: AWS::ElastiCache::ReplicationGroup
    Properties:
      Engine: redis
      EngineVersion: "7.0"
      ReplicationGroupDescription: VietERP Cache
      CacheNodeType: cache.r6g.xlarge
      NumCacheClusters: 3
      AutomaticFailover: Enabled
      AtRestEncryptionEnabled: true
      TransitEncryptionEnabled: true

  # ECS Cluster
  ECSCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: vierp-cluster

  # ALB
  LoadBalancer:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Type: application
      Subnets:
        - !Ref PublicSubnet1
        - !Ref PublicSubnet2
      SecurityGroups:
        - !Ref ALBSecurityGroup

  # ECS Tasks for modules (HRM, CRM, etc.)
  HRMTaskDefinition:
    Type: AWS::ECS::TaskDefinition
    Properties:
      Family: vierp-hrm
      NetworkMode: awsvpc
      RequiresCompatibilities:
        - FARGATE
      Cpu: "256"
      Memory: "512"
      ExecutionRoleArn: !GetAtt ECSTaskExecutionRole.Arn
      TaskRoleArn: !GetAtt ECSTaskRole.Arn
      ContainerDefinitions:
        - Name: hrm
          Image: !Sub "${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/vierp/hrm:latest"
          PortMappings:
            - ContainerPort: 3001
          Environment:
            - Name: DATABASE_URL
              Value: !Sub "postgresql://${DBMasterUsername}:password@${DBCluster.Endpoint.Address}:5432/vierp_prod"
            - Name: REDIS_URL
              Value: !GetAtt RedisCluster.PrimaryEndPoint.Address
            - Name: NATS_URL
              Value: !Sub "nats://${NATSMQ.Broker}:4222"
          LogConfiguration:
            LogDriver: awslogs
            Options:
              awslogs-group: /ecs/vierp-hrm
              awslogs-region: !Ref AWS::Region
              awslogs-stream-prefix: ecs

  # IAM Roles
  ECSTaskExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Statement:
          - Effect: Allow
            Principal:
              Service: ecs-tasks.amazonaws.com
            Action: "sts:AssumeRole"
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

  ECSTaskRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Statement:
          - Effect: Allow
            Principal:
              Service: ecs-tasks.amazonaws.com
            Action: "sts:AssumeRole"

Outputs:
  LoadBalancerURL:
    Value: !GetAtt LoadBalancer.DNSName
    Description: URL of the Application Load Balancer

  DatabaseEndpoint:
    Value: !GetAtt DBCluster.Endpoint.Address
    Description: RDS Aurora Endpoint

  RedisEndpoint:
    Value: !GetAtt RedisCluster.PrimaryEndPoint.Address
    Description: ElastiCache Redis Endpoint
```

Deploy:

```bash
aws cloudformation create-stack \
  --stack-name vierp-prod \
  --template-body file://infrastructure/aws/vierp-stack.yaml \
  --parameters ParameterKey=Environment,ParameterValue=production \
  --region us-east-1
```

## 4. Google Cloud Platform (GCP) / Google Cloud Platform (GCP)

### Architecture / Kiến trúc

```
Cloud Load Balancer → GKE Cluster → Cloud SQL (PostgreSQL)
                                  → Memorystore (Redis)
                                  → Pub/Sub (Events)
```

### GCP Deployment Script / Kịch bản triển khai GCP

```bash
#!/bin/bash
# infrastructure/gcp/deploy.sh

PROJECT_ID="vierp-project"
REGION="asia-southeast1"
CLUSTER_NAME="vierp-prod"

# Enable APIs
gcloud services enable container.googleapis.com
gcloud services enable cloudsql.googleapis.com
gcloud services enable redis.googleapis.com
gcloud services enable pubsub.googleapis.com

# Create GKE cluster
gcloud container clusters create $CLUSTER_NAME \
  --zone ${REGION}-a \
  --num-nodes 3 \
  --machine-type n1-standard-2 \
  --enable-autoscaling \
  --min-nodes 3 \
  --max-nodes 10 \
  --enable-ip-alias \
  --network default

# Create Cloud SQL instance
gcloud sql instances create vierp-postgres \
  --database-version POSTGRES_16 \
  --tier db-custom-4-16384 \
  --region $REGION \
  --availability-type REGIONAL \
  --enable-bin-log

# Create Memorystore Redis instance
gcloud redis instances create vierp-cache \
  --size=5 \
  --region=$REGION \
  --redis-version=7.0

# Get cluster credentials
gcloud container clusters get-credentials $CLUSTER_NAME --zone ${REGION}-a

# Deploy with Helm
helm install vierp ./infrastructure/helm/vierp \
  -f infrastructure/helm/vierp/values-gcp.yaml
```

## 5. Azure Deployment / Triển khai Azure

### Architecture / Kiến trúc

```
Application Gateway → AKS Cluster → Azure Database for PostgreSQL
                                   → Azure Cache for Redis
                                   → Azure Service Bus (Events)
```

### Terraform Configuration / Cấu hình Terraform

```hcl
# infrastructure/azure/main.tf
terraform {
  required_version = ">= 1.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "vierp" {
  name     = "vierp-rg"
  location = "Southeast Asia"
}

# AKS Cluster
resource "azurerm_kubernetes_cluster" "vierp" {
  name                = "vierp-aks"
  location            = azurerm_resource_group.vierp.location
  resource_group_name = azurerm_resource_group.vierp.name
  dns_prefix          = "vierp"

  default_node_pool {
    name       = "default"
    node_count = 3
    vm_size    = "Standard_D2s_v3"
  }

  identity {
    type = "SystemAssigned"
  }
}

# Azure Database for PostgreSQL
resource "azurerm_postgresql_flexible_server" "vierp" {
  name                = "vierp-postgres"
  location            = azurerm_resource_group.vierp.location
  resource_group_name = azurerm_resource_group.vierp.name
  version             = "16"
  sku_name            = "B_Standard_B2s"
  storage_mb          = 32768
  backup_retention_days = 30
}

# Azure Cache for Redis
resource "azurerm_redis_cache" "vierp" {
  name                = "vierp-redis"
  location            = azurerm_resource_group.vierp.location
  resource_group_name = azurerm_resource_group.vierp.name
  capacity            = 1
  family              = "P"
  sku_name            = "Premium"
  enable_non_ssl_port = false
  minimum_tls_version = "1.2"
}
```

Deploy:

```bash
terraform init
terraform plan
terraform apply
```

## Environment Variables / Biến môi trường

Create `.env.production` with these variables:

```env
# Database
DATABASE_URL="postgresql://user:password@rds-endpoint:5432/vierp_prod"

# Cache
REDIS_URL="redis://cache-endpoint:6379"

# Events
NATS_URL="nats://nats-endpoint:4222"

# Authentication
KEYCLOAK_URL="https://auth.vierp.vn"
KEYCLOAK_REALM="vierp"
KEYCLOAK_CLIENT_ID="vierp-app"
KEYCLOAK_CLIENT_SECRET="secret"

# Application
NODE_ENV="production"
LOG_LEVEL="info"
PORT=3000

# Security
JWT_SECRET="your-jwt-secret"
API_KEY_PREFIX="vierp_live_"

# Email (for notifications)
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT=587
SMTP_USER="apikey"
SMTP_PASSWORD="${SENDGRID_API_KEY}"
SMTP_FROM="noreply@vierp.vn"

# AWS/GCP/Azure (if using)
AWS_REGION="ap-southeast-1"
AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY}"
AWS_SECRET_ACCESS_KEY="${AWS_SECRET_KEY}"

# Monitoring
DATADOG_API_KEY="${DATADOG_API_KEY}"
SENTRY_DSN="https://key@sentry.io/project-id"
```

## SSL/TLS Setup / Thiết lập SSL/TLS

### Let's Encrypt with cert-manager / Let's Encrypt với cert-manager

```yaml
# infrastructure/k8s/cert-manager.yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@vierp.vn
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: vierp-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - erp.vierp.vn
      secretName: vierp-tls
  rules:
    - host: erp.vierp.vn
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: vierp-api
                port:
                  number: 8000
```

Install cert-manager:

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
```

## Monitoring & Logging / Giám sát & Ghi nhật ký

### Prometheus Stack / Ngăn xếp Prometheus

```bash
# Add Prometheus Helm repository
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install Prometheus stack
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace
```

### Grafana Dashboards / Bảng điều khiển Grafana

Access Grafana:

```bash
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
# http://localhost:3000 (admin / prom-operator)
```

Create dashboards for:

- Pod resource usage
- API response times
- Database connection pool
- Redis memory usage
- NATS message throughput

### ELK Stack for Logs / Ngăn xếp ELK cho nhật ký

```bash
# Install Elastic Stack
helm repo add elastic https://helm.elastic.co
helm install elasticsearch elastic/elasticsearch \
  --namespace logging \
  --create-namespace

helm install kibana elastic/kibana \
  --namespace logging

# Configure Fluent Bit to ship logs
helm install fluent-bit fluent/fluent-bit \
  --namespace logging
```

Access Kibana:

```bash
kubectl port-forward -n logging svc/kibana-kibana 5601:5601
# http://localhost:5601
```

## Zero-Downtime Deployment / Triển khai không ngừng dịch vụ

Use blue-green or canary deployments:

```yaml
# infrastructure/k8s/canary-deployment.yaml
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: vierp-hrm
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: hrm
  progressDeadlineSeconds: 60
  service:
    port: 3001
  analysis:
    interval: 1m
    threshold: 5
    maxWeight: 50
    stepWeight: 10
    metrics:
      - name: request-success-rate
        thresholdRange:
          min: 99
        interval: 1m
    webhooks:
      - name: acceptance-test
        url: http://flagger-loadtester/
        timeout: 5s
        metadata:
          type: smoke
          cmd: "curl -sd 'test' http://hrm-canary:3001/api/health"
```

## Backup & Disaster Recovery / Sao lưu & Phục hồi thảm họa

### Database Backups / Sao lưu cơ sở dữ liệu

```bash
# Automated backups (configured in RDS/Cloud SQL/Azure)
# Manual backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# Restore
psql $DATABASE_URL < backup-20240329-120000.sql

# Send to S3/GCS
aws s3 cp backup-*.sql s3://vierp-backups/
```

### Kubernetes Disaster Recovery / Phục hồi thảm họa Kubernetes

```bash
# Use Velero for cluster backups
helm install velero velero/velero \
  --namespace velero \
  --create-namespace \
  --set configuration.backupStorageLocation.bucket=vierp-velero-backups
```

## Next Steps / Bước tiếp theo

1. Read **[Contributing Guide](./contributing.md)** for CI/CD pipelines
2. Configure **[Monitoring Setup](./deployment.md#monitoring)** for your platform
3. Setup **[SSL/TLS](./deployment.md#ssl-tls-setup)** certificates
4. Plan **[Backup Strategy](./deployment.md#backup--disaster-recovery)**
