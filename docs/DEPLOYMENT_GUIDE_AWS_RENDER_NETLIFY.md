# Deployment Guide — AWS, Render, Netlify & Supabase

This guide details how to deploy the **Transaction Ledger System** using either:
- **Option A (Recommended Free Tier)**: Netlify (Frontend) + Render (Backend) + Supabase (PostgreSQL)
- **Option B (AWS Production)**: AWS App Runner / ECS (Backend) + AWS S3 / CloudFront (Frontend) + AWS RDS PostgreSQL (Database)

---

## Option A: Supabase + Render + Netlify (Recommended)

### Step 1: Set Up Supabase (PostgreSQL Database)
1. Go to [supabase.com](https://supabase.com) and create a free account (Sign in with GitHub).
2. Click **New Project**:
   - Choose a project name (e.g. `ledger-db`).
   - Generate a strong database password and save it safely.
   - Select your nearest region.
3. Once the database is provisioned (1-2 minutes):
   - Go to **Project Settings** > **Database**.
   - Under **Connection string**, select **URI** (or **NodeJS**).
   - Copy the connection URI:
     `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`
   - *(Optional)* If using Supabase Connection Pooling on port 6543, use the transaction pooler string.
4. The backend automatically creates all tables, foreign keys, unique constraints, and indexes on startup!

---

### Step 2: Deploy Backend to Render
1. Go to [render.com](https://render.com) and sign in with GitHub.
2. Click **New +** > **Web Service**.
3. Connect your GitHub repository.
4. Configure the Web Service:
   - **Name**: `confluencer-ledger-api`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node dist/server.js`
   - **Instance Type**: Free
5. Add **Environment Variables** in the Render dashboard:
   - `NODE_ENV`: `production`
   - `PORT`: `5000`
   - `DATABASE_URL`: `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`
   - `CORS_ORIGIN`: `*` (or your Netlify domain once deployed)
6. Click **Create Web Service**.
7. Once deployed, copy your Render URL (e.g. `https://confluencer-ledger-api.onrender.com`).
   - Test it by visiting `https://confluencer-ledger-api.onrender.com/api/v1/health`.

> **Note for Render Free Tier**: Render free instances sleep after 15 minutes of inactivity and take ~30-60s to wake up on the first request.

---

### Step 3: Deploy Frontend to Netlify
1. Go to [netlify.com](https://netlify.com) and sign in with GitHub.
2. Click **Add new site** > **Import an existing project**.
3. Select your GitHub repository.
4. Configure build settings:
   - **Base directory**: `frontend`
   - **Build command**: `npm run build`
   - **Publish directory**: `frontend/dist`
5. Under **Environment variables**, add:
   - `VITE_API_URL`: `https://confluencer-ledger-api.onrender.com/api/v1` (replace with your Render backend URL)
6. Click **Deploy Site**.
7. Your live, interactive full-stack ledger application is now online!

---

## Option B: Deploying to Amazon Web Services (AWS)

### Architecture
- **Database**: Amazon RDS for PostgreSQL (db.t4g.micro or db.t3.micro on Free Tier)
- **Backend API**: AWS App Runner or Amazon ECS (Fargate) containerized with Docker
- **Frontend UI**: Amazon S3 static website hosting + Amazon CloudFront CDN

### 1. AWS RDS PostgreSQL
1. Open the **Amazon RDS Console** > **Databases** > **Create database**.
2. Select **PostgreSQL**, Template: **Free tier**.
3. Set DB instance identifier (e.g. `ledger-db`), Master username (`postgres`), and password.
4. Set Public access to **Yes** (or configure VPC peering/security groups allowing inbound on port 5432).
5. Obtain the RDS endpoint string:
   `postgresql://postgres:[PASSWORD]@[RDS-ENDPOINT]:5432/postgres`

### 2. Backend on AWS App Runner (Fastest Container Deployment)
1. In the backend directory, build and push a Docker image to **Amazon ECR** (Elastic Container Registry) or connect directly from GitHub.
2. In **AWS App Runner Console** > **Create service**:
   - Source: Repository / Container
   - Port: `5000`
   - Environment variables:
     - `DATABASE_URL`: Your RDS endpoint string
     - `NODE_ENV`: `production`
     - `CORS_ORIGIN`: `*`
3. Click **Create & Deploy**. AWS App Runner provisions a secure HTTPS URL with automatic auto-scaling.

### 3. Frontend on AWS S3 & CloudFront
1. In `frontend/`:
   ```bash
   npm run build
   ```
2. Create an Amazon S3 bucket (e.g. `confluencer-ledger-app`).
3. Upload contents of `frontend/dist/` to the S3 bucket.
4. Create an **Amazon CloudFront** distribution pointing to the S3 bucket as origin.
5. Set error page redirection for Single Page Application:
   - HTTP 403 / 404 -> `/index.html` with response code 200.
6. Access your application via the CloudFront distribution domain name.
